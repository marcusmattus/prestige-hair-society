-- 0013_operations.sql
-- Three operational needs the salon raised once the real catalogue arrived:
--
--   1. Mark catalogue rows whose duration or deposit is still an estimate, so
--      an unverified figure is visible in Studio rather than silently trusted.
--   2. A private, subscribable calendar feed, so the owner sees the day's
--      appointments in the calendar app on their phone.
--   3. An alert to the salon the moment somebody books.

-- ---------------------------------------------------------------------------
-- 1. Catalogue review flag
-- ---------------------------------------------------------------------------

alter table public.services
  add column if not exists needs_review boolean not null default false;

comment on column public.services.needs_review is
  'True when a figure on this row -- usually duration or deposit -- is an '
  'estimate awaiting confirmation from the salon. Surfaced in /studio/services.';

create index if not exists services_needs_review_idx
  on public.services (salon_id)
  where needs_review and deleted_at is null;

-- ---------------------------------------------------------------------------
-- 2. Calendar subscription tokens
--
-- A calendar app cannot carry a session cookie, so the feed URL is the
-- credential. The token is therefore separate from every other identifier,
-- unguessable, and revocable on its own by rotating it.
-- ---------------------------------------------------------------------------

alter table public.staff
  add column if not exists calendar_token uuid not null default gen_random_uuid();

alter table public.salons
  add column if not exists calendar_token uuid not null default gen_random_uuid();

create unique index if not exists staff_calendar_token_key
  on public.staff (calendar_token);

create unique index if not exists salons_calendar_token_key
  on public.salons (calendar_token);

comment on column public.staff.calendar_token is
  'Bearer secret in the .ics feed URL. Rotate to revoke a device. Never '
  'exposed to anon; the feed route reads it with the service role.';

-- The token must not leak through the public staff listing. RLS cannot hide a
-- column, so revoke the column grant instead: anon and authenticated keep
-- SELECT on the table, minus this one column.
revoke select (calendar_token) on public.staff from anon, authenticated;
revoke select (calendar_token) on public.salons from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Booking alerts to the salon
-- ---------------------------------------------------------------------------

alter table public.salons
  add column if not exists notification_email citext,
  add column if not exists notify_on_booking boolean not null default true,
  add column if not exists notify_on_cancellation boolean not null default true;

comment on column public.salons.notification_email is
  'Where booking alerts go. Falls back to salons.email when unset; when both '
  'are unset no alert is sent and the reason is logged.';

-- 'staff_booking_alert' joins the message_kind enum so alerts flow through the
-- same idempotent delivery ledger as customer mail: one alert per booking,
-- however many times a webhook is replayed.
alter type public.message_kind add value if not exists 'staff_booking_alert';
alter type public.message_kind add value if not exists 'staff_cancellation_alert';
