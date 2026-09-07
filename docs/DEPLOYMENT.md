# Deployment

Target: Vercel, with Supabase as the database and Stripe for payments.

## 1. Supabase (production project)

Use a **separate project** from development. Apply the migrations in
`supabase/migrations/` in numerical order, then `supabase/seed.sql`,
`supabase/catalogue.sql` and `supabase/photos.sql`.

Before going live, in the Supabase dashboard:

- **Authentication → URL Configuration**: set the Site URL to your domain and
  add `https://your-domain/auth/callback` to the redirect allow-list.
- **Authentication → Providers**: configure Google and Apple if you want them.
  The sign-in page shows both buttons; an unconfigured provider fails cleanly.
- **Authentication → Email**: point the templates at your domain.
- **Database → Backups**: confirm point-in-time recovery suits the plan.

## 2. Vercel

Import the repository, then set every variable from `.env.example` under
**Settings → Environment Variables**.

Notes:

- `NEXT_PUBLIC_APP_URL` must be the real origin, no trailing slash. Email links
  and the Stripe return URL are built from it.
- `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and
  `CRON_SECRET` must **not** be marked as available to the browser.
- Set Preview values separately, pointing at a Stripe test key and a staging
  Supabase project. A preview deployment that can charge real cards is an
  accident waiting to happen.

## 3. Stripe

Create a webhook endpoint at `https://your-domain/api/webhooks/stripe`
subscribed to exactly these events:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`
- `charge.dispute.created`

Copy the signing secret into `STRIPE_WEBHOOK_SECRET` and redeploy.

Verify with **Send test webhook** from the dashboard: a `payment_intent.succeeded`
for a real booking id should flip it to `confirmed` and queue its confirmation
messages.

Enable Apple Pay by registering the domain under **Settings → Payment methods →
Apple Pay**. Google Pay needs nothing beyond HTTPS.

## 4. Cron

`vercel.json` declares three jobs:

| Path | Schedule | Purpose |
| --- | --- | --- |
| `/api/cron/sweep-holds` | every 5 min | Release abandoned holds; cancel bookings whose payment never arrived |
| `/api/cron/messages` | every 15 min | Send due reminders and thank-yous |
| `/api/cron/waitlist` | every 15 min | Offer freed slots to the waiting list |

Vercel sends `Authorization: Bearer $CRON_SECRET`; the routes compare it in
constant time and refuse to run at all if the secret is unset.

Hobby plans allow only daily crons. On Hobby, either upgrade or point an
external scheduler at the same URLs with the same header.

## 5. Analytics

PostHog and Google Analytics are wired through environment variables and load
only when their keys are set. Both are third-party trackers: check the cookie
banner and privacy notice reflect what you actually enable.

## 6. Custom domain

Add it in Vercel, update `NEXT_PUBLIC_APP_URL`, update the Supabase Site URL and
the Stripe webhook endpoint, then redeploy. All four must agree or sign-in
links and payment returns break.

## Before you go live

- [ ] Migrations applied in order; `select count(*) from pg_policies where schemaname = 'public'` returns rows
- [ ] Verified catalogue imported — no placeholder prices on the public site
- [ ] Real opening hours in `opening_hours`, real rosters in `staff_schedules`
- [ ] First administrator created (see [SETUP.md](./SETUP.md))
- [ ] Stripe in **live** mode, webhook verified, Apple Pay domain registered
- [ ] `EMAIL_FROM` on a verified domain with SPF, DKIM and DMARC
- [ ] Twilio number able to send to UK mobiles
- [ ] `CRON_SECRET` set and jobs firing
- [ ] A test booking taken end to end on the live domain, then refunded
- [ ] Privacy notice and cancellation policy reviewed by the salon owner
- [ ] Lighthouse ≥ 90 on the homepage
- [ ] Supabase backups on

## Rollback

The app is stateless; `vercel rollback` reverts a deploy immediately.

Migrations are not reversible automatically — they are forward-only by design,
since dropping a column takes appointment history with it. To undo a schema
change, write a new migration that reverses it. Restore from a Supabase backup
only as a last resort, and expect to lose bookings taken since the snapshot.

## Monitoring

Worth watching from day one:

- Stripe webhook delivery failures — a sustained failure means bookings are
  being paid for and not confirmed.
- `message_deliveries` rows stuck in `queued` with `attempts >= 5`.
- `bookings` in `pending_payment` older than an hour — the sweep should be
  clearing these.
- `audit_logs` for `payment.disputed`.
