-- 0011_rls.sql
-- Row Level Security.
--
-- Model:
--   anon           -- may read the published catalogue and nothing else
--   customer       -- may read and write only rows tied to their own profile
--   stylist        -- may read the appointments and client context they need
--   receptionist   -- may run the front desk
--   manager        -- receptionist plus money and staff management
--   admin          -- everything, including permissions and settings
--
-- The service role bypasses RLS entirely; it is used only by server-side
-- webhook and cron handlers, never from the browser.

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.salons enable row level security;
alter table public.opening_hours enable row level security;
alter table public.blocked_dates enable row level security;
alter table public.salon_settings enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.service_addons enable row level security;
alter table public.service_addon_links enable row level security;
alter table public.staff enable row level security;
alter table public.staff_services enable row level security;
alter table public.staff_schedules enable row level security;
alter table public.staff_breaks enable row level security;
alter table public.staff_time_off enable row level security;
alter table public.slot_holds enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_items enable row level security;
alter table public.payments enable row level security;
alter table public.refunds enable row level security;
alter table public.gift_cards enable row level security;
alter table public.gift_card_redemptions enable row level security;
alter table public.discount_codes enable row level security;
alter table public.discount_redemptions enable row level security;
alter table public.client_notes enable row level security;
alter table public.client_tags enable row level security;
alter table public.client_tag_links enable row level security;
alter table public.consent_records enable row level security;
alter table public.client_photos enable row level security;
alter table public.message_templates enable row level security;
alter table public.message_deliveries enable row level security;
alter table public.waitlist_entries enable row level security;
alter table public.import_runs enable row level security;
alter table public.audit_logs enable row level security;

-- ---------------------------------------------------------------------------
-- Public catalogue: readable by everyone, writable by managers.
-- ---------------------------------------------------------------------------

create policy salons_public_read on public.salons
  for select using (is_active);
create policy salons_manager_write on public.salons
  for all using (public.is_manager()) with check (public.is_manager());

create policy opening_hours_public_read on public.opening_hours
  for select using (true);
create policy opening_hours_manager_write on public.opening_hours
  for all using (public.is_manager()) with check (public.is_manager());

create policy blocked_dates_public_read on public.blocked_dates
  for select using (true);
create policy blocked_dates_staff_write on public.blocked_dates
  for all using (public.is_manager()) with check (public.is_manager());

-- Settings are admin-only, and sensitive ones never leave the server at all.
create policy salon_settings_admin_all on public.salon_settings
  for all using (public.is_admin()) with check (public.is_admin());
create policy salon_settings_staff_read on public.salon_settings
  for select using (public.is_staff() and not is_sensitive);

create policy service_categories_public_read on public.service_categories
  for select using (is_active and deleted_at is null);
create policy service_categories_manager_write on public.service_categories
  for all using (public.is_manager()) with check (public.is_manager());

create policy services_public_read on public.services
  for select using (is_active and deleted_at is null);
create policy services_staff_read_all on public.services
  for select using (public.is_staff());
create policy services_manager_write on public.services
  for all using (public.is_manager()) with check (public.is_manager());

create policy service_addons_public_read on public.service_addons
  for select using (is_active and deleted_at is null);
create policy service_addons_manager_write on public.service_addons
  for all using (public.is_manager()) with check (public.is_manager());

create policy addon_links_public_read on public.service_addon_links
  for select using (true);
create policy addon_links_manager_write on public.service_addon_links
  for all using (public.is_manager()) with check (public.is_manager());

create policy staff_public_read on public.staff
  for select using (is_active and deleted_at is null);
create policy staff_manager_write on public.staff
  for all using (public.is_manager()) with check (public.is_manager());

create policy staff_services_public_read on public.staff_services
  for select using (true);
create policy staff_services_manager_write on public.staff_services
  for all using (public.is_manager()) with check (public.is_manager());

-- Schedules are readable publicly because availability depends on them; they
-- reveal working patterns only, never why someone is away.
create policy staff_schedules_public_read on public.staff_schedules
  for select using (true);
create policy staff_schedules_manager_write on public.staff_schedules
  for all using (public.is_manager()) with check (public.is_manager());

create policy staff_breaks_public_read on public.staff_breaks
  for select using (true);
create policy staff_breaks_manager_write on public.staff_breaks
  for all using (public.is_manager()) with check (public.is_manager());

-- Time off: staff only. "Reason" may be medical.
create policy staff_time_off_staff_read on public.staff_time_off
  for select using (public.is_staff());
create policy staff_time_off_manager_write on public.staff_time_off
  for all using (public.is_manager()) with check (public.is_manager());

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create policy profiles_self_read on public.profiles
  for select using (id = auth.uid());
create policy profiles_self_update on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_staff_read on public.profiles
  for select using (public.is_staff());
create policy profiles_reception_write on public.profiles
  for all
  using (public.has_any_role(array['receptionist', 'manager', 'admin']::public.user_role[]))
  with check (public.has_any_role(array['receptionist', 'manager', 'admin']::public.user_role[]));

-- Roles: everyone may see their own; only admins may change any.
create policy user_roles_self_read on public.user_roles
  for select using (user_id = auth.uid());
create policy user_roles_staff_read on public.user_roles
  for select using (public.is_staff());
create policy user_roles_admin_write on public.user_roles
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Holds and bookings
-- ---------------------------------------------------------------------------

-- A signed-in customer sees their own holds. Guest holds (profile_id null) are
-- addressed by their unguessable token through a server route, not by RLS.
create policy slot_holds_self_read on public.slot_holds
  for select using (profile_id = auth.uid() or public.is_staff());
create policy slot_holds_staff_write on public.slot_holds
  for all using (public.is_staff()) with check (public.is_staff());

create policy bookings_self_read on public.bookings
  for select using (profile_id = auth.uid());
create policy bookings_staff_read on public.bookings
  for select using (public.is_staff());
-- Customers may only move their own booking between the states the portal
-- offers; everything else (price, staff, status transitions to completed)
-- goes through SECURITY DEFINER functions or a staff role.
create policy bookings_self_update on public.bookings
  for update
  using (profile_id = auth.uid())
  with check (
    profile_id = auth.uid()
    and status in ('cancelled_by_customer', 'confirmed', 'pending_payment')
  );
create policy bookings_reception_write on public.bookings
  for all
  using (public.has_any_role(array['receptionist', 'manager', 'admin']::public.user_role[]))
  with check (public.has_any_role(array['receptionist', 'manager', 'admin']::public.user_role[]));
-- Stylists may update only their own appointments (mark complete / no-show).
create policy bookings_stylist_update on public.bookings
  for update
  using (
    public.has_role('stylist')
    and staff_id in (select id from public.staff where profile_id = auth.uid())
  )
  with check (
    public.has_role('stylist')
    and staff_id in (select id from public.staff where profile_id = auth.uid())
  );

create policy booking_items_read on public.booking_items
  for select using (
    public.is_staff()
    or booking_id in (select id from public.bookings where profile_id = auth.uid())
  );
create policy booking_items_staff_write on public.booking_items
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Money. Customers read their own; only managers and admins may write.
-- ---------------------------------------------------------------------------

create policy payments_self_read on public.payments
  for select using (profile_id = auth.uid());
create policy payments_staff_read on public.payments
  for select using (public.is_staff());
create policy payments_manager_write on public.payments
  for all using (public.is_manager()) with check (public.is_manager());

create policy refunds_self_read on public.refunds
  for select using (
    payment_id in (select id from public.payments where profile_id = auth.uid())
  );
create policy refunds_manager_all on public.refunds
  for all using (public.is_manager()) with check (public.is_manager());

create policy gift_cards_staff_read on public.gift_cards
  for select using (public.is_staff());
create policy gift_cards_manager_write on public.gift_cards
  for all using (public.is_manager()) with check (public.is_manager());

create policy gift_card_redemptions_staff_read on public.gift_card_redemptions
  for select using (public.is_staff());
create policy gift_card_redemptions_manager_write on public.gift_card_redemptions
  for all using (public.is_manager()) with check (public.is_manager());

-- Discount codes are validated server-side; the browser never lists them.
create policy discount_codes_staff_read on public.discount_codes
  for select using (public.is_staff());
create policy discount_codes_manager_write on public.discount_codes
  for all using (public.is_manager()) with check (public.is_manager());

create policy discount_redemptions_staff_read on public.discount_redemptions
  for select using (public.is_staff());
create policy discount_redemptions_manager_write on public.discount_redemptions
  for all using (public.is_manager()) with check (public.is_manager());

-- ---------------------------------------------------------------------------
-- CRM. The rule that matters: client_notes has no customer-facing policy at
-- all, so a customer querying it gets zero rows even with a valid session.
-- ---------------------------------------------------------------------------

create policy client_notes_staff_read on public.client_notes
  for select using (public.is_staff() and deleted_at is null);
create policy client_notes_staff_write on public.client_notes
  for all using (public.is_staff()) with check (public.is_staff());

create policy client_tags_staff_read on public.client_tags
  for select using (public.is_staff());
create policy client_tags_manager_write on public.client_tags
  for all using (public.is_manager()) with check (public.is_manager());

create policy client_tag_links_staff_all on public.client_tag_links
  for all using (public.is_staff()) with check (public.is_staff());

-- Consent: the customer can see and add their own; staff can see all.
create policy consent_self_read on public.consent_records
  for select using (profile_id = auth.uid());
create policy consent_self_insert on public.consent_records
  for insert with check (profile_id = auth.uid());
create policy consent_staff_read on public.consent_records
  for select using (public.is_staff());
create policy consent_staff_insert on public.consent_records
  for insert with check (public.is_staff());

create policy client_photos_self_read on public.client_photos
  for select using (profile_id = auth.uid() and deleted_at is null);
create policy client_photos_public_read on public.client_photos
  for select using (is_published and deleted_at is null);
create policy client_photos_staff_all on public.client_photos
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Messaging
-- ---------------------------------------------------------------------------

create policy message_templates_staff_read on public.message_templates
  for select using (public.is_staff());
create policy message_templates_manager_write on public.message_templates
  for all using (public.is_manager()) with check (public.is_manager());

create policy message_deliveries_self_read on public.message_deliveries
  for select using (profile_id = auth.uid());
create policy message_deliveries_staff_read on public.message_deliveries
  for select using (public.is_staff());
create policy message_deliveries_manager_write on public.message_deliveries
  for all using (public.is_manager()) with check (public.is_manager());

-- ---------------------------------------------------------------------------
-- Waiting list
-- ---------------------------------------------------------------------------

create policy waitlist_self_all on public.waitlist_entries
  for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy waitlist_staff_all on public.waitlist_entries
  for all using (public.is_staff()) with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Imports and audit
-- ---------------------------------------------------------------------------

create policy import_runs_manager_all on public.import_runs
  for all using (public.is_manager()) with check (public.is_manager());

-- Append-only: SELECT for managers, INSERT for any staff, no UPDATE or DELETE
-- policy for anyone. Even an admin cannot rewrite history through PostgREST.
create policy audit_logs_manager_read on public.audit_logs
  for select using (public.is_manager());
create policy audit_logs_staff_insert on public.audit_logs
  for insert with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Function execution grants. RLS does not apply inside SECURITY DEFINER
-- functions, so access is controlled by who may call them.
-- ---------------------------------------------------------------------------

revoke all on function public.hold_slot(uuid, uuid, timestamptz, uuid, uuid[]) from public;
revoke all on function public.book_slot(uuid, uuid, uuid[], text, text, text, text) from public;
revoke all on function public.confirm_booking_paid(uuid, integer, public.payment_kind) from public;
revoke all on function public.reschedule_booking(uuid, uuid, timestamptz) from public;
revoke all on function public.release_expired_holds(uuid) from public;

grant execute on function public.available_slots(uuid, date, date, uuid, integer) to anon, authenticated;
grant execute on function public.next_available_slot(uuid, uuid) to anon, authenticated;
grant execute on function public.is_slot_available(uuid, uuid, timestamptz, timestamptz, uuid, uuid) to authenticated;
grant execute on function public.effective_service_terms(uuid, uuid) to anon, authenticated;

-- Holding and booking are allowed from a signed-in session; guest checkout
-- runs through a server route on the service role.
grant execute on function public.hold_slot(uuid, uuid, timestamptz, uuid, uuid[]) to authenticated;
grant execute on function public.book_slot(uuid, uuid, uuid[], text, text, text, text) to authenticated;
grant execute on function public.reschedule_booking(uuid, uuid, timestamptz) to authenticated;

-- Payment confirmation is webhook-only.
grant execute on function public.confirm_booking_paid(uuid, integer, public.payment_kind) to service_role;
grant execute on function public.release_expired_holds(uuid) to service_role;
