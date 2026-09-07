# Salon photography

Drop image files here and point a slot at them from **Studio → Photos**, using
the "Use a path" tab and a path like `/photos/salon-interior.jpg`.

This route needs nothing configured — no Supabase Storage bucket, no
credentials. It is the quickest way to get real photographs onto the site, and
the only way that works before the Supabase project exists.

## What is here now

The salon's own photographs of 2 Queens Road, wired up by
`supabase/photos.sql`:

| File | Slots |
| --- | --- |
| `salon-front-room.jpg` | Homepage hero, gallery 2 |
| `salon-floor.jpg` | Salon interior (and Our Salon, by fallback), gallery 1 |
| `basin-and-eucalyptus.jpg` | Gallery 3 |
| `textile-corner.jpg` | Gallery 4 |

**These need replacing with the originals.** The copies supplied were
downscaled thumbnails — the largest is 310px wide, where the hero wants around
900×1200 — so they will look soft on a laptop and worse on a phone. Overwrite
the file with a full-resolution version under the same name, or upload one in
Studio → Photos; nothing else has to change.

Nobody's portrait is here. `stylist:nekeia-griffith` keeps its placeholder
until one exists, rather than showing a photograph of a room where a person
should be.

Add more with any name you like:

| File | Slot |
| --- | --- |
| `stylist-<slug>.jpg` | A stylist's portrait (portrait orientation) |
| `salon-5.jpg` … `salon-8.jpg` | The remaining gallery slots |

Keep files under about 500 KB where you can — export at 80% JPEG quality, or
use WebP. They are served as-is.

Files in this directory are committed to the repository and are public.
