-- 0012_guards.sql
-- Column-level write guards.
--
-- RLS decides which ROWS a role may touch, not which COLUMNS. A customer needs
-- UPDATE on their own booking row so they can cancel it from /account, and that
-- same grant would otherwise let them rewrite the price.
--
-- These triggers close the gap. Writes made by the SECURITY DEFINER functions
-- in 0009 set app.privileged_write for the transaction and pass through; a
-- direct write from a customer session does not.

create or replace function public.is_privileged_write()
returns boolean
language sql
stable
as $$
  select
    -- Set by book_slot / confirm_booking_paid / reschedule_booking.
    coalesce(current_setting('app.privileged_write', true), 'off') = 'on'
    -- Server-side service-role calls carry no end-user JWT.
    or auth.uid() is null
    or public.is_staff();
$$;

-- ---------------------------------------------------------------------------
-- Bookings: money, timing, ownership and staff assignment are server-owned.
-- A customer may only change their own notes and cancel.
-- ---------------------------------------------------------------------------

create or replace function public.guard_booking_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_privileged_write() then
    return new;
  end if;

  if new.service_price_pence is distinct from old.service_price_pence
     or new.addons_price_pence is distinct from old.addons_price_pence
     or new.discount_pence is distinct from old.discount_pence
     or new.total_price_pence is distinct from old.total_price_pence
     or new.deposit_pence is distinct from old.deposit_pence
     or new.deposit_paid_pence is distinct from old.deposit_paid_pence
     or new.balance_paid_pence is distinct from old.balance_paid_pence then
    raise exception 'booking_pricing_is_read_only' using errcode = '42501';
  end if;

  if new.staff_id is distinct from old.staff_id
     or new.service_id is distinct from old.service_id
     or new.profile_id is distinct from old.profile_id
     or new.salon_id is distinct from old.salon_id
     or new.starts_at is distinct from old.starts_at
     or new.ends_at is distinct from old.ends_at
     or new.blocked_until is distinct from old.blocked_until then
    raise exception 'booking_scheduling_is_read_only' using errcode = '42501';
  end if;

  if new.internal_notes is distinct from old.internal_notes then
    raise exception 'internal_notes_are_staff_only' using errcode = '42501';
  end if;

  -- The only status transition a customer may make is cancelling their own
  -- upcoming appointment.
  if new.status is distinct from old.status
     and new.status <> 'cancelled_by_customer' then
    raise exception 'booking_status_transition_not_allowed' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger bookings_guard_update
  before update on public.bookings
  for each row execute function public.guard_booking_update();

-- ---------------------------------------------------------------------------
-- Profiles: a customer owns their contact details and preferences, but not the
-- counters the salon relies on.
-- ---------------------------------------------------------------------------

create or replace function public.guard_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if public.is_privileged_write() then
    return new;
  end if;

  if new.no_show_count is distinct from old.no_show_count
     or new.cancellation_count is distinct from old.cancellation_count then
    raise exception 'profile_counters_are_read_only' using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function public.guard_profile_update();

-- The counter trigger from 0006 runs as a plain trigger on a customer's own
-- UPDATE, so it needs the same escape hatch.
create or replace function public.sync_profile_booking_counters()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    perform set_config('app.privileged_write', 'on', true);

    if new.status = 'no_show' then
      update public.profiles set no_show_count = no_show_count + 1 where id = new.profile_id;
    elsif old.status = 'no_show' then
      update public.profiles
        set no_show_count = greatest(0, no_show_count - 1)
        where id = new.profile_id;
    end if;

    if new.status in ('cancelled_by_customer', 'cancelled_by_salon')
       and old.status not in ('cancelled_by_customer', 'cancelled_by_salon') then
      update public.profiles
        set cancellation_count = cancellation_count + 1
        where id = new.profile_id;
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payments are written by the webhook only. Nothing with an end-user JWT may
-- insert or amend a payment row, whatever RLS says.
-- ---------------------------------------------------------------------------

create or replace function public.guard_payment_write()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Managers may record an in-salon settlement; everything else is webhook-only.
  if auth.uid() is null then
    return new;
  end if;

  if public.is_manager() and coalesce(new.kind, old.kind) = 'in_salon' then
    return new;
  end if;

  raise exception 'payments_are_written_by_the_stripe_webhook' using errcode = '42501';
end;
$$;

create trigger payments_guard_write
  before insert or update on public.payments
  for each row execute function public.guard_payment_write();

-- ---------------------------------------------------------------------------
-- Audit log is append-only for everyone, including admins.
-- ---------------------------------------------------------------------------

create or replace function public.guard_audit_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit_logs_are_append_only' using errcode = '42501';
end;
$$;

create trigger audit_logs_no_update
  before update or delete on public.audit_logs
  for each row execute function public.guard_audit_immutable();
