-- 0002_identity.sql
-- Profiles (one per auth user), role assignments and the role-checking helpers
-- that every RLS policy in 0011_rls.sql is built on.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email citext not null,
  first_name text not null default '',
  last_name text not null default '',
  phone text,
  birthday date,
  -- Customer-supplied hair context. Visible to the customer and to staff.
  hair_goals text,
  accessibility_requirements text,
  -- Voluntarily supplied. Treated as special-category data: see PRIVACY.md.
  allergies text,
  favourite_staff_id uuid, -- FK added in 0004 once staff exists
  marketing_email boolean not null default false,
  marketing_sms boolean not null default false,
  reminder_email boolean not null default true,
  reminder_sms boolean not null default true,
  -- Denormalised counters maintained by triggers in 0006.
  no_show_count integer not null default 0 check (no_show_count >= 0),
  cancellation_count integer not null default 0 check (cancellation_count >= 0),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_phone_format check (
    phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$'
  )
);

create unique index profiles_email_key on public.profiles (email) where deleted_at is null;
create index profiles_last_name_idx on public.profiles (last_name);
create index profiles_created_at_idx on public.profiles (created_at desc);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

comment on column public.profiles.allergies is
  'Voluntarily supplied health information. Never exposed to unauthenticated readers.';

-- ---------------------------------------------------------------------------
-- Role assignments. A person may hold several roles (a manager who also cuts
-- hair is both "manager" and "stylist"), so this is a join table rather than a
-- column on profiles.
-- ---------------------------------------------------------------------------

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.user_role not null,
  granted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, role)
);

create index user_roles_user_id_idx on public.user_roles (user_id);
create index user_roles_role_idx on public.user_roles (role);

create trigger user_roles_set_updated_at
  before update on public.user_roles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Role helpers.
--
-- These are SECURITY DEFINER so that RLS policies on user_roles cannot recurse
-- into themselves, and are marked STABLE so the planner can cache them per
-- statement. search_path is pinned to defeat search_path hijacking.
-- ---------------------------------------------------------------------------

create or replace function public.has_role(target_role public.user_role)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = target_role
  );
$$;

create or replace function public.has_any_role(target_roles public.user_role[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role = any(target_roles)
  );
$$;

-- "Can act on salon operations": receptionist, manager or admin.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_any_role(
    array['stylist', 'receptionist', 'manager', 'admin']::public.user_role[]
  );
$$;

create or replace function public.is_manager()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_any_role(array['manager', 'admin']::public.user_role[]);
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.has_role('admin'::public.user_role);
$$;

-- ---------------------------------------------------------------------------
-- Every new auth user gets a profile and the 'customer' role. Booking as a
-- guest still creates an auth user, so this is the single entry point.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, phone)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'first_name', ''),
    coalesce(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
