# Architecture

## The one idea that shapes everything

**The database is the authority, not the application.**

Two customers tapping "book" on the same slot at the same moment is not an edge
case, it is a Saturday morning. Application-level checks lose that race — there
is always a window between "is this free?" and "take it". So the guarantee
lives where it can actually be kept:

```sql
constraint bookings_no_overlap
  exclude using gist (
    staff_id with =,
    tstzrange(starts_at, blocked_until, '[)') with &&
  ) where (status in ('pending_payment', 'confirmed', 'completed'))
```

One stylist, one chair, one appointment. A direct `INSERT` that bypasses every
line of TypeScript in this repository still cannot create a double booking.
`tests/db/booking.integration.test.ts` proves it by racing two connections in
overlapping transactions.

The same principle repeats:

| Rule | Where it is kept |
| --- | --- |
| No double bookings | `EXCLUDE` constraints on `bookings` and `slot_holds` |
| A customer sees only their own data | RLS policies (`0011_rls.sql`) |
| Internal notes are staff-only | No customer `SELECT` policy exists on `client_notes` |
| A customer cannot rewrite a price | `guard_booking_update()` trigger (`0012_guards.sql`) |
| Payments come only from Stripe | `guard_payment_write()` trigger |
| Audit history cannot be edited | `guard_audit_immutable()` trigger — even for admins |
| Deposit ≤ price | `CHECK` constraint |
| Money is exact | `INTEGER` pence everywhere; no floats, ever |

## The booking journey

```
  browser                    server                     database        Stripe
     │                          │                           │             │
     │  GET /api/availability   │                           │             │
     ├─────────────────────────►│  available_slots()        │             │
     │                          ├──────────────────────────►│             │
     │◄─────────────────────────┤   advisory list           │             │
     │                          │                           │             │
     │  POST /api/holds         │                           │             │
     ├─────────────────────────►│  hold_slot()              │             │
     │                          ├──────────────────────────►│ EXCLUDE ✓   │
     │◄──── token + expiry ─────┤                           │             │
     │                          │                           │             │
     │  POST /api/bookings      │                           │             │
     ├─────────────────────────►│  book_slot()              │             │
     │                          ├──────────────────────────►│ pending     │
     │◄──── booking id ─────────┤   (price re-derived)      │             │
     │                          │                           │             │
     │  POST /api/checkout      │                           │             │
     ├─────────────────────────►│──── PaymentIntent ────────┼────────────►│
     │◄──── client secret ──────┤   (amount from the row)   │             │
     │                          │                           │             │
     │══════ Payment Element ═══╪═══════════════════════════╪════════════►│
     │                          │                           │             │
     │                          │◄──── webhook ─────────────┼─────────────┤
     │                          │  confirm_booking_paid()   │             │
     │                          ├──────────────────────────►│ confirmed   │
     │  redirect /confirmation  │                           │             │
     ├─────────────────────────►│  reads actual status      │             │
```

Two things to notice:

**Availability is advisory; the write path is authoritative.** A slot can
disappear between rendering the grid and clicking it. That is fine — it
produces "that time has just been taken", never a clash.

**The browser's redirect is not proof of payment.** The confirmation page
reports whatever status the booking actually has. A customer who closes the tab
mid-redirect still gets a confirmed appointment, because the webhook does not
care about the browser.

## Trust levels

Three Supabase clients, deliberately distinct:

| Client | Key | RLS | Used by |
| --- | --- | --- | --- |
| `supabase/client.ts` | anon | applies | Browser |
| `supabase/server.ts` | anon + session | applies | Server components, actions |
| `supabase/admin.ts` | service role | **bypassed** | Webhook, cron, guest checkout, importer |

`admin.ts` imports `server-only`, so a client component importing it fails the
build rather than shipping the key to the browser. Everywhere it is used, the
code does its own authorisation check first.

## Layout

```
src/
  app/
    (auth)/            sign-in, sign-up, password reset
    account/           customer portal — requireUser()
    studio/            staff CRM — requireStaff(), role-filtered nav
    api/
      availability/    public, read-only, rate limited
      holds/           reserve and release
      bookings/        consume a hold, create the account, record consent
      checkout/        PaymentIntent, amount read from the booking row
      webhooks/stripe/ the source of truth for payment
      cron/            hold sweep, reminder ladder, waiting-list matching
    services/, stylists/, book/, booking/confirmation/
  components/
    booking/           the five-step flow, reducer-driven
    account/, studio/, sections/, ui/
  lib/
    supabase/          three clients + generated types
    auth/              roles, guards, server actions
    comms/             render, send, dispatch
    booking/, studio/, account/
    api.ts             JSON helpers, DB error mapping, rate limiting
    money.ts           integer pence
    time.ts            salon-timezone formatting
    audit.ts           append-only, redacting
supabase/
  migrations/          0001–0012
  local/               PostgreSQL shim + SQL test suites
  seed.sql
```

## Time

Every instant is `TIMESTAMPTZ` in UTC. The salon's display zone is
configuration (`salons.timezone`), applied only at the edges through `TZDate`.
This matters more than it sounds: a 10:00 London appointment is `09:00Z` in
summer and `10:00Z` in winter, and a naive server running in UTC will show the
wrong hour for seven months of the year. `tests/time.test.ts` pins both.

Opening hours and rosters are stored as local `TIME` plus an ISO weekday,
because "we open at ten" is a wall-clock fact that should not shift with the
clocks. The conversion happens inside `is_slot_available()` and
`available_slots()`.

## Idempotency

Three places where the same thing can happen twice, and what stops it:

1. **Stripe retries a webhook.** `payments` upserts on the unique
   `stripe_payment_intent_id`; `confirm_booking_paid()` uses `greatest()` rather
   than `+=`, so a replayed deposit is not counted twice.
2. **A cron run overlaps the previous one.** `message_deliveries` has a unique
   `idempotency_key`. The pattern is claim-then-send: insert the row, and only
   send if the insert succeeded. A crash between the two leaves a stuck
   `queued` row — a retry, never a duplicate message.
3. **A customer double-submits checkout.** The Stripe idempotency key is derived
   from booking and amount, so the same intent comes back instead of a second
   charge.

## What is not here

Written down so nobody has to discover it by reading source:

- **Drag-and-drop rescheduling.** The calendar renders and selects; moving an
  appointment goes through the reschedule action.
- **Distributed rate limiting.** `rateLimit()` is in-memory, so on Vercel the
  window is per instance. Put Upstash Redis behind it for a hard limit; the
  call sites do not change.
- **Photo upload UI.** `client_photos` and its consent gate exist in the schema;
  the Supabase Storage upload flow does not.
- **Gift card redemption at checkout.** Tables and balances exist; the checkout
  step does not apply them yet.
