-- 0014_site_images.sql
-- Photography for the public site.
--
-- Until now every image on the site was a hardcoded striped placeholder, so
-- there was nowhere for the salon's own photographs to go. This gives each
-- image slot a row, which the page reads; a slot with no row keeps its
-- placeholder, so the site never renders a broken image or an empty box.
--
-- `url` is deliberately a plain string rather than a storage reference, so all
-- three routes work with one column:
--   * '/photos/hero.jpg'                  a file committed to public/
--   * 'https://<project>.supabase.co/...' a Supabase Storage public URL
--   * 'https://…'                         anything else already hosted
--
-- The before/after gallery keeps its own table (client_photos), because those
-- carry a consent record and these do not.

create table public.site_images (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons (id) on delete cascade,

  -- Which slot on the site this fills. See SLOTS in src/lib/images.ts.
  -- 'stylist:<slug>' and 'gallery:<n>' are the two parameterised forms.
  slot text not null,

  url text not null check (length(trim(url)) > 0),
  -- Never optional in practice: an empty alt on a decorative image is a
  -- deliberate choice, but a photograph of the salon is content.
  alt text not null default '',

  -- Percentage from the left/top to keep visible when the image is cropped.
  -- 50/50 centres it; a portrait usually wants a lower focal_y.
  focal_x smallint not null default 50 check (focal_x between 0 and 100),
  focal_y smallint not null default 50 check (focal_y between 0 and 100),

  caption text,
  display_order integer not null default 0,
  is_active boolean not null default true,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (salon_id, slot)
);

create index site_images_slot_idx on public.site_images (salon_id, slot)
  where is_active;

create trigger site_images_set_updated_at
  before update on public.site_images
  for each row execute function public.set_updated_at();

comment on table public.site_images is
  'Public-site photography, one row per slot. A missing row is not an error: '
  'the page falls back to its striped placeholder.';

-- ---------------------------------------------------------------------------
-- RLS: readable by everyone, writable by managers.
-- ---------------------------------------------------------------------------

alter table public.site_images enable row level security;

create policy site_images_public_read on public.site_images
  for select using (is_active);

create policy site_images_staff_read on public.site_images
  for select using (public.is_staff());

create policy site_images_manager_write on public.site_images
  for all using (public.is_manager()) with check (public.is_manager());
