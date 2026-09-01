-- 0007_payments.sql
-- Payments, refunds, gift cards and discount codes.
--
-- Stripe is the source of truth for money movement: rows here are written by
-- the webhook handler, never by the browser. No card data is ever stored --
-- only Stripe identifiers and the last four digits Stripe reports back.

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.bookings (id) on delete restrict,
  profile_id uuid not null references public.profiles (id) on delete restrict,
  salon_id uuid not null references public.salons (id) on delete restrict,

  kind public.payment_kind not null,
  status public.payment_status not null default 'requires_payment',

  amount_pence integer not null check (amount_pence >= 0),
  refunded_pence integer not null default 0 check (refunded_pence >= 0),
  currency char(3) not null default 'GBP',

  -- Stripe identifiers. payment_intent_id is unique so a replayed webhook
  -- cannot create a second row for the same intent.
  stripe_payment_intent_id text unique,
  stripe_charge_id text,
  stripe_customer_id text,
  payment_method_brand text,
  payment_method_last4 char(4),
  receipt_url text,

  -- Recorded by staff for cash / card-in-salon settlement.
  recorded_by_staff_id uuid references public.staff (id) on delete set null,
  notes text,

  failure_code text,
  failure_message text,
  paid_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint payments_refund_within_amount check (refunded_pence <= amount_pence),
  -- Anything that is not settled in salon must be traceable to a Stripe intent.
  constraint payments_stripe_reference check (
    kind = 'in_salon' or stripe_payment_intent_id is not null
  )
);

create index payments_booking_idx on public.payments (booking_id);
create index payments_profile_idx on public.payments (profile_id, created_at desc);
create index payments_status_idx on public.payments (status);
create index payments_salon_paid_idx on public.payments (salon_id, paid_at desc);

create trigger payments_set_updated_at
  before update on public.payments
  for each row execute function public.set_updated_at();

comment on table public.payments is
  'Written by the Stripe webhook handler. The browser redirect is never trusted.';

-- ---------------------------------------------------------------------------
-- Refunds
-- ---------------------------------------------------------------------------

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments (id) on delete restrict,
  booking_id uuid references public.bookings (id) on delete set null,
  amount_pence integer not null check (amount_pence > 0),
  reason text,
  stripe_refund_id text unique,
  status public.payment_status not null default 'processing',
  issued_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index refunds_payment_idx on public.refunds (payment_id);

create trigger refunds_set_updated_at
  before update on public.refunds
  for each row execute function public.set_updated_at();

-- Keep payments.refunded_pence in step with the refunds ledger.
create or replace function public.sync_payment_refund_total()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_payment uuid := coalesce(new.payment_id, old.payment_id);
  total integer;
begin
  select coalesce(sum(amount_pence), 0) into total
  from public.refunds
  where payment_id = target_payment
    and status in ('succeeded', 'processing');

  update public.payments p
  set refunded_pence = total,
      status = case
        when total = 0 then p.status
        when total >= p.amount_pence then 'refunded'::public.payment_status
        else 'partially_refunded'::public.payment_status
      end
  where p.id = target_payment;

  return null;
end;
$$;

create trigger refunds_sync_totals
  after insert or update or delete on public.refunds
  for each row execute function public.sync_payment_refund_total();

-- ---------------------------------------------------------------------------
-- Gift cards and discount codes
-- ---------------------------------------------------------------------------

create table public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  code citext not null unique,
  initial_balance_pence integer not null check (initial_balance_pence > 0),
  balance_pence integer not null check (balance_pence >= 0),
  purchaser_profile_id uuid references public.profiles (id) on delete set null,
  recipient_email citext,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint gift_cards_balance_within_initial check (balance_pence <= initial_balance_pence)
);

create trigger gift_cards_set_updated_at
  before update on public.gift_cards
  for each row execute function public.set_updated_at();

create table public.gift_card_redemptions (
  id uuid primary key default gen_random_uuid(),
  gift_card_id uuid not null references public.gift_cards (id) on delete restrict,
  booking_id uuid references public.bookings (id) on delete set null,
  amount_pence integer not null check (amount_pence > 0),
  created_at timestamptz not null default now()
);

create index gift_card_redemptions_card_idx on public.gift_card_redemptions (gift_card_id);

create table public.discount_codes (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  code citext not null,
  description text,
  -- Exactly one of the two discount shapes must be set.
  percent_off smallint check (percent_off between 1 and 100),
  amount_off_pence integer check (amount_off_pence > 0),
  minimum_spend_pence integer not null default 0 check (minimum_spend_pence >= 0),
  -- NULL = applies to every service.
  service_id uuid references public.services (id) on delete cascade,
  max_redemptions integer check (max_redemptions > 0),
  redemption_count integer not null default 0 check (redemption_count >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, code),
  constraint discount_codes_one_shape check (
    (percent_off is not null and amount_off_pence is null)
    or (percent_off is null and amount_off_pence is not null)
  ),
  constraint discount_codes_window check (
    starts_at is null or ends_at is null or ends_at > starts_at
  )
);

create trigger discount_codes_set_updated_at
  before update on public.discount_codes
  for each row execute function public.set_updated_at();

create table public.discount_redemptions (
  id uuid primary key default gen_random_uuid(),
  discount_code_id uuid not null references public.discount_codes (id) on delete restrict,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  amount_pence integer not null check (amount_pence >= 0),
  created_at timestamptz not null default now(),
  -- A code can only be applied once per booking.
  unique (discount_code_id, booking_id)
);
