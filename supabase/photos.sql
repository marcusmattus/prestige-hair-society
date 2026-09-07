-- photos.sql
-- The salon's own photographs, pointed at the files in public/photos/.
--
-- These are real photographs of 2 Queens Road, supplied by the salon. They are
-- not stock and not placeholders.
--
-- One caveat, recorded here because it is not visible from the SQL: the copies
-- supplied were downscaled thumbnails — the largest is 310px wide, where the
-- homepage hero wants around 900×1200. They are the correct photographs and
-- they will render, but they will look soft on a laptop screen and worse on a
-- phone at 2x. Replacing them is a file swap plus nothing else: drop a
-- full-resolution file in public/photos/ under the same name, or upload it in
-- Studio → Photos, which overwrites the row below.
--
-- The `url` column takes a path rather than a storage reference precisely so
-- this route works with no Supabase Storage bucket and no credentials.
--
-- `about-interior` is deliberately absent: it falls back to `salon-interior`,
-- and one photograph doing both jobs is better than the same photograph
-- entered twice and then only updated once.
--
-- `stylist:nekeia-griffith` is also absent. None of the supplied photographs
-- is a portrait of her, and an interior shot standing in for a person would be
-- a worse answer than the placeholder. That slot keeps its stripes until a
-- portrait exists.
--
-- Run after supabase/seed.sql:
--   psql -d prestige_test -f supabase/photos.sql

\set salon_id '''11111111-1111-4111-8111-111111111111'''

begin;

insert into public.site_images (salon_id, slot, url, alt, focal_x, focal_y, caption, display_order)
values
  -- The hero is an arched portrait crop, so it needs the one portrait-shaped
  -- photograph of the room. focal_y 45 keeps the mirrors and the artwork in
  -- frame rather than cropping down to bare floor.
  (:salon_id, 'hero', '/photos/salon-front-room.jpg',
   'The front room at Prestige Hair Society: tall mirrors, a globe pendant light, '
   'olive branches in stone vases and a pale wood floor.',
   50, 45, null, 1),

  -- The establishing shot. Landscape, so a portrait crop keeps the middle —
  -- the mirror column, the window and the plants — which is the part worth
  -- keeping.
  (:salon_id, 'salon-interior', '/photos/salon-floor.jpg',
   'The salon floor: styling chairs facing tall mirrors under globe pendant lights, '
   'with the street windows behind.',
   50, 50, null, 2),

  -- Gallery, in the order they read best: wide, wide, detail, detail.
  (:salon_id, 'gallery:1', '/photos/salon-floor.jpg',
   'The salon floor: styling chairs facing tall mirrors under globe pendant lights, '
   'with the street windows behind.',
   50, 50, 'The floor at 2 Queens Road', 1),

  (:salon_id, 'gallery:2', '/photos/salon-front-room.jpg',
   'The front room at Prestige Hair Society: tall mirrors, a globe pendant light, '
   'olive branches in stone vases and a pale wood floor.',
   50, 45, 'Mirrors and olive branches', 2),

  (:salon_id, 'gallery:3', '/photos/basin-and-eucalyptus.jpg',
   'A white basin with a matte black tap, beside eucalyptus in a glass vase and '
   'a row of styling products on the counter.',
   45, 55, 'The wash station', 3),

  (:salon_id, 'gallery:4', '/photos/textile-corner.jpg',
   'A corner of the salon: a large patterned textile in blue and red hung on a '
   'blush pink wall, with a chair and trailing foliage below.',
   55, 45, 'The corner, and the textile', 4)

on conflict (salon_id, slot) do update set
  url = excluded.url,
  alt = excluded.alt,
  focal_x = excluded.focal_x,
  focal_y = excluded.focal_y,
  caption = excluded.caption,
  display_order = excluded.display_order,
  is_active = true;

commit;
