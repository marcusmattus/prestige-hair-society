-- 0008_crm.sql
-- Client relationship records, consent, messaging, waiting list, imports and
-- the audit log.

-- ---------------------------------------------------------------------------
-- Internal staff notes. These are never exposed to the customer portal; RLS in
-- 0011 restricts SELECT to staff roles.
-- ---------------------------------------------------------------------------

create table public.client_notes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null check (length(trim(body)) > 0),
  -- 'note' is free text; 'formula' and 'product' are structured enough to
  -- surface on the chair-side view.
  kind text not null default 'note' check (kind in ('note', 'formula', 'product', 'complaint')),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_notes_profile_idx on public.client_notes (profile_id, created_at desc)
  where deleted_at is null;

create trigger client_notes_set_updated_at
  before update on public.client_notes
  for each row execute function public.set_updated_at();

comment on table public.client_notes is
  'Staff-only. Must never appear in /account. Enforced by RLS, not by the UI.';

-- ---------------------------------------------------------------------------
-- Tags
-- ---------------------------------------------------------------------------

create table public.client_tags (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  name text not null,
  colour text not null default '#8F9B7B',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, name)
);

create table public.client_tag_links (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  tag_id uuid not null references public.client_tags (id) on delete cascade,
  applied_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (profile_id, tag_id)
);

-- ---------------------------------------------------------------------------
-- Consent records. Photo publication in particular must be provable, so each
-- grant and withdrawal is a row rather than a boolean.
-- ---------------------------------------------------------------------------

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  kind public.consent_kind not null,
  granted boolean not null,
  -- What the customer actually agreed to, for evidential value.
  document_version text,
  source text not null default 'web' check (source in ('web', 'studio', 'import', 'email')),
  ip_address inet,
  user_agent text,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index consent_records_profile_kind_idx
  on public.consent_records (profile_id, kind, created_at desc);

-- ---------------------------------------------------------------------------
-- Before / after photography. A photo may only be published when a matching
-- granted photo_publication consent exists; enforced in application code and
-- checked by the publish endpoint.
-- ---------------------------------------------------------------------------

create table public.client_photos (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  booking_id uuid references public.bookings (id) on delete set null,
  storage_path text not null,
  kind text not null check (kind in ('before', 'after')),
  caption text,
  service_id uuid references public.services (id) on delete set null,
  consent_record_id uuid references public.consent_records (id) on delete set null,
  is_published boolean not null default false,
  uploaded_by uuid references public.profiles (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Publication without a recorded consent is a data-protection incident.
  constraint client_photos_consent_required check (
    not is_published or consent_record_id is not null
  )
);

create index client_photos_profile_idx on public.client_photos (profile_id)
  where deleted_at is null;
create index client_photos_published_idx on public.client_photos (created_at desc)
  where is_published and deleted_at is null;

create trigger client_photos_set_updated_at
  before update on public.client_photos
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Messaging: editable templates and an idempotent delivery ledger.
-- ---------------------------------------------------------------------------

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  kind public.message_kind not null,
  channel public.message_channel not null,
  subject text, -- email only
  body text not null,
  is_active boolean not null default true,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_id, kind, channel)
);

create trigger message_templates_set_updated_at
  before update on public.message_templates
  for each row execute function public.set_updated_at();

comment on column public.message_templates.body is
  'Mustache-style {{placeholders}} rendered by src/lib/comms/render.ts.';

-- The delivery ledger. idempotency_key is the mechanism that stops a retried
-- cron run or a replayed webhook sending a customer the same message twice.
create table public.message_deliveries (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  template_id uuid references public.message_templates (id) on delete set null,
  kind public.message_kind not null,
  channel public.message_channel not null,
  status public.message_delivery_status not null default 'queued',

  idempotency_key text not null,
  recipient text not null, -- email address or E.164 number at send time
  subject text,
  body text not null,

  provider text, -- 'resend' | 'twilio'
  provider_message_id text,
  error_message text,
  scheduled_for timestamptz,
  sent_at timestamptz,
  attempts integer not null default 0 check (attempts >= 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (idempotency_key)
);

create index message_deliveries_booking_idx on public.message_deliveries (booking_id);
create index message_deliveries_due_idx on public.message_deliveries (scheduled_for)
  where status = 'queued';
create index message_deliveries_profile_idx
  on public.message_deliveries (profile_id, created_at desc);

create trigger message_deliveries_set_updated_at
  before update on public.message_deliveries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Waiting list
-- ---------------------------------------------------------------------------

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  service_id uuid not null references public.services (id) on delete cascade,
  -- NULL means "any available stylist".
  staff_id uuid references public.staff (id) on delete set null,
  earliest_date date not null,
  latest_date date not null,
  times_of_day public.time_of_day[] not null default '{morning,afternoon,evening}',
  status public.waitlist_status not null default 'active',
  -- Set when a matching slot is offered; the offer link expires with it.
  offered_at timestamptz,
  offer_expires_at timestamptz,
  offered_slot_starts_at timestamptz,
  offered_staff_id uuid references public.staff (id) on delete set null,
  offer_token uuid,
  converted_booking_id uuid references public.bookings (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint waitlist_date_order check (latest_date >= earliest_date),
  constraint waitlist_times_not_empty check (array_length(times_of_day, 1) > 0)
);

create unique index waitlist_offer_token_key on public.waitlist_entries (offer_token)
  where offer_token is not null;
create index waitlist_matching_idx
  on public.waitlist_entries (salon_id, service_id, status, earliest_date, latest_date)
  where status = 'active';

create trigger waitlist_entries_set_updated_at
  before update on public.waitlist_entries
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Slick import runs
-- ---------------------------------------------------------------------------

create table public.import_runs (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,
  kind text not null check (kind in ('services', 'categories', 'staff', 'customers', 'appointments', 'opening_hours')),
  status public.import_status not null default 'draft',
  source_filename text,
  field_mapping jsonb not null default '{}'::jsonb,
  -- Row-level outcomes, so a validation report can be rendered without
  -- re-parsing the upload.
  report jsonb not null default '{}'::jsonb,
  total_rows integer not null default 0 check (total_rows >= 0),
  valid_rows integer not null default 0 check (valid_rows >= 0),
  imported_rows integer not null default 0 check (imported_rows >= 0),
  duplicate_rows integer not null default 0 check (duplicate_rows >= 0),
  error_rows integer not null default 0 check (error_rows >= 0),
  -- Ids created by this run, so it can be rolled back.
  created_record_ids uuid[] not null default '{}',
  applied_at timestamptz,
  rolled_back_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger import_runs_set_updated_at
  before update on public.import_runs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit log for sensitive staff actions.
-- ---------------------------------------------------------------------------

create table public.audit_logs (
  id bigserial primary key,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_email citext,
  action text not null,
  entity_type text not null,
  entity_id text,
  -- Redacted before write by src/lib/audit.ts: never store card data,
  -- full tokens or unrelated personal data here.
  metadata jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

comment on table public.audit_logs is
  'Append-only. No UPDATE or DELETE policy exists for any role.';
