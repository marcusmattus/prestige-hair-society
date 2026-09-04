-- catalogue.sql
-- The salon's REAL service catalogue.
--
-- Prices are VERIFIED: transcribed from the salon's live price list (the Slick
-- booking page, stylist Nekeia Griffith). They are not placeholders and should
-- not be described as such.
--
-- Durations, buffers and deposits are NOT on that price list. The values here
-- are estimates so the booking engine has something to work with, and every
-- row is flagged `needs_review = true` so /studio/services shows which figures
-- still need the salon's confirmation. Confirming a row is a click; guessing
-- silently would have been the mistake.
--
-- Deposit rule, applied uniformly and easy to change in Studio:
--   25% of the price, rounded up to the nearest £5, minimum £10, capped at £75,
--   and never more than the price itself.
--
-- Run after supabase/seed.sql:
--   psql -d prestige_test -f supabase/catalogue.sql

\set salon_id '''11111111-1111-4111-8111-111111111111'''

begin;

-- ---------------------------------------------------------------------------
-- Categories, in the order the price list shows them.
-- ---------------------------------------------------------------------------

insert into public.service_categories (salon_id, name, slug, description, display_order)
values
  (:salon_id, 'Consultations', 'consultations',
   'Where every relationship with your hair begins.', 1),
  (:salon_id, 'Natural Hair', 'natural-hair',
   'Stretching, cutting and finishing for natural hair.', 2),
  (:salon_id, 'Silk Press', 'silk-press',
   'Smooth, shining, beautifully polished results.', 3),
  (:salon_id, 'Colours, Bleach and Tone', 'colours-bleach-and-tone',
   'Bespoke colour, highlights, toning and root work.', 4),
  (:salon_id, 'Treatments', 'treatments',
   'Steam, bond-building, protein and scalp therapy.', 5),
  (:salon_id, 'Brazilian Keratin Blowdry', 'brazilian-keratin-blowdry',
   'Keratin smoothing, from a partial hairline to long thick hair.', 6),
  (:salon_id, 'Texture Release', 'texture-release',
   'Virgin and follow-up texture release treatments.', 7),
  (:salon_id, 'Relaxers (Affirm only)', 'relaxers',
   'Affirm relaxers, retouches, texturisers and finishing.', 8),
  (:salon_id, 'Weaves and Extensions', 'weaves-and-extensions',
   'Weaves, wigs, tracks, tape-ins and clip-ins.', 9),
  (:salon_id, 'Locs', 'locs',
   'Starter locs, re-twists and styling.', 10),
  (:salon_id, 'Miracle Knots', 'miracle-knots',
   'Miracle knots to shoulder, bra strap or waist length.', 11),
  (:salon_id, 'Take Down', 'take-down',
   'Braid take-down, shampoo and blow out.', 12),
  (:salon_id, 'Bixo Pilixin Hair Activation', 'bixo-pilixin',
   'Hair activation treatment for women and men.', 13),
  (:salon_id, 'European Hair', 'european-hair',
   'Wash, blow dry and finish.', 14)
on conflict (salon_id, slug) do update set
  name = excluded.name,
  description = excluded.description,
  display_order = excluded.display_order;

-- ---------------------------------------------------------------------------
-- Services.
--
-- price_pounds is verified. duration and buffer are estimates -- see the file
-- header. `consult` marks a service the salon requires a consultation for.
-- ---------------------------------------------------------------------------

create temporary table tmp_catalogue (
  category_slug text,
  name text,
  slug text,
  price_pounds numeric,
  duration integer,
  buffer integer,
  consult boolean default false,
  display_order integer,
  featured boolean default false,
  rebook_days integer
) on commit drop;

insert into tmp_catalogue
  (category_slug, name, slug, price_pounds, duration, buffer, consult, display_order, featured, rebook_days)
values
  -- Consultations -----------------------------------------------------------
  ('consultations', 'New Client Consultation', 'new-client-consultation', 10, 15, 0, false, 1, true, null),
  ('consultations', 'Keratin Straightening Consultation', 'keratin-straightening-consultation', 10, 15, 0, false, 2, false, null),
  ('consultations', 'Healthy Hair and Scalp Consultation', 'healthy-hair-and-scalp-consultation', 20, 30, 0, false, 3, false, null),
  ('consultations', 'Hair Loss & Regeneration Consultation', 'hair-loss-and-regeneration-consultation', 40, 45, 0, false, 4, false, null),
  ('consultations', 'Extensive Hair Consultation', 'extensive-hair-consultation', 60, 60, 0, false, 5, false, null),

  -- Natural Hair ------------------------------------------------------------
  ('natural-hair', 'Signature Stretch Only', 'signature-stretch-only', 35, 45, 15, false, 1, false, 42),
  ('natural-hair', 'Signature Stretch and Trim', 'signature-stretch-and-trim', 38, 60, 15, false, 2, false, 42),
  ('natural-hair', 'Signature Stretch and Cut', 'signature-stretch-and-cut', 48, 75, 15, false, 3, false, 42),
  ('natural-hair', 'Wash and Blow Dry - Short Hair', 'wash-and-blow-dry-short-hair', 55, 60, 15, false, 4, false, 28),
  ('natural-hair', 'Wash and Blow Dry - Medium Hair', 'wash-and-blow-dry-medium-hair', 60, 75, 15, false, 5, false, 28),
  ('natural-hair', 'Wash and Blow Dry - Long Thick Hair', 'wash-and-blow-dry-long-thick-hair', 70, 90, 15, false, 6, false, 28),
  ('natural-hair', 'Mens Stretch and 4 Canerows', 'mens-stretch-and-4-canerows', 60, 60, 15, false, 7, false, 28),
  ('natural-hair', 'Mens Stretch and 6 Canerows', 'mens-stretch-and-6-canerows', 70, 75, 15, false, 8, false, 28),
  ('natural-hair', 'Mens Stretch and 8 Canerows', 'mens-stretch-and-8-canerows', 80, 90, 15, false, 9, false, 28),

  -- Silk Press --------------------------------------------------------------
  ('silk-press', 'Silk Press - Short Hair', 'silk-press-short-hair', 70, 90, 15, false, 1, true, 28),
  ('silk-press', 'Silk Press - Medium Hair', 'silk-press-medium-hair', 80, 105, 15, false, 2, false, 28),
  ('silk-press', 'Silk Press - Long, Thick Hair', 'silk-press-long-thick-hair', 100, 120, 15, false, 3, false, 28),

  -- Colours, Bleach and Tone ------------------------------------------------
  ('colours-bleach-and-tone', 'Root Colour', 'root-colour', 40, 60, 15, false, 1, false, 42),
  ('colours-bleach-and-tone', 'Full Head Colour', 'full-head-colour', 70, 90, 15, false, 2, true, 42),
  ('colours-bleach-and-tone', 'Half Head Highlights', 'half-head-highlights', 140, 150, 30, true, 3, false, 56),
  ('colours-bleach-and-tone', 'Full Head Bleach and Tone', 'full-head-bleach-and-tone', 170, 180, 30, true, 4, false, 56),
  ('colours-bleach-and-tone', 'Add On: Toner', 'add-on-toner', 35, 45, 0, false, 5, false, null),

  -- Treatments --------------------------------------------------------------
  ('treatments', 'Bixo Pilixin Hair Activation Treatment (Add On)', 'bixo-pilixin-add-on', 28, 30, 0, false, 1, false, 28),
  ('treatments', 'Protein Nano Steam', 'protein-nano-steam', 35, 45, 15, false, 2, false, 35),
  ('treatments', 'Post Texture Release Hydration Treatment', 'post-texture-release-hydration-treatment', 35, 45, 15, false, 3, false, null),
  ('treatments', 'Hydration Nano Steam', 'hydration-nano-steam', 38, 45, 15, false, 4, false, 35),
  ('treatments', 'Bond Building Nano Steam', 'bond-building-nano-steam', 40, 45, 15, false, 5, false, 35),
  ('treatments', 'Moisture and Protein Mix Nano Steam', 'moisture-and-protein-mix-nano-steam', 40, 45, 15, false, 6, false, 35),
  ('treatments', 'Olaplex Rebuilding Treatment', 'olaplex-rebuilding-treatment', 45, 45, 15, false, 7, true, 35),
  ('treatments', 'Pre Scalp Detox and Hair Cleanse', 'pre-scalp-detox-and-hair-cleanse', 45, 45, 15, false, 8, false, 35),
  ('treatments', 'Scalp Therapy Steam Treatment', 'scalp-therapy-steam-treatment', 48, 60, 15, false, 9, false, 35),

  -- Brazilian Keratin Blowdry -----------------------------------------------
  ('brazilian-keratin-blowdry', 'Partial Hairline Keratin Blowdry', 'partial-hairline-keratin-blowdry', 150, 120, 30, true, 1, false, 120),
  ('brazilian-keratin-blowdry', 'Keratin Blowdry - Short Fine Hair', 'keratin-blowdry-short-fine-hair', 210, 180, 30, true, 2, false, 120),
  ('brazilian-keratin-blowdry', 'Keratin Blowdry - Medium Length Hair', 'keratin-blowdry-medium-length-hair', 230, 210, 30, true, 3, false, 120),
  ('brazilian-keratin-blowdry', 'Keratin Blowdry - Long Thick Hair', 'keratin-blowdry-long-thick-hair', 250, 240, 30, true, 4, false, 120),

  -- Texture Release ---------------------------------------------------------
  ('texture-release', 'Follow Up Texture Release - Short Fine Hair', 'follow-up-texture-release-short-fine-hair', 180, 165, 30, true, 1, false, 84),
  ('texture-release', 'Follow Up Texture Release - Medium Hair', 'follow-up-texture-release-medium-hair', 200, 180, 30, true, 2, false, 84),
  ('texture-release', 'Virgin Texture Release Treatment - Medium', 'virgin-texture-release-treatment-medium', 202, 210, 30, true, 3, false, 84),
  ('texture-release', 'Follow Up Texture Release - Long Thick Hair', 'follow-up-texture-release-long-thick-hair', 220, 195, 30, true, 4, false, 84),
  ('texture-release', 'Virgin Texture Release Treatment - Long Thick Hair', 'virgin-texture-release-treatment-long-thick-hair', 260, 240, 30, true, 5, false, 84),

  -- Relaxers ----------------------------------------------------------------
  ('relaxers', 'Corrective Relaxer', 'corrective-relaxer', 18, 60, 15, true, 1, false, null),
  ('relaxers', 'Wash and Finish - Pixie', 'wash-and-finish-pixie', 55, 45, 15, false, 2, false, 28),
  ('relaxers', 'Wash and Finish - Short Hair', 'wash-and-finish-short-hair', 60, 60, 15, false, 3, false, 28),
  ('relaxers', 'Wash and Finish - Medium Hair', 'wash-and-finish-medium-hair', 70, 60, 15, false, 4, false, 28),
  ('relaxers', 'Wash and Finish - Long Hair', 'wash-and-finish-long-hair', 75, 75, 15, false, 5, false, 28),
  ('relaxers', 'Wash, Blowdry and Trim - Short', 'wash-blowdry-and-trim-short', 80, 75, 15, false, 6, false, 42),
  ('relaxers', 'Wash, Finish and Trim - Medium Hair', 'wash-finish-and-trim-medium-hair', 90, 90, 15, false, 7, false, 42),
  ('relaxers', 'Wash, Finish and Trim - Long Hair', 'wash-finish-and-trim-long-hair', 100, 105, 15, false, 8, false, 42),
  ('relaxers', 'Relaxer Retouch and Trim', 'relaxer-retouch-and-trim', 135, 135, 15, false, 9, true, 56),
  ('relaxers', 'Relaxer and Cut', 'relaxer-and-cut', 140, 150, 15, false, 10, false, 56),
  ('relaxers', 'Texturiser and Trim', 'texturiser-and-trim', 145, 150, 15, true, 11, false, 56),
  ('relaxers', 'Virgin Relaxer and Trim', 'virgin-relaxer-and-trim', 155, 165, 15, true, 12, false, 56),
  ('relaxers', 'Virgin Relaxer and Cut', 'virgin-relaxer-and-cut', 170, 180, 15, true, 13, false, 56),

  -- Weaves and Extensions ---------------------------------------------------
  ('weaves-and-extensions', 'Tape In''s - Consultation Only', 'tape-ins-consultation-only', 10, 15, 0, false, 1, false, null),
  ('weaves-and-extensions', 'Remove Wig Braids', 'remove-wig-braids', 20, 30, 0, false, 2, false, null),
  ('weaves-and-extensions', 'Tracks Per Row', 'tracks-per-row', 20, 30, 0, false, 3, false, null),
  ('weaves-and-extensions', 'Wig Braids', 'wig-braids', 30, 45, 15, false, 4, false, 42),
  ('weaves-and-extensions', 'Clip In''s', 'clip-ins', 40, 45, 15, false, 5, false, null),
  ('weaves-and-extensions', 'Weave Wash and Style', 'weave-wash-and-style', 80, 90, 15, false, 6, false, 28),
  ('weaves-and-extensions', 'Half Wig Pinned and Style', 'half-wig-pinned-and-style', 90, 90, 15, false, 7, false, 42),
  ('weaves-and-extensions', 'Half Head Weave', 'half-head-weave', 100, 120, 15, false, 8, false, 42),
  ('weaves-and-extensions', 'Flip Over Weave', 'flip-over-weave', 155, 165, 30, false, 9, false, 56),
  ('weaves-and-extensions', 'Leave Out Weave', 'leave-out-weave', 180, 180, 30, false, 10, false, 56),

  -- Locs --------------------------------------------------------------------
  ('locs', 'Locs Wash, Re-twist and Style - Short', 'locs-wash-re-twist-and-style-short', 170, 150, 30, false, 1, false, 42),
  ('locs', 'Locs Wash, Re-twist and Style - Medium', 'locs-wash-re-twist-and-style-medium', 190, 180, 30, false, 2, false, 42),
  ('locs', 'Locs Wash, Re-twist and Style - Long', 'locs-wash-re-twist-and-style-long', 205, 210, 30, false, 3, false, 42),
  ('locs', 'Starter Locs', 'starter-locs', 350, 300, 30, true, 4, false, 42),

  -- Miracle Knots -----------------------------------------------------------
  ('miracle-knots', 'Miracle Knots - Shoulder Length', 'miracle-knots-shoulder-length', 200, 195, 30, false, 1, false, 56),
  ('miracle-knots', 'Miracle Knots - Bra Strap Length', 'miracle-knots-bra-strap-length', 245, 240, 30, false, 2, false, 56),
  ('miracle-knots', 'Miracle Knots - Waist Length', 'miracle-knots-waist-length', 310, 300, 30, false, 3, false, 56),

  -- Take Down ---------------------------------------------------------------
  ('take-down', 'Add On: Trim', 'add-on-trim', 20, 30, 0, false, 1, false, null),
  ('take-down', 'Medium Braid Take Down, Shampoo and Blow Out', 'medium-braid-take-down', 100, 120, 15, false, 2, false, null),
  ('take-down', 'Small Braid Take Down, Shampoo and Blow Out', 'small-braid-take-down', 125, 150, 15, false, 3, false, null),
  ('take-down', 'Micro Braid Take Down, Shampoo and Blow Out', 'micro-braid-take-down', 160, 180, 15, false, 4, false, null),

  -- Bixo Pilixin ------------------------------------------------------------
  ('bixo-pilixin', 'Bixo Pilixin Hair Activation - Women', 'bixo-pilixin-women', 70, 60, 15, false, 1, false, 28),
  ('bixo-pilixin', 'Bixo Pilixin Hair Activation - Men', 'bixo-pilixin-men', 75, 60, 15, false, 2, false, 28),

  -- European Hair -----------------------------------------------------------
  ('european-hair', 'Wash, Blowdry and Finish', 'european-wash-blowdry-and-finish', 85, 75, 15, false, 1, false, 28);

insert into public.services (
  salon_id, category_id, name, slug, description, short_description,
  duration_minutes, buffer_minutes, base_price_pence, pricing_mode,
  deposit_pence, requires_consultation, rebooking_interval_days,
  display_order, is_featured, is_active, needs_review
)
select
  :salon_id,
  c.id,
  t.name,
  t.slug,
  '',
  null,
  t.duration,
  t.buffer,
  (t.price_pounds * 100)::integer,
  'fixed'::public.pricing_mode,
  -- 25% rounded up to the nearest £5, floor £10, ceiling £75, never above price.
  least(
    (t.price_pounds * 100)::integer,
    least(7500, greatest(1000, (ceil(t.price_pounds * 25.0 / 500.0) * 500)::integer))
  ),
  t.consult,
  t.rebook_days,
  t.display_order,
  t.featured,
  true,
  -- Prices are verified; durations, buffers and deposits are not.
  true
from tmp_catalogue t
join public.service_categories c
  on c.salon_id = :salon_id and c.slug = t.category_slug
on conflict (salon_id, slug) do update set
  category_id = excluded.category_id,
  name = excluded.name,
  base_price_pence = excluded.base_price_pence,
  duration_minutes = excluded.duration_minutes,
  buffer_minutes = excluded.buffer_minutes,
  deposit_pence = excluded.deposit_pence,
  requires_consultation = excluded.requires_consultation,
  rebooking_interval_days = excluded.rebooking_interval_days,
  display_order = excluded.display_order,
  is_featured = excluded.is_featured,
  is_active = true,
  needs_review = excluded.needs_review;

-- Retire the placeholder catalogue, without deleting: a soft delete keeps any
-- booking that referenced one intact.
update public.services
set is_active = false, deleted_at = now()
where salon_id = :salon_id
  and deleted_at is null
  and slug not in (select slug from tmp_catalogue);

update public.service_categories
set is_active = false, deleted_at = now()
where salon_id = :salon_id
  and deleted_at is null
  and slug not in (
    'consultations', 'natural-hair', 'silk-press', 'colours-bleach-and-tone',
    'treatments', 'brazilian-keratin-blowdry', 'texture-release', 'relaxers',
    'weaves-and-extensions', 'locs', 'miracle-knots', 'take-down',
    'bixo-pilixin', 'european-hair'
  );

-- ---------------------------------------------------------------------------
-- The stylist named on the price list.
-- ---------------------------------------------------------------------------

insert into public.staff (salon_id, display_name, slug, title, bio, specialties, display_order, is_bookable)
values (
  :salon_id,
  'Nekeia Griffith',
  'nekeia-griffith',
  'Stylist and Hair Coach',
  'Stylist and hair coach, working across natural hair, silk press, colour, '
  'keratin smoothing, texture release, locs and extensions — with an '
  'assessment-first approach to the long-term condition of your hair.',
  array['Silk press', 'Colour', 'Keratin smoothing', 'Texture release', 'Locs', 'Hair coaching'],
  1,
  true
)
on conflict (salon_id, slug) do update set
  title = excluded.title,
  bio = excluded.bio,
  specialties = excluded.specialties,
  is_bookable = true,
  is_active = true,
  deleted_at = null;

-- She delivers the whole catalogue.
insert into public.staff_services (staff_id, service_id)
select st.id, sv.id
from public.staff st
join public.services sv on sv.salon_id = st.salon_id
where st.salon_id = :salon_id
  and st.slug = 'nekeia-griffith'
  and sv.deleted_at is null
on conflict do nothing;

-- Retire the placeholder stylists and their eligibility.
delete from public.staff_services
where staff_id in (
  select id from public.staff
  where salon_id = :salon_id and slug <> 'nekeia-griffith'
);

update public.staff
set is_active = false, is_bookable = false, deleted_at = now()
where salon_id = :salon_id
  and slug <> 'nekeia-griffith'
  and deleted_at is null;

-- Give her the same working pattern the salon's opening hours describe.
insert into public.staff_schedules (staff_id, day_of_week, starts_at, ends_at)
select st.id, oh.day_of_week, oh.opens_at, oh.closes_at
from public.staff st
join public.opening_hours oh on oh.salon_id = st.salon_id and not oh.is_closed
where st.salon_id = :salon_id and st.slug = 'nekeia-griffith'
on conflict do nothing;

insert into public.staff_breaks (staff_id, day_of_week, starts_at, ends_at, label)
select st.id, oh.day_of_week, time '13:00', time '13:45', 'Lunch'
from public.staff st
join public.opening_hours oh on oh.salon_id = st.salon_id and not oh.is_closed
where st.salon_id = :salon_id and st.slug = 'nekeia-griffith'
on conflict do nothing;

commit;

select
  (select count(*) from public.services where salon_id = :salon_id and deleted_at is null) as services,
  (select count(*) from public.service_categories where salon_id = :salon_id and deleted_at is null) as categories,
  (select count(*) from public.services where salon_id = :salon_id and needs_review and deleted_at is null) as needing_review;
