-- 0005_schedules.sql
-- Staff working patterns, breaks and time off. Together with opening_hours and
-- blocked_dates these are the inputs the availability engine subtracts
-- existing bookings and holds from.

-- Recurring weekly working pattern. day_of_week is ISO-8601 (1 = Monday).
create table public.staff_schedules (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  starts_at time not null,
  ends_at time not null,
  -- Optional bounded validity, so a pattern change can be scheduled ahead.
  effective_from date,
  effective_to date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_schedules_order check (ends_at > starts_at),
  constraint staff_schedules_effective_order check (
    effective_from is null or effective_to is null or effective_to >= effective_from
  )
);

create index staff_schedules_staff_day_idx
  on public.staff_schedules (staff_id, day_of_week);

create trigger staff_schedules_set_updated_at
  before update on public.staff_schedules
  for each row execute function public.set_updated_at();

-- Recurring within-shift breaks (lunch, admin time).
create table public.staff_breaks (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  starts_at time not null,
  ends_at time not null,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_breaks_order check (ends_at > starts_at)
);

create index staff_breaks_staff_day_idx on public.staff_breaks (staff_id, day_of_week);

create trigger staff_breaks_set_updated_at
  before update on public.staff_breaks
  for each row execute function public.set_updated_at();

-- Dated absence: holiday, sickness, training. Stored as instants because a
-- half-day off needs a time, and because it is compared against bookings.
create table public.staff_time_off (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.staff (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  is_approved boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_time_off_order check (ends_at > starts_at),
  -- One person cannot be off twice at once; overlapping requests are a mistake.
  constraint staff_time_off_no_overlap
    exclude using gist (
      staff_id with =,
      tstzrange(starts_at, ends_at, '[)') with &&
    ) where (is_approved)
);

create index staff_time_off_range_idx
  on public.staff_time_off using gist (tstzrange(starts_at, ends_at, '[)'));
create index staff_time_off_staff_idx on public.staff_time_off (staff_id, starts_at);

create trigger staff_time_off_set_updated_at
  before update on public.staff_time_off
  for each row execute function public.set_updated_at();
