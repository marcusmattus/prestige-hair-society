-- 0006_bookings.sql
-- Slot holds and bookings.
--
-- Double-booking is prevented by the database, not by application logic:
--
--   * slot_holds carries an exclusion constraint so two live holds can never
--     overlap for the same stylist.
--   * bookings carries an exclusion constraint so two active bookings can never
--     overlap for the same stylist.
--   * Every booking must consume a hold it owns (see book_slot() in 0009), so
--     the two constraints together close the gap between the tables.
--
-- Ranges are half-open '[)': a 10:00-11:00 booking does not collide with an
-- 11:00 start. Each range runs to blocked_until (chair time + buffer), not to
-- the customer-visible ends_at.

create table public.slot_holds (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  staff_id uuid not null references public.staff (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete restrict,
  -- Signed-in customer, when there is one.
  profile_id uuid references public.profiles (id) on delete cascade,
  -- Opaque token returned to the browser; a guest proves ownership with it.
  hold_token uuid not null default gen_random_uuid(),

  starts_at timestamptz not null,
  ends_at timestamptz not null,
  blocked_until timestamptz not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  booking_id uuid, -- FK added below, once bookings exists

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint slot_holds_order check (ends_at > starts_at),
  constraint slot_holds_buffer check (blocked_until >= ends_at),
  -- A live hold occupies the stylist. Consumed holds are kept for audit but
  -- stop blocking, because the booking they produced now does the blocking.
  constraint slot_holds_no_overlap
    exclude using gist (
      staff_id with =,
      tstzrange(starts_at, blocked_until, '[)') with &&
    ) where (consumed_at is null)
);

create unique index slot_holds_token_key on public.slot_holds (hold_token);
create index slot_holds_expiry_idx on public.slot_holds (expires_at) where consumed_at is null;
create index slot_holds_staff_idx on public.slot_holds (staff_id, starts_at);
create index slot_holds_profile_idx on public.slot_holds (profile_id);

create trigger slot_holds_set_updated_at
  before update on public.slot_holds
  for each row execute function public.set_updated_at();

comment on constraint slot_holds_no_overlap on public.slot_holds is
  'Expired-but-unconsumed holds still block until swept. book_slot() and '
  'release_expired_holds() delete them inside the same transaction that '
  'inserts, so an expired hold never blocks a real booking.';

-- ---------------------------------------------------------------------------
-- Bookings
-- ---------------------------------------------------------------------------

create sequence public.booking_reference_seq start with 1000;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  salon_id uuid not null references public.salons (id) on delete restrict,
  staff_id uuid not null references public.staff (id) on delete restrict,
  -- restrict, not cascade: a booking is a financial record.
  profile_id uuid not null references public.profiles (id) on delete restrict,
  service_id uuid not null references public.services (id) on delete restrict,

  status public.booking_status not null default 'pending_payment',

  starts_at timestamptz not null,
  ends_at timestamptz not null,
  blocked_until timestamptz not null,

  -- Price snapshot, in pence. Never read live from services: the catalogue
  -- changes, a booked price does not.
  service_price_pence integer not null check (service_price_pence >= 0),
  addons_price_pence integer not null default 0 check (addons_price_pence >= 0),
  discount_pence integer not null default 0 check (discount_pence >= 0),
  total_price_pence integer not null check (total_price_pence >= 0),
  deposit_pence integer not null default 0 check (deposit_pence >= 0),
  deposit_paid_pence integer not null default 0 check (deposit_paid_pence >= 0),
  balance_paid_pence integer not null default 0 check (balance_paid_pence >= 0),
  pricing_mode public.pricing_mode not null default 'fixed',

  -- Customer-supplied context, copied at booking time.
  customer_notes text,
  accessibility_requirements text,
  -- Staff-only. Exposed by RLS to staff roles exclusively.
  internal_notes text,

  -- Provenance.
  booked_by_staff_id uuid references public.staff (id) on delete set null,
  is_walk_in boolean not null default false,
  source text not null default 'web' check (source in ('web', 'studio', 'walk_in', 'import', 'waitlist')),

  cancelled_at timestamptz,
  cancellation_reason text,
  cancelled_by uuid references public.profiles (id) on delete set null,
  rescheduled_from uuid references public.bookings (id) on delete set null,
  completed_at timestamptz,
  reminder_sent_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint bookings_order check (ends_at > starts_at),
  constraint bookings_buffer check (blocked_until >= ends_at),
  constraint bookings_deposit_within_total check (deposit_pence <= total_price_pence),
  constraint bookings_discount_within_total check (discount_pence <= service_price_pence + addons_price_pence),
  -- One stylist, one chair, one appointment at a time.
  constraint bookings_no_overlap
    exclude using gist (
      staff_id with =,
      tstzrange(starts_at, blocked_until, '[)') with &&
    ) where (status in ('pending_payment', 'confirmed', 'completed'))
);

create index bookings_profile_idx on public.bookings (profile_id, starts_at desc);
create index bookings_staff_day_idx on public.bookings (staff_id, starts_at);
create index bookings_salon_starts_idx on public.bookings (salon_id, starts_at);
create index bookings_status_idx on public.bookings (status);
create index bookings_service_idx on public.bookings (service_id);
create index bookings_reminder_idx on public.bookings (starts_at)
  where status = 'confirmed' and reminder_sent_at is null;

create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

alter table public.slot_holds
  add constraint slot_holds_booking_fk
  foreign key (booking_id) references public.bookings (id) on delete set null;

-- Human-facing reference: PHS-1000, PHS-1001, ...
create or replace function public.generate_booking_reference()
returns trigger
language plpgsql
as $$
begin
  if new.reference is null or new.reference = '' then
    new.reference := 'PHS-' || nextval('public.booking_reference_seq')::text;
  end if;
  return new;
end;
$$;

create trigger bookings_reference
  before insert on public.bookings
  for each row execute function public.generate_booking_reference();

-- ---------------------------------------------------------------------------
-- Line items: the service plus any add-ons, priced as they were on the day.
-- ---------------------------------------------------------------------------

create table public.booking_items (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  addon_id uuid references public.service_addons (id) on delete set null,
  kind text not null check (kind in ('service', 'addon')),
  name text not null, -- snapshot; survives a catalogue rename
  quantity integer not null default 1 check (quantity > 0),
  unit_price_pence integer not null check (unit_price_pence >= 0),
  duration_minutes integer not null default 0 check (duration_minutes >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index booking_items_booking_idx on public.booking_items (booking_id);

create trigger booking_items_set_updated_at
  before update on public.booking_items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Keep the customer's no-show and cancellation counters honest.
-- ---------------------------------------------------------------------------

create or replace function public.sync_profile_booking_counters()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
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

create trigger bookings_sync_counters
  after update on public.bookings
  for each row execute function public.sync_profile_booking_counters();
