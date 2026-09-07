# Salon photography

Drop image files here and point a slot at them from **Studio → Photos**, using
the "Use a path" tab and a path like `/photos/salon-interior.jpg`.

This route needs nothing configured — no Supabase Storage bucket, no
credentials. It is the quickest way to get real photographs onto the site, and
the only way that works before the Supabase project exists.

Suggested names, though any name works:

| File | Slot |
| --- | --- |
| `hero.jpg` | Homepage hero (portrait, at least 900×1200) |
| `salon-interior.jpg` | Salon interior (portrait or square, at least 900×1100) |
| `stylist-<slug>.jpg` | A stylist's portrait |
| `salon-1.jpg` … `salon-8.jpg` | Salon photography on the gallery page |

Keep files under about 500 KB where you can — export at 80% JPEG quality, or
use WebP. They are served as-is.

Files in this directory are committed to the repository and are public.
