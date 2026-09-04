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

**Studio** — a pipeline board grouping every booking by what it needs next
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

**Cron** — hold sweeping, message delivery, waiting-list matching.

## Verification

```bash
npm run typecheck     # clean
npm run lint          # clean
npm run build         # clean
npm test              # 141 tests
npm run db:test       # 13 constraint groups + 8 RLS groups against real Postgres
npm run db:demo       # local database with fictional people and appointments
npm run test:e2e      # 24 Playwright specs, desktop and mobile
```

`tests/db/booking.integration.test.ts` opens two connections in overlapping
transactions and races them for the same chair. Exactly one wins — not zero,
which would be a deadlock, and not two, which would be a double booking. It
also replays a payment webhook five times concurrently and checks the deposit
is still counted once.

## Placeholders

Every price, opening hour and stylist name in `supabase/seed.sql` is invented,
and the public pages say so. They stay that way until the verified catalogue is
imported — see [SLICK_MIGRATION.md](docs/SLICK_MIGRATION.md). Photography is
rendered as striped blocks, as in the original design.

The Playwright specs need a running app with a reachable database, so they are
not part of `npm test`. They have not been executed in this environment — no
Supabase project was configured here — and cover the journey up to the payment
step; the Stripe Payment Element is a cross-origin iframe that belongs in a
separate credentialled suite, and the webhook path that actually confirms a
booking is covered by the database integration tests instead.

## Not built yet

Listed here rather than left to be discovered:

- Drag-and-drop on the calendar (select-and-reschedule works)
- The Slick importer covers services and their categories; staff, customers,
  appointments and opening hours are still a SQL job
- `/studio` sections for stylists, availability, payments and reports
  (deliberately absent from the studio nav rather than left as dead links)
- Photo upload UI and gift-card redemption at checkout
- Stripe Payment Element driven end to end in CI

## Design source

`project/Prestige Hair Society.dc.html` is the original Claude Design
prototype and `chats/` holds the design conversation. Both are kept for
reference and excluded from linting.
