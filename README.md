# Prestige Hair Society

Front-end for the Prestige Hair Society salon site — a marketing homepage plus a
three-step booking drawer, built from the Claude Design handoff in `project/`.

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS v4.

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint
```

## Layout

```
src/app/
  layout.tsx              Fonts (Cormorant Garamond + Manrope), metadata
  globals.css             Palette tokens, keyframes, stripe placeholders
  page.tsx                Composes the homepage inside <BookingProvider>
src/components/
  BookNowButton.tsx       CTAs that open the booking drawer
  booking/
    BookingProvider.tsx   Booking state + context (client)
    BookingDrawer.tsx     The drawer itself (client)
  sections/               One component per homepage section
src/lib/booking.ts        Service catalogue, stylists, time slots, formatters
```

## Design tokens

Taken verbatim from the design file and exposed as Tailwind theme colours:

| Token      | Value                   | Used for                        |
| ---------- | ----------------------- | ------------------------------- |
| `ink`      | `#213126`               | Text, dark sections, primary CTA |
| `cream`    | `#FBFAF6`               | Page background                 |
| `sand`     | `#F5F0E5`               | Alternating section background  |
| `gold`     | `#AF946A`               | Accents, hover, rules           |
| `sage`     | `#8F9B7B`               | Eyebrow labels                  |
| `muted`    | `#687067`               | Body copy                       |
| `moss`     | `#53664A`               | Prices, quiet links             |
| `line`     | `rgba(33,49,38,0.16)`   | Borders                         |

## Booking flow

`BookingProvider` holds all booking state; the drawer mounts only while open.
Steps: **1** service + stylist → **2** date + time → **3** details →
**4** confirmation. Selections persist between openings; the step resets.

State is local only — there is no backend. To make it real, replace:

- `src/lib/booking.ts` — the placeholder catalogue and prices
- `upcomingDates()` / `TIMES` — with live availability from staff schedules
- the step 3 "Pay deposit" action — with a Stripe payment intent
- `bookingReference()` — with the reference returned by the booking API
- "Add to calendar" on step 4 — currently just closes the drawer

## Placeholders

Photography is rendered as striped blocks (`stripe-warm` / `stripe-deep` in
`globals.css`), stylists are unnamed, and prices and opening hours are
placeholders pending the verified salon data — all as flagged in the design.

## Integrations

### Stripe payments (`/api/checkout`, `/api/stripe/webhook`)

The booking funnel opens a Stripe Checkout session. Step 3 offers two options:

- **Secure a deposit** — authorises a deposit hold (`capture_method: manual`),
  captured only once the studio approves the appointment.
- **Pay in full** — charges the full service price immediately.

The `checkout.session.completed` webhook emails the client (and
`BOOKINGS_EMAIL`) their confirmation via Resend, reflecting which option was
chosen.

### Calendly + calendar links (`/api/calendar`, `src/lib/calendly.ts`)

- **Add to calendar** — `/api/calendar` returns an RFC 5545 `.ics` for the
  requested slot (Europe/London), linked from the success page and the
  confirmation email.
- **Book a consultation** — a Calendly link (`NEXT_PUBLIC_CALENDLY_URL`) is
  surfaced on the homepage, the success page and the email, pre-filled with the
  client's name and email where known.

### CRM email distribution (`/api/crm/distribution`)

Sends a consent-aware marketing broadcast to clients with
`profiles.marketing_email = true`. Every send is logged to
`message_deliveries` with an idempotency key of `campaign:<id>:<profile>`, so a
re-run resumes rather than double-mails. Authenticated with the `CRON_SECRET`
Bearer token; supports `testRecipients` and `dryRun`.

```bash
curl -X POST "$APP_URL/api/crm/distribution" \
  -H "authorization: Bearer $CRON_SECRET" \
  -H "content-type: application/json" \
  -d '{"campaignId":"autumn-2026","subject":"Autumn hair, refreshed",
       "heading":"A new season for your hair",
       "bodyHtml":"<p>Hi {{firstName}}, book your autumn refresh…</p>"}'
```

### Environment variables

| Variable | Purpose |
| --- | --- |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe checkout + webhook |
| `RESEND_API_KEY`, `EMAIL_FROM` | Transactional and campaign email |
| `BOOKINGS_EMAIL` | Internal copy of each booking request |
| `CRON_SECRET` | Authenticates `/api/crm/distribution` and cron routes |
| `NEXT_PUBLIC_CALENDLY_URL` | Consultation booking link (default: the connected account's 30-min event) |
| `NEXT_PUBLIC_CALENDLY_SCHEDULING_URL` | The Calendly account page |

## Design source

`project/Prestige Hair Society.dc.html` is the original Claude Design prototype
and `chats/` holds the design conversation. Both are kept for reference; they
are not part of the build (`project/` is excluded from linting).
