-- 0004_catalogue.sql
-- Service categories, services, add-ons, staff profiles and staff eligibility.
--
-- Every field an administrator needs to change lives here as data, so the
-- catalogue is editable from /studio/services without touching code.

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, slug)
);

create index service_categories_order_idx
  on public.service_categories (salon_id, display_order)
  where deleted_at is null;

create trigger service_categories_set_updated_at
  before update on public.service_categories
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Services
-- ---------------------------------------------------------------------------

create table public.services (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  category_id uuid references public.service_categories (id) on delete set null,
  name text not null,
  slug text not null,
  description text not null default '',
  short_description text,
  preparation_instructions text,
  aftercare_instructions text,

  -- Timing, in minutes. duration is chair time; buffer is the cleanup /
  -- processing tail that blocks the stylist but is not billed as chair time.
  duration_minutes integer not null check (duration_minutes between 5 and 600),
  buffer_minutes integer not null default 0 check (buffer_minutes between 0 and 240),

  -- Money, in pence.
  base_price_pence integer not null check (base_price_pence >= 0),
  pricing_mode public.pricing_mode not null default 'fixed',
  deposit_pence integer not null default 0 check (deposit_pence >= 0),

  -- Policy overrides. NULL falls back to the salon-level policy.
  cancellation_window_hours integer check (cancellation_window_hours >= 0),
  requires_consultation boolean not null default false,

  -- Rebooking cadence, used by the rebooking reminder job.
  rebooking_interval_days integer check (rebooking_interval_days between 1 and 365),

  image_url text,
  image_alt text,
  display_order integer not null default 0,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (salon_id, slug),
  -- A deposit larger than the price would leave a negative in-salon balance.
  constraint services_deposit_within_price check (deposit_pence <= base_price_pence)
);

create index services_category_idx on public.services (category_id) where deleted_at is null;
create index services_active_idx on public.services (salon_id, is_active) where deleted_at is null;
create index services_featured_idx on public.services (salon_id, display_order)
  where is_featured and is_active and deleted_at is null;

create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

comment on column public.services.base_price_pence is
  'Starting price in pence. Placeholder until the verified Slick catalogue is imported.';

-- ---------------------------------------------------------------------------
-- Add-ons, attachable to specific services.
-- ---------------------------------------------------------------------------

create table public.service_addons (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  duration_minutes integer not null default 0 check (duration_minutes between 0 and 240),
  price_pence integer not null default 0 check (price_pence >= 0),
  display_order integer not null default 0,
  is_active boolean not null default true,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, slug)
);

create trigger service_addons_set_updated_at
  before update on public.service_addons
  for each row execute function public.set_updated_at();

create table public.service_addon_links (
  service_id uuid not null references public.services (id) on delete cascade,
  addon_id uuid not null references public.service_addons (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (service_id, addon_id)
);

-- ---------------------------------------------------------------------------
-- Staff
-- ---------------------------------------------------------------------------

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  -- NULL for staff who have not been given a login yet.
  profile_id uuid unique references public.profiles (id) on delete set null,
  display_name text not null,
  slug text not null,
  title text, -- "Senior stylist", "Colour specialist"
  bio text,
  specialties text[] not null default '{}',
  image_url text,
  image_alt text,
  -- Accepts bookings from the public site. Staff who only take walk-ins are
  -- bookable = false but still appear on the studio calendar.
  is_bookable boolean not null default true,
  is_active boolean not null default true,
  display_order integer not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, slug)
);

create index staff_active_idx on public.staff (salon_id, is_active) where deleted_at is null;

create trigger staff_set_updated_at
  before update on public.staff
  for each row execute function public.set_updated_at();

-- profiles.favourite_staff_id could not be constrained until staff existed.
alter table public.profiles
  add constraint profiles_favourite_staff_fk
  foreign key (favourite_staff_id) references public.staff (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Which staff may deliver which service. A service with no eligible staff is
-- not bookable; the availability engine treats the empty set as "nobody".
-- ---------------------------------------------------------------------------

create table public.staff_services (
  staff_id uuid not null references public.staff (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  -- Optional per-stylist overrides (a senior stylist may be quicker, or dearer).
  duration_override_minutes integer check (duration_override_minutes between 5 and 600),
  price_override_pence integer check (price_override_pence >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (staff_id, service_id)
);

create index staff_services_service_idx on public.staff_services (service_id);

create trigger staff_services_set_updated_at
  before update on public.staff_services
  for each row execute function public.set_updated_at();
