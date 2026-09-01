-- 0003_salon.sql
-- Salon locations, their opening hours and salon-wide closures, plus the
-- settings an administrator can change without a deploy.

create table public.salons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  postcode text not null,
  country_code text not null default 'GB' check (char_length(country_code) = 2),
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  phone text,
  email citext,
  timezone text not null default 'Europe/London',
  currency char(3) not null default 'GBP',

  -- Booking policy. All durations in minutes, all money in pence.
  booking_window_days integer not null default 60 check (booking_window_days between 1 and 365),
  min_notice_minutes integer not null default 120 check (min_notice_minutes >= 0),
  cancellation_window_hours integer not null default 24 check (cancellation_window_hours >= 0),
  reschedule_window_hours integer not null default 24 check (reschedule_window_hours >= 0),
  slot_interval_minutes integer not null default 15 check (slot_interval_minutes in (5, 10, 15, 20, 30, 60)),
  hold_duration_minutes integer not null default 10 check (hold_duration_minutes between 1 and 60),
  deposit_required boolean not null default true,
  allow_full_payment boolean not null default true,

  -- Marketing / SEO fields an administrator can edit.
  tagline text,
  about text,
  instagram_url text,
  facebook_url text,
  google_maps_url text,

  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger salons_set_updated_at
  before update on public.salons
  for each row execute function public.set_updated_at();

comment on column public.salons.timezone is
  'IANA timezone. All timestamps are stored UTC and rendered in this zone.';

-- ---------------------------------------------------------------------------
-- Regular weekly opening hours. day_of_week follows ISO-8601: 1 = Monday.
-- A day with no row (or is_closed) is closed.
-- ---------------------------------------------------------------------------

create table public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7),
  opens_at time not null,
  closes_at time not null,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, day_of_week),
  constraint opening_hours_order check (is_closed or closes_at > opens_at)
);

create trigger opening_hours_set_updated_at
  before update on public.opening_hours
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- One-off closures and special hours (bank holidays, private events).
-- A row with is_closed = true blocks the whole day.
-- ---------------------------------------------------------------------------

create table public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  date date not null,
  is_closed boolean not null default true,
  opens_at time,
  closes_at time,
  reason text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, date),
  constraint blocked_dates_hours check (
    is_closed
    or (opens_at is not null and closes_at is not null and closes_at > opens_at)
  )
);

create index blocked_dates_salon_date_idx on public.blocked_dates (salon_id, date);

create trigger blocked_dates_set_updated_at
  before update on public.blocked_dates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Key/value settings that do not deserve their own column yet (integration
-- toggles, analytics consent defaults, template overrides).
-- ---------------------------------------------------------------------------

create table public.salon_settings (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  key text not null,
  value jsonb not null default '{}'::jsonb,
  description text,
  -- Settings marked sensitive are never returned to non-admin clients.
  is_sensitive boolean not null default false,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, key)
);

create trigger salon_settings_set_updated_at
  before update on public.salon_settings
  for each row execute function public.set_updated_at();
