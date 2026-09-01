-- 0010_availability.sql
-- Set-based slot generation.
--
-- is_slot_available() in 0009 answers "is this exact slot free?" and is the
-- authority at write time. This function answers "what is free between these
-- dates?" for the booking UI. It is written as one set-based query rather than
-- a per-slot loop so a 60-day lookup across six stylists stays a single scan.
--
-- Both derive from the same tables, and 0009 re-checks every write, so a stale
-- read here can never produce a double booking -- only a slot that disappears
-- between rendering and clicking, which the UI reports as "just taken".

create or replace function public.available_slots(
  p_service_id uuid,
  p_from date,
  p_to date,
  p_staff_id uuid default null,
  p_extra_minutes integer default 0
)
returns table (
  staff_id uuid,
  staff_name text,
  slot_start timestamptz,
  slot_end timestamptz,
  blocked_until timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with service as (
    select s.id, s.salon_id, s.duration_minutes, s.buffer_minutes
    from public.services s
    where s.id = p_service_id
      and s.is_active
      and s.deleted_at is null
  ),
  salon as (
    select sa.*
    from public.salons sa
    join service sv on sv.salon_id = sa.id
  ),
  -- Stylists who are active, bookable and eligible for this service.
  eligible_staff as (
    select st.id, st.display_name, sv2.duration_override_minutes
    from public.staff st
    join public.staff_services sv2 on sv2.staff_id = st.id
    join service sv on sv.id = sv2.service_id
    where st.is_active
      and st.is_bookable
      and st.deleted_at is null
      and (p_staff_id is null or st.id = p_staff_id)
  ),
  days as (
    select d::date as day
    from generate_series(
      greatest(p_from, (now() at time zone (select timezone from salon))::date),
      least(p_to, ((now() at time zone (select timezone from salon))::date
                   + (select booking_window_days from salon))),
      interval '1 day'
    ) d
  ),
  -- Opening window per day: a blocked_dates row overrides the weekly pattern.
  open_days as (
    select
      d.day,
      coalesce(bd.opens_at, oh.opens_at) as opens_at,
      coalesce(bd.closes_at, oh.closes_at) as closes_at
    from days d
    cross join salon sa
    left join public.blocked_dates bd
      on bd.salon_id = sa.id and bd.date = d.day
    left join public.opening_hours oh
      on oh.salon_id = sa.id
     and oh.day_of_week = extract(isodow from d.day)::smallint
     and not oh.is_closed
    where coalesce(bd.is_closed, false) = false
      and coalesce(bd.opens_at, oh.opens_at) is not null
      and coalesce(bd.closes_at, oh.closes_at) is not null
  ),
  -- Intersect the opening window with each stylist's roster for that weekday.
  windows as (
    select
      es.id as staff_id,
      es.display_name,
      od.day,
      greatest(od.opens_at, sc.starts_at) as window_start,
      least(od.closes_at, sc.ends_at) as window_end,
      coalesce(es.duration_override_minutes, sv.duration_minutes) + p_extra_minutes as duration_minutes,
      sv.buffer_minutes
    from open_days od
    cross join service sv
    join eligible_staff es on true
    join public.staff_schedules sc
      on sc.staff_id = es.id
     and sc.day_of_week = extract(isodow from od.day)::smallint
     and (sc.effective_from is null or sc.effective_from <= od.day)
     and (sc.effective_to is null or sc.effective_to >= od.day)
    where greatest(od.opens_at, sc.starts_at) < least(od.closes_at, sc.ends_at)
  ),
  -- Candidate starts on the salon's slot grid. generate_series has no `time`
  -- overload, so the grid is walked in local timestamps and converted once.
  candidates as (
    select
      w.staff_id,
      w.display_name,
      w.day,
      ts::time as local_start,
      (ts + make_interval(mins => w.duration_minutes + w.buffer_minutes))::time as local_blocked_end,
      ts at time zone sa.timezone as slot_start,
      (ts + make_interval(mins => w.duration_minutes)) at time zone sa.timezone as slot_end,
      (ts + make_interval(mins => w.duration_minutes + w.buffer_minutes))
        at time zone sa.timezone as blocked_until
    from windows w
    cross join salon sa
    cross join lateral generate_series(
      (w.day + w.window_start)::timestamp,
      (w.day + w.window_end)::timestamp
        - make_interval(mins => w.duration_minutes + w.buffer_minutes),
      make_interval(mins => sa.slot_interval_minutes)
    ) as ts
  )
  select
    c.staff_id,
    c.display_name,
    c.slot_start,
    c.slot_end,
    c.blocked_until
  from candidates c
  cross join salon sa
  where
    -- Respect minimum notice.
    c.slot_start >= now() + make_interval(mins => sa.min_notice_minutes)
    -- Not overlapping a recurring break.
    and not exists (
      select 1 from public.staff_breaks b
      where b.staff_id = c.staff_id
        and b.day_of_week = extract(isodow from c.day)::smallint
        and b.starts_at < c.local_blocked_end
        and b.ends_at > c.local_start
    )
    -- Not on approved time off.
    and not exists (
      select 1 from public.staff_time_off o
      where o.staff_id = c.staff_id
        and o.is_approved
        and tstzrange(o.starts_at, o.ends_at, '[)')
            && tstzrange(c.slot_start, c.blocked_until, '[)')
    )
    -- Not overlapping an active booking.
    and not exists (
      select 1 from public.bookings b
      where b.staff_id = c.staff_id
        and b.status in ('pending_payment', 'confirmed', 'completed')
        and tstzrange(b.starts_at, b.blocked_until, '[)')
            && tstzrange(c.slot_start, c.blocked_until, '[)')
    )
    -- Not overlapping a live hold.
    and not exists (
      select 1 from public.slot_holds h
      where h.staff_id = c.staff_id
        and h.consumed_at is null
        and h.expires_at > now()
        and tstzrange(h.starts_at, h.blocked_until, '[)')
            && tstzrange(c.slot_start, c.blocked_until, '[)')
    )
  order by c.slot_start, c.display_name;
$$;

comment on function public.available_slots is
  'Bookable slots between two dates. Read-only and advisory: hold_slot() and '
  'book_slot() re-validate every write against is_slot_available().';

-- Convenience wrapper for the "first available" shortcut and the hero card.
create or replace function public.next_available_slot(
  p_service_id uuid,
  p_staff_id uuid default null
)
returns table (
  staff_id uuid,
  staff_name text,
  slot_start timestamptz,
  slot_end timestamptz,
  blocked_until timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select *
  from public.available_slots(
    p_service_id,
    (now() at time zone 'Europe/London')::date,
    (now() at time zone 'Europe/London')::date + 60,
    p_staff_id
  )
  order by slot_start
  limit 1;
$$;
