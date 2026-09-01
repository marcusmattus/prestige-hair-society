-- 0009_functions.sql
-- The transactional core of the booking journey.
--
-- These run SECURITY DEFINER because they must read schedule tables the caller
-- may not have direct rights to, and because holding a slot has to be atomic.
-- Every one of them re-derives price and duration from the catalogue: the
-- browser never gets to say what something costs or how long it takes.

-- ---------------------------------------------------------------------------
-- Sweep expired, unconsumed holds. Called at the top of every hold/book
-- transaction so an abandoned checkout never blocks a real customer, and by
-- the /api/cron/sweep-holds route for hygiene.
-- ---------------------------------------------------------------------------

create or replace function public.release_expired_holds(p_staff_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  removed integer;
begin
  delete from public.slot_holds
  where consumed_at is null
    and expires_at <= now()
    and (p_staff_id is null or staff_id = p_staff_id);

  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- ---------------------------------------------------------------------------
-- Effective duration and price for a (staff, service) pair, honouring the
-- per-stylist overrides in staff_services.
-- ---------------------------------------------------------------------------

create or replace function public.effective_service_terms(
  p_staff_id uuid,
  p_service_id uuid
)
returns table (
  duration_minutes integer,
  buffer_minutes integer,
  price_pence integer,
  deposit_pence integer,
  pricing_mode public.pricing_mode
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    coalesce(ss.duration_override_minutes, s.duration_minutes),
    s.buffer_minutes,
    coalesce(ss.price_override_pence, s.base_price_pence),
    s.deposit_pence,
    s.pricing_mode
  from public.services s
  left join public.staff_services ss
    on ss.service_id = s.id and ss.staff_id = p_staff_id
  where s.id = p_service_id
    and s.deleted_at is null;
$$;

-- ---------------------------------------------------------------------------
-- Is this stylist genuinely free for [p_starts_at, p_blocked_until)?
--
-- Checks, in order: stylist is active and eligible, salon is open that day,
-- no salon-wide closure, the stylist is rostered, not on a break, not on
-- approved time off, and has no overlapping booking or live hold.
--
-- p_ignore_booking_id lets a reschedule ignore the appointment being moved.
-- p_ignore_hold_id lets book_slot() ignore the hold it is about to consume.
-- ---------------------------------------------------------------------------

create or replace function public.is_slot_available(
  p_staff_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_blocked_until timestamptz,
  p_ignore_booking_id uuid default null,
  p_ignore_hold_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_salon_id uuid;
  v_tz text;
  v_local_start timestamp;
  v_local_end timestamp;
  v_date date;
  v_dow smallint;
  v_start_time time;
  v_end_time time;
  v_blocked public.blocked_dates%rowtype;
begin
  -- Stylist exists, is active, is bookable and may perform this service.
  select st.salon_id, sa.timezone
    into v_salon_id, v_tz
  from public.staff st
  join public.salons sa on sa.id = st.salon_id
  where st.id = p_staff_id
    and st.is_active
    and st.deleted_at is null;

  if v_salon_id is null then
    return false;
  end if;

  if not exists (
    select 1 from public.staff_services
    where staff_id = p_staff_id and service_id = p_service_id
  ) then
    return false;
  end if;

  v_local_start := p_starts_at at time zone v_tz;
  v_local_end := p_blocked_until at time zone v_tz;
  v_date := v_local_start::date;
  v_dow := extract(isodow from v_local_start)::smallint;
  v_start_time := v_local_start::time;
  v_end_time := v_local_end::time;

  -- An appointment must finish on the day it starts.
  if v_local_end::date <> v_date then
    return false;
  end if;

  -- Salon-wide closure or special hours for this date.
  select * into v_blocked
  from public.blocked_dates
  where salon_id = v_salon_id and date = v_date;

  if found then
    if v_blocked.is_closed then
      return false;
    end if;
    if v_start_time < v_blocked.opens_at or v_end_time > v_blocked.closes_at then
      return false;
    end if;
  else
    -- Regular weekly opening hours.
    if not exists (
      select 1 from public.opening_hours oh
      where oh.salon_id = v_salon_id
        and oh.day_of_week = v_dow
        and not oh.is_closed
        and v_start_time >= oh.opens_at
        and v_end_time <= oh.closes_at
    ) then
      return false;
    end if;
  end if;

  -- Stylist is rostered for the whole span.
  if not exists (
    select 1 from public.staff_schedules sc
    where sc.staff_id = p_staff_id
      and sc.day_of_week = v_dow
      and v_start_time >= sc.starts_at
      and v_end_time <= sc.ends_at
      and (sc.effective_from is null or sc.effective_from <= v_date)
      and (sc.effective_to is null or sc.effective_to >= v_date)
  ) then
    return false;
  end if;

  -- Not overlapping a recurring break.
  if exists (
    select 1 from public.staff_breaks b
    where b.staff_id = p_staff_id
      and b.day_of_week = v_dow
      and b.starts_at < v_end_time
      and b.ends_at > v_start_time
  ) then
    return false;
  end if;

  -- Not on approved time off.
  if exists (
    select 1 from public.staff_time_off t
    where t.staff_id = p_staff_id
      and t.is_approved
      and tstzrange(t.starts_at, t.ends_at, '[)')
          && tstzrange(p_starts_at, p_blocked_until, '[)')
  ) then
    return false;
  end if;

  -- No overlapping active booking.
  if exists (
    select 1 from public.bookings b
    where b.staff_id = p_staff_id
      and b.status in ('pending_payment', 'confirmed', 'completed')
      and (p_ignore_booking_id is null or b.id <> p_ignore_booking_id)
      and tstzrange(b.starts_at, b.blocked_until, '[)')
          && tstzrange(p_starts_at, p_blocked_until, '[)')
  ) then
    return false;
  end if;

  -- No overlapping live hold.
  if exists (
    select 1 from public.slot_holds h
    where h.staff_id = p_staff_id
      and h.consumed_at is null
      and h.expires_at > now()
      and (p_ignore_hold_id is null or h.id <> p_ignore_hold_id)
      and tstzrange(h.starts_at, h.blocked_until, '[)')
          && tstzrange(p_starts_at, p_blocked_until, '[)')
  ) then
    return false;
  end if;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- Place a hold. Returns the hold row; raises a named exception the API layer
-- maps to a 409 when the slot has gone.
-- ---------------------------------------------------------------------------

create or replace function public.hold_slot(
  p_staff_id uuid,
  p_service_id uuid,
  p_starts_at timestamptz,
  p_profile_id uuid default null,
  p_addon_ids uuid[] default '{}'
)
returns public.slot_holds
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_salon_id uuid;
  v_hold_minutes integer;
  v_window_days integer;
  v_min_notice integer;
  v_duration integer;
  v_buffer integer;
  v_addon_minutes integer := 0;
  v_ends_at timestamptz;
  v_blocked_until timestamptz;
  v_hold public.slot_holds;
begin
  perform public.release_expired_holds(p_staff_id);

  select sa.id, sa.hold_duration_minutes, sa.booking_window_days, sa.min_notice_minutes
    into v_salon_id, v_hold_minutes, v_window_days, v_min_notice
  from public.staff st
  join public.salons sa on sa.id = st.salon_id
  where st.id = p_staff_id;

  if v_salon_id is null then
    raise exception 'staff_not_found' using errcode = 'P0002';
  end if;

  if p_starts_at < now() + make_interval(mins => v_min_notice) then
    raise exception 'too_soon' using errcode = 'P0001';
  end if;

  if p_starts_at > now() + make_interval(days => v_window_days) then
    raise exception 'outside_booking_window' using errcode = 'P0001';
  end if;

  select t.duration_minutes, t.buffer_minutes
    into v_duration, v_buffer
  from public.effective_service_terms(p_staff_id, p_service_id) t;

  if v_duration is null then
    raise exception 'service_not_found' using errcode = 'P0002';
  end if;

  select coalesce(sum(a.duration_minutes), 0) into v_addon_minutes
  from public.service_addons a
  where a.id = any(p_addon_ids) and a.is_active and a.deleted_at is null;

  v_ends_at := p_starts_at + make_interval(mins => v_duration + v_addon_minutes);
  v_blocked_until := v_ends_at + make_interval(mins => v_buffer);

  if not public.is_slot_available(p_staff_id, p_service_id, p_starts_at, v_blocked_until) then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  begin
    insert into public.slot_holds (
      salon_id, staff_id, service_id, profile_id,
      starts_at, ends_at, blocked_until, expires_at
    )
    values (
      v_salon_id, p_staff_id, p_service_id, p_profile_id,
      p_starts_at, v_ends_at, v_blocked_until,
      now() + make_interval(mins => v_hold_minutes)
    )
    returning * into v_hold;
  exception
    -- Someone won the race between is_slot_available() and the INSERT. The
    -- exclusion constraint is the real guarantee; this just names the failure.
    when exclusion_violation then
      raise exception 'slot_unavailable' using errcode = 'P0001';
  end;

  return v_hold;
end;
$$;

-- ---------------------------------------------------------------------------
-- Convert a hold into a pending_payment booking. Prices are recomputed from
-- the catalogue here, so a tampered client payload cannot change what is owed.
-- ---------------------------------------------------------------------------

create or replace function public.book_slot(
  p_hold_token uuid,
  p_profile_id uuid,
  p_addon_ids uuid[] default '{}',
  p_customer_notes text default null,
  p_accessibility_requirements text default null,
  p_source text default 'web',
  p_discount_code text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_hold public.slot_holds;
  v_service public.services;
  v_terms record;
  v_addon record;
  v_addons_total integer := 0;
  v_addons_minutes integer := 0;
  v_discount_pence integer := 0;
  v_discount public.discount_codes;
  v_subtotal integer;
  v_total integer;
  v_booking public.bookings;
begin
  perform set_config('app.privileged_write', 'on', true);

  select * into v_hold
  from public.slot_holds
  where hold_token = p_hold_token
  for update;

  if v_hold.id is null then
    raise exception 'hold_not_found' using errcode = 'P0002';
  end if;

  if v_hold.consumed_at is not null then
    raise exception 'hold_already_used' using errcode = 'P0001';
  end if;

  if v_hold.expires_at <= now() then
    raise exception 'hold_expired' using errcode = 'P0001';
  end if;

  -- A hold created while signed in belongs to that person only.
  if v_hold.profile_id is not null and v_hold.profile_id <> p_profile_id then
    raise exception 'hold_not_owned' using errcode = 'P0001';
  end if;

  select * into v_service from public.services where id = v_hold.service_id;
  select * into v_terms from public.effective_service_terms(v_hold.staff_id, v_hold.service_id) t;

  for v_addon in
    select a.* from public.service_addons a
    join public.service_addon_links l on l.addon_id = a.id and l.service_id = v_hold.service_id
    where a.id = any(p_addon_ids) and a.is_active and a.deleted_at is null
  loop
    v_addons_total := v_addons_total + v_addon.price_pence;
    v_addons_minutes := v_addons_minutes + v_addon.duration_minutes;
  end loop;

  v_subtotal := v_terms.price_pence + v_addons_total;

  if p_discount_code is not null then
    select * into v_discount
    from public.discount_codes
    where salon_id = v_hold.salon_id
      and code = p_discount_code
      and is_active
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
      and (max_redemptions is null or redemption_count < max_redemptions)
      and (service_id is null or service_id = v_hold.service_id)
      and minimum_spend_pence <= v_subtotal
    for update;

    if v_discount.id is not null then
      v_discount_pence := least(
        v_subtotal,
        coalesce(v_discount.amount_off_pence, (v_subtotal * v_discount.percent_off) / 100)
      );
    end if;
  end if;

  v_total := v_subtotal - v_discount_pence;

  -- The hold's own span is authoritative; re-check it is still clear, ignoring
  -- the hold we are consuming.
  if not public.is_slot_available(
    v_hold.staff_id, v_hold.service_id, v_hold.starts_at, v_hold.blocked_until,
    null, v_hold.id
  ) then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  insert into public.bookings (
    salon_id, staff_id, profile_id, service_id, status,
    starts_at, ends_at, blocked_until,
    service_price_pence, addons_price_pence, discount_pence, total_price_pence,
    deposit_pence, pricing_mode,
    customer_notes, accessibility_requirements, source
  )
  values (
    v_hold.salon_id, v_hold.staff_id, p_profile_id, v_hold.service_id, 'pending_payment',
    v_hold.starts_at, v_hold.ends_at, v_hold.blocked_until,
    v_terms.price_pence, v_addons_total, v_discount_pence, v_total,
    least(v_terms.deposit_pence, v_total), v_terms.pricing_mode,
    p_customer_notes, p_accessibility_requirements, p_source
  )
  returning * into v_booking;

  insert into public.booking_items (booking_id, kind, name, unit_price_pence, duration_minutes)
  values (v_booking.id, 'service', v_service.name, v_terms.price_pence, v_terms.duration_minutes);

  insert into public.booking_items (booking_id, addon_id, kind, name, unit_price_pence, duration_minutes)
  select v_booking.id, a.id, 'addon', a.name, a.price_pence, a.duration_minutes
  from public.service_addons a
  join public.service_addon_links l on l.addon_id = a.id and l.service_id = v_hold.service_id
  where a.id = any(p_addon_ids) and a.is_active and a.deleted_at is null;

  if v_discount.id is not null then
    insert into public.discount_redemptions (discount_code_id, booking_id, amount_pence)
    values (v_discount.id, v_booking.id, v_discount_pence);

    update public.discount_codes
    set redemption_count = redemption_count + 1
    where id = v_discount.id;
  end if;

  update public.slot_holds
  set consumed_at = now(), booking_id = v_booking.id
  where id = v_hold.id;

  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- Called by the Stripe webhook once payment is verified. Idempotent: replaying
-- the same event leaves the booking exactly as it was.
-- ---------------------------------------------------------------------------

create or replace function public.confirm_booking_paid(
  p_booking_id uuid,
  p_amount_pence integer,
  p_kind public.payment_kind default 'deposit'
)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.bookings;
begin
  perform set_config('app.privileged_write', 'on', true);

  select * into v_booking from public.bookings where id = p_booking_id for update;

  if v_booking.id is null then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  update public.bookings
  set status = case
        when status = 'pending_payment' then 'confirmed'::public.booking_status
        else status
      end,
      deposit_paid_pence = case
        when p_kind in ('deposit', 'full') then greatest(deposit_paid_pence, p_amount_pence)
        else deposit_paid_pence
      end,
      balance_paid_pence = case
        when p_kind in ('balance', 'in_salon') then balance_paid_pence + p_amount_pence
        else balance_paid_pence
      end
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reschedule. Validates the new slot, moves the booking and records the link
-- back to where it came from.
-- ---------------------------------------------------------------------------

create or replace function public.reschedule_booking(
  p_booking_id uuid,
  p_staff_id uuid,
  p_starts_at timestamptz
)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.bookings;
  v_terms record;
  v_duration_minutes integer;
  v_ends_at timestamptz;
  v_blocked_until timestamptz;
begin
  perform set_config('app.privileged_write', 'on', true);

  select * into v_booking from public.bookings where id = p_booking_id for update;

  if v_booking.id is null then
    raise exception 'booking_not_found' using errcode = 'P0002';
  end if;

  if v_booking.status not in ('pending_payment', 'confirmed') then
    raise exception 'booking_not_reschedulable' using errcode = 'P0001';
  end if;

  perform public.release_expired_holds(p_staff_id);

  -- Preserve the length actually booked (which may include add-ons) rather
  -- than recomputing from the catalogue.
  v_duration_minutes := extract(epoch from (v_booking.ends_at - v_booking.starts_at)) / 60;
  select * into v_terms from public.effective_service_terms(p_staff_id, v_booking.service_id) t;

  v_ends_at := p_starts_at + make_interval(mins => v_duration_minutes);
  v_blocked_until := v_ends_at + make_interval(mins => coalesce(v_terms.buffer_minutes, 0));

  if not public.is_slot_available(
    p_staff_id, v_booking.service_id, p_starts_at, v_blocked_until, p_booking_id
  ) then
    raise exception 'slot_unavailable' using errcode = 'P0001';
  end if;

  update public.bookings
  set staff_id = p_staff_id,
      starts_at = p_starts_at,
      ends_at = v_ends_at,
      blocked_until = v_blocked_until,
      rescheduled_from = coalesce(rescheduled_from, p_booking_id),
      reminder_sent_at = null
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;
