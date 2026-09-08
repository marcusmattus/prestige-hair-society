# Prestige Hair Society

Website, booking platform and salon CRM for Prestige Hair Society,
2 Queens Road, Battersea, London.

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind v4 ·
Supabase · Stripe · Resend · Twilio.

```bash
npm install
cp .env.example .env.local     # then fill it in — see docs/SETUP.md
npm run dev
```

## Documentation

| | |
| --- | --- |
| [SETUP.md](docs/SETUP.md) | Local setup, first administrator, troubleshooting |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | How it fits together, and what is deliberately absent |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Vercel, Stripe webhooks, cron, go-live checklist |
| [SLICK_MIGRATION.md](docs/SLICK_MIGRATION.md) | Bringing the existing catalogue and clients across |
| [PRIVACY.md](docs/PRIVACY.md) | What is stored, retention periods, subject requests |

## The design principle

The database is the authority, not the application.

Two customers tapping "book" on the same slot at the same moment is a Saturday
morning, not an edge case, and no application-level check can win that race.
So the guarantee lives where it can be kept — a gist exclusion constraint over
`(staff_id, [starts_at, blocked_until))`. A direct `INSERT` that bypasses every
line of TypeScript here still cannot double-book a stylist.

The same holds for the rest: RLS decides who sees what, triggers decide which
columns a customer may write, `CHECK` constraints keep a deposit from exceeding
a price, and the Stripe webhook — not the browser's redirect — is what confirms
an appointment.

## What is here

**Public site** — homepage built from the Claude Design handoff, service
catalogue and detail pages, stylist profiles with live next-availability,
salon, gallery, contact, and policy/privacy/terms pages whose figures are read
from the salon record so they cannot contradict what the booking flow
enforces. Sitemap, robots, `LocalBusiness`/`HairSalon`/`Service`/`Person`
schema.

**Booking** — five steps (service and add-ons → stylist → date and time →
details → deposit), live availability computed from opening hours, rosters,
breaks, time off, buffers, eligibility and existing bookings, a ten-minute slot
hold, Stripe Payment Element with Apple Pay and Google Pay, and a webhook that
is the sole source of truth for payment.

**Accounts** — password, magic link and OAuth sign-in; appointments with
reschedule and cancel against the salon's own policy windows; contact
preferences that separate reminders from marketing.

**Studio** — availability (opening hours, rosters, breaks, time off, one-off
closures), stylists and their service eligibility, a payments ledger with
Stripe refunds and outstanding balances, reports covering takings, service
mix, chair utilisation and new-versus-returning customers; a pipeline board
grouping every booking by what it needs next
(awaiting deposit, in today, confirmed, balance outstanding, settled, lost)
with each card carrying its own email history; today's dashboard; a calendar
with one column per stylist drawing appointments, buffers, breaks and time off
to scale; a searchable bookings browser; client records with history, spend and
internal notes; a message log showing the exact text sent to each customer; and
an editable service catalogue.

**Communications** — thirteen editable templates, an idempotent delivery ledger,
and a reminder ladder (email at 48h, SMS at 24h and 3h, thank-you after,
rebooking reminder at the service's interval).

**Waiting list** — join from the booking flow when nothing suits; a
cancellation triggers a one-hour offer link. The offer never reserves the
chair, so a walk-in booking the same time is fine and the offer simply lapses.

**Importing from Slick** — upload a services CSV, correct the guessed column
mapping, read a row-by-row validation report, then apply or roll back.
Imported services arrive inactive so an unverified price cannot reach the
public catalogue unreviewed.

**On the owner's phone** — a subscribable read-only `.ics` feed, salon-wide or
per stylist, with each entry marked `DEPOSIT DUE`, `UNPAID` or `CANCELLED` in
its title so the state is legible in a month view. `/studio/calendar/subscribe`
gives the link and the iPhone and Google Calendar steps. The URL is the
credential — a calendar app cannot sign in — so it is a dedicated rotatable
token, masked on screen, and rotatable from settings when a phone is lost.

**Booking alerts** — an email to the salon the moment a deposit clears, and on
cancellation, carrying the service, time, contact details, what was paid and
what is outstanding. Routed through the same idempotent ledger as customer
mail, so a replayed webhook cannot alert twice.

**Cron** — hold sweeping, message delivery, waiting-list matching.

## Verification

```bash
npm run typecheck     # clean
npm run lint          # clean
npm run build         # clean
npm test              # 192 tests
npm run db:test       # 13 constraint groups + 8 RLS groups against real Postgres
npm run db:demo       # local database with fictional people and appointments
npm run test:e2e      # 24 Playwright specs, desktop and mobile
npm run db:demo       # real catalogue + fictional people, for development
```

`tests/db/booking.integration.test.ts` opens two connections in overlapping
transactions and races them for the same chair. Exactly one wins — not zero,
which would be a deadlock, and not two, which would be a double booking. It
also replays a payment webhook five times concurrently and checks the deposit
is still counted once.

## The catalogue

`supabase/catalogue.sql` holds the salon's **real** catalogue — 77 services in
14 categories, transcribed from the live price list, with Nekeia Griffith as
the stylist. Those prices are verified and should not be described as
placeholders.

Durations, buffers and deposits were **not** on that price list. The values in
the file are estimates so the booking engine has something to work with, and
every row is flagged `needs_review`, which surfaces as a prompt in
`/studio/services` and a banner in `/studio/settings`. Deposits follow one
documented rule: 25% rounded up to the nearest £5, minimum £10, capped at £75.

Still placeholders, and still labelled as such on the public pages: opening
hours, and the postcode and coordinates.

## The logo

`public/logo.jpg` is the mark as supplied: a screenshot, with the logo sitting
on a baked-in cream card. The header and footer used to hide that with
`mix-blend-multiply`, which works only because both happen to be cream and
fails anywhere else — a dark section, an email, a social card.

`npm run logo` derives real assets from it instead. The cream is not keyed out
by threshold but unmixed: `mix-blend-multiply` on a light ground is a known
compositing equation, so reading it backwards recovers coverage and colour
with the antialiased edges intact. Outputs, all committed:

| | |
| --- | --- |
| `public/logo.png` | Transparent. Header and footer. |
| `public/logo-light.png` | Cream, for dark backgrounds. |
| `public/apple-touch-icon.png` | 180×180 on cream — iOS composites onto black. |
| `public/og.jpg` | 1200×630 social card. |
| `src/app/icon.png` | Favicon. |

Nothing is upscaled except the social card, which nobody views at full size.
The source is 273×267, which covers a 76px header logo at 3× and every icon
size, but it is a screenshot: **if the original vector exists** — from whoever
designed the mark — it belongs in the repository, and `logo.png` and the rest
should be regenerated from it. That is the one asset that would improve the
site's typography at every size at once.

## Photography

Every image slot on the public site — the hero, the salon interior, stylist
portraits and the gallery — is a row in `site_images`, managed from
**Studio → Photos**. A slot with no row keeps the striped placeholder from the
original design, so photographs can be added one at a time without the site
ever looking half-finished.

Two routes, and the second needs nothing configured:

- **Upload** to Supabase Storage (bucket `site-images`, public). What the salon
  uses day to day.
- **Path** — commit files to `public/photos/` and point a slot at
  `/photos/whatever.jpg`. Works with no storage bucket and no credentials.

Each image carries alt text (required — it is read aloud to screen-reader
users) and a focal point, so a crop keeps the subject rather than the centre.
Stored URLs are validated before they reach an `img src`: site-relative paths
and https only, never `javascript:`, `data:` or protocol-relative.

The salon's own photographs of 2 Queens Road are in `public/photos/` and wired
up by `supabase/photos.sql` — the hero, the salon interior and four gallery
slots. **They are downscaled copies**, the largest 310px wide against a hero
that wants 900×1200, so they will look soft until the originals replace them;
that is a file swap in `public/photos/` or an upload in Studio → Photos, and
nothing else. No portrait of Nekeia was supplied, so `stylist:nekeia-griffith`
still shows its placeholder rather than a photograph of a room standing in for
a person.

`supabase/seed.sql` is the production-safe base — salon, hours, tags, message
templates. `supabase/local/01_test_fixtures.sql` is the placeholder catalogue
the SQL suites are written against; it describes nothing real.

The Playwright specs need a running app with a reachable database, so they are
not part of `npm test`. They have not been executed in this environment — no
Supabase project was configured here — and cover the journey up to the payment
step; the Stripe Payment Element is a cross-origin iframe that belongs in a
separate credentialled suite, and the webhook path that actually confirms a
booking is covered by the database integration tests instead.

## Not built yet

Listed here rather than left to be discovered:

- The Slick importer covers services and their categories; staff, customers,
  appointments and opening hours are still a SQL job
- Gift-card redemption at checkout
- Stripe Payment Element driven end to end in CI
- Calendar drag-and-drop needs a mouse or trackpad; HTML5 drag events do not
  fire on touch, so the reschedule action in the detail panel remains the way
  to move an appointment on a tablet

## Design source

`project/Prestige Hair Society.dc.html` is the original Claude Design
prototype and `chats/` holds the design conversation. Both are kept for
reference and excluded from linting.
