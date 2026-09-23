# Stripe production go-live checklist

A codebase-specific runbook for switching Prestige Hair Society from Stripe
**test** mode to **live** payments. Work top to bottom; nothing here needs a
code change unless a box says so.

> **Golden rule:** live secrets live only in the hosting provider's environment
> variables (Vercel → Project → Settings → Environment Variables, **Production**
> scope). Never commit them. `.env*` is git-ignored.

## What this app uses Stripe for

| Flow | Code | Mode |
| --- | --- | --- |
| Deposit hold / pay-in-full booking | `src/app/api/checkout/route.ts` → Stripe Checkout | one-off payment |
| Membership pay-in-full | `src/app/api/checkout/membership/route.ts` (`mode: payment`) | one-off payment |
| Membership monthly instalments | same route (`mode: subscription`) | **subscription** |
| Fulfilment + lifecycle | `src/app/api/stripe/webhook/route.ts` + `src/lib/stripe/billing.ts` | webhook |
| Manage subscription | `src/app/api/stripe/portal/route.ts` (billing portal) | webhook-adjacent |

The Stripe client (`src/lib/stripe.ts`) reads `STRIPE_SECRET_KEY` and pins API
version `2026-08-26.dahlia`. Nothing in the code is test-vs-live aware — it is
purely the keys and webhook secret you set that determine the mode.

## 1. Activate the Stripe account
- [ ] Complete Stripe **account activation** (business details, representative
      identity, bank account for payouts) in the Dashboard. Live keys don't work
      until the account is activated.
- [ ] Set the **public business name / statement descriptor** (what shows on the
      customer's card statement).
- [ ] Decide on **VAT / Stripe Tax** (UK salon — 20% VAT likely applies). Not
      wired today; see "Known gaps" below.

## 2. Rotate & set the live keys
- [ ] **Rotate the test secret key** that was shared in chat earlier (Dashboard →
      Developers → API keys → roll). It's test-mode, but treat it as burned.
- [ ] Copy the **live** keys (Dashboard in *live* mode → Developers → API keys):
      `sk_live_…` and `pk_live_…`.
- [ ] In Vercel **Production** env, set:
  - `STRIPE_SECRET_KEY = sk_live_…`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = pk_live_…` *(optional today — Checkout
    is redirect-based so no client Stripe.js is used; set it anyway for future
    Payment Element work.)*
- [ ] Keep **Preview/Development** env on **test** keys, so preview deploys never
      touch real money.

## 3. Create the live webhook endpoint
- [ ] Dashboard (**live** mode) → Developers → Webhooks → **Add endpoint**:
      `https://<your-production-domain>/api/stripe/webhook`
- [ ] Subscribe to exactly the events the handler switches on
      (`src/app/api/stripe/webhook/route.ts`):
  - `checkout.session.completed`
  - `invoice.paid`
  - `invoice.payment_failed`
  - `customer.subscription.deleted`
  - `customer.subscription.updated`
- [ ] Copy the endpoint's **live signing secret** (`whsec_…`) → Vercel Production
      `STRIPE_WEBHOOK_SECRET`. **The live secret differs from the test one** — a
      wrong secret makes every webhook fail signature verification (400).
- [ ] Leave the existing **test** webhook (and its secret) pointed at preview if
      you use one.

## 4. App / email environment
- [ ] `NEXT_PUBLIC_APP_URL = https://<your-production-domain>` — used for
      Checkout `success_url` / `cancel_url` and the absolute links in emails
      (`/account`, `/#book`, the `.ics` link). Wrong value = broken redirects.
- [ ] **Resend**: verify the sending domain and set `EMAIL_FROM` to a sender on
      that domain (e.g. `Prestige Hair Society <hello@yourdomain>`). You **cannot**
      send *from* `prestigehair0@gmail.com` via Resend unless you own+verify that
      domain — Gmail addresses are fine as `reply-to` only.
- [ ] `BOOKINGS_EMAIL = prestigehair0@gmail.com` (salon inbox + reply-to;
      defaults to this if unset).
- [ ] Confirm Supabase production project vars (`NEXT_PUBLIC_SUPABASE_URL`,
      `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and
      `CRON_SECRET` are set in Production.

## 5. Payments configuration (live mode)
- [ ] Enable **Card** and, if wanted, **Apple Pay / Google Pay** (Dashboard →
      Settings → Payment methods). Hosted Checkout registers the Apple Pay domain
      automatically.
- [ ] Turn on **Stripe email receipts** (Settings → Customer emails) if you want
      Stripe to send card receipts in addition to the app's confirmation email.
- [ ] Review **Radar** fraud rules (default rules are on).
- [ ] Confirm your **refund / cancellation policy** text matches the deposit and
      membership terms shown at checkout.

## 6. Smoke test in live mode
- [ ] Deploy to Production with the live env set; redeploy so new env is picked up.
- [ ] Do a **real** low-value booking with a real card → confirm redirect to
      `/booking/success`, confirmation email received, then **refund** it in the
      Dashboard.
- [ ] Buy a **pay-in-full membership** → confirm `/memberships/success`, the
      `memberships` row is created (Supabase), and the confirmation email.
- [ ] In Dashboard → Webhooks → your endpoint → **Events**, confirm deliveries
      are **200 OK** (not 400 signature errors).
- [ ] Verify the **instalment cap**: this is hard to exercise live (monthly
      cycles). Validate it in **test mode** first with a Stripe **test clock** —
      advance N months and confirm the subscription auto-cancels after the Nth
      paid invoice and the membership flips to `completed`
      (`src/lib/stripe/billing.ts`).

## 7. Known gaps to decide on before/at launch
These are from the Stripe review and are **not** blockers, but decide consciously:
- **Deposit holds aren't captured/released yet.** The deposit flow authorises via
  `capture_method: manual` but there's no staff "approve → capture" / "decline →
  cancel" path, and a manual-capture authorisation **expires in ~7 days**. If you
  launch deposit holds, either add the capture flow or switch deposits to
  immediate capture. (Pay-in-full and subscriptions are unaffected.)
- **VAT / Stripe Tax** not applied — decide if prices are tax-inclusive.
- **À la carte payments** aren't persisted to the `payments` table (only
  memberships get a DB row).
- Two Stripe client modules exist (`src/lib/stripe.ts` vs `src/lib/stripe/server.ts`);
  only the former is used. Harmless, worth consolidating.

## 8. Rollback
If something's wrong in live: set Vercel Production `STRIPE_SECRET_KEY` /
`STRIPE_WEBHOOK_SECRET` back to the **test** values and redeploy — the code is
identical, so this instantly returns the site to test mode while you fix things.
