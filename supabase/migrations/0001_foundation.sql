-- 0001_foundation.sql
-- Extensions, enum types and shared helper functions.
--
-- Conventions used throughout these migrations:
--   * All money is stored as INTEGER pence (GBP). Never floats.
--   * All instants are TIMESTAMPTZ stored in UTC; the salon's display timezone
--     lives in salons.timezone and is applied at the edges only.
--   * Every table carries created_at / updated_at; updated_at is maintained by
--     the set_updated_at() trigger.
--   * Tables that must survive deletion for audit or financial reasons use a
--     nullable deleted_at (soft delete) instead of hard DELETE.

create extension if not exists "pgcrypto"; -- gen_random_uuid()
create extension if not exists "btree_gist"; -- exclusion constraints on (uuid, range)
create extension if not exists "citext"; -- case-insensitive email

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.user_role as enum (
  'customer',
  'stylist',
  'receptionist',
  'manager',
  'admin'
);

create type public.booking_status as enum (
  'pending_payment', -- hold consumed, awaiting Stripe webhook
  'confirmed',
  'completed',
  'cancelled_by_customer',
  'cancelled_by_salon',
  'no_show'
);

create type public.payment_status as enum (
  'requires_payment',
  'processing',
  'succeeded',
  'failed',
  'refunded',
  'partially_refunded',
  'disputed'
);

create type public.payment_kind as enum (
  'deposit',
  'balance',
  'full',
  'in_salon' -- recorded by staff, settled outside Stripe
);

create type public.pricing_mode as enum (
  'fixed', -- price is exact
  'from' -- price is a starting point, final price set in salon
);

create type public.message_channel as enum ('email', 'sms');

create type public.message_kind as enum (
  'booking_confirmation',
  'deposit_receipt',
  'appointment_reminder',
  'reschedule_confirmation',
  'cancellation_confirmation',
  'waitlist_availability',
  'payment_failure',
  'refund_confirmation',
  'post_appointment_thanks',
  'review_request',
  'rebooking_reminder'
);

create type public.message_delivery_status as enum (
  'queued',
  'sent',
  'delivered',
  'failed',
  'skipped' -- suppressed by consent or preference
);

create type public.consent_kind as enum (
  'marketing_email',
  'marketing_sms',
  'photo_publication',
  'terms',
  'privacy'
);

create type public.time_of_day as enum ('morning', 'afternoon', 'evening');

create type public.waitlist_status as enum (
  'active',
  'offered',
  'converted',
  'expired',
  'cancelled'
);

create type public.import_status as enum (
  'draft',
  'previewed',
  'applied',
  'rolled_back',
  'failed'
);

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

comment on function public.set_updated_at is
  'Trigger function maintaining updated_at on every UPDATE.';

-- unaccent is not guaranteed on every Supabase project tier, so fold the small
-- set of characters we actually need rather than depending on the extension.
create or replace function public.unaccent_fallback(input text)
returns text
language sql
immutable
strict
as $$
  select translate(
    input,
    'àáâãäåçèéêëìíîïñòóôõöùúûüýÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝ',
    'aaaaaaceeeeiiiinooooouuuuyAAAAAACEEEEIIIINOOOOOUUUUY'
  );
$$;

-- Slugs are used in public URLs (/services/[slug]); keep them predictable.
create or replace function public.slugify(input text)
returns text
language sql
immutable
strict
as $$
  select trim(
    both '-' from
    regexp_replace(lower(public.unaccent_fallback(input)), '[^a-z0-9]+', '-', 'g')
  );
$$;
