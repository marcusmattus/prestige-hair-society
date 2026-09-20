-- 0014_memberships.sql
-- Purchased memberships / programmes and their visit progress.
--
-- Rows are written by the Stripe webhook (service role). A membership may be
-- bought as a guest, so profile_id is nullable and is claimed by email the
-- first time the buyer signs in. Money is tracked in pence; Stripe remains the
-- source of truth for payment state.

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  -- Nullable until claimed by the signed-in buyer (matched on email).
  profile_id uuid references public.profiles (id) on delete set null,
  email citext not null,

  programme_id text not null,
  programme_name text not null,
  category text,
  tier text not null check (tier in ('short', 'medium', 'long')),
  payment text not null check (payment in ('full', 'monthly')),
  status text not null default 'active'
    check (status in ('active', 'past_due', 'cancelled', 'completed')),

  total_pence integer not null check (total_pence >= 0),
  amount_now_pence integer not null default 0 check (amount_now_pence >= 0),
  months integer check (months is null or months > 0),

  included_visits integer not null default 0 check (included_visits >= 0),
  completed_visits integer not null default 0 check (completed_visits >= 0),
  next_visit_at timestamptz,

  booking_reference text,
  -- Idempotency: one membership per checkout session.
  stripe_checkout_session_id text unique,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_payment_intent_id text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint memberships_completed_within_included
    check (completed_visits <= included_visits)
);

create index memberships_profile_idx on public.memberships (profile_id, created_at desc);
-- Speeds the "claim by email" lookup for still-unclaimed guest purchases.
create index memberships_unclaimed_email_idx on public.memberships (email)
  where profile_id is null;

create trigger memberships_set_updated_at
  before update on public.memberships
  for each row execute function public.set_updated_at();

comment on table public.memberships is
  'Purchased programmes. Written by the Stripe webhook; claimed to a profile by email on first sign-in.';

-- ---------------------------------------------------------------------------
-- RLS: a customer sees only their own claimed memberships; staff read all;
-- managers may correct visit counts and status. The service role (webhook)
-- bypasses RLS entirely.
-- ---------------------------------------------------------------------------

alter table public.memberships enable row level security;

create policy memberships_self_read on public.memberships
  for select using (profile_id = auth.uid());

create policy memberships_staff_read on public.memberships
  for select using (public.is_staff());

create policy memberships_manager_write on public.memberships
  for all using (public.is_manager()) with check (public.is_manager());
