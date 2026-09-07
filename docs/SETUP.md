# Setup

From nothing to a working local booking flow. Allow about half an hour.

## 1. Prerequisites

- Node 20 or newer
- A Supabase project (free tier is enough)
- A Stripe account in test mode
- Optional for local work: Resend and Twilio accounts

```bash
git clone https://github.com/marcusmattus/prestige-hair-society
cd prestige-hair-society
npm install
cp .env.example .env.local
```

## 2. Supabase

Create a project at [supabase.com](https://supabase.com), then from
**Project Settings → API** copy into `.env.local`:

| Setting | Variable |
| --- | --- |
| Project URL | `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` `public` key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` key | `SUPABASE_SERVICE_ROLE_KEY` |

> The service-role key bypasses Row Level Security. It belongs only in server
> environment variables — never in `NEXT_PUBLIC_*`, never in the browser.

### Apply the migrations

Either paste each file in `supabase/migrations/` into the SQL editor **in
numerical order**, or use the CLI:

```bash
npx supabase link --project-ref <your-ref>
npx supabase db push
```

Then seed, in this order:

```bash
psql "$SUPABASE_DB_URL" -f supabase/seed.sql       # salon, hours, tags, templates
psql "$SUPABASE_DB_URL" -f supabase/catalogue.sql  # the real 77-service catalogue
psql "$SUPABASE_DB_URL" -f supabase/photos.sql     # the salon's own photographs
```

All three are idempotent — rerunning updates rather than duplicates.

`catalogue.sql` carries the salon's **verified** prices; its durations, buffers
and deposits are estimates and every row is flagged `needs_review`. The
**opening hours in `seed.sql` are still a placeholder**, and the public pages
say so — see [SLICK_MIGRATION.md](./SLICK_MIGRATION.md).

`photos.sql` points the hero, salon interior and four gallery slots at the
files in `public/photos/`, so photography works before Supabase Storage exists.
Replace any of them from **Studio → Photos**.

### Create the first administrator

Roles live in `public.user_roles`, and nothing in the app can grant `admin` —
deliberately. Bootstrap the first one by hand:

1. Sign up through the app, or create a user in **Authentication → Users**.
2. In the SQL editor:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@example.com'
on conflict do nothing;
```

3. Link that account to a stylist record if they also cut hair:

```sql
update public.staff
set profile_id = (select id from auth.users where email = 'you@example.com')
where slug = 'amara-bennett';
```

From then on, administrators manage roles in `/studio/settings`.

## 3. Stripe

From **Developers → API keys** (test mode):

- Publishable key → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- Secret key → `STRIPE_SECRET_KEY`

Then forward webhooks to your machine:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the `whsec_…` it prints into `STRIPE_WEBHOOK_SECRET`.

**This is not optional.** The webhook is the only thing that confirms a
booking. Without it, deposits are taken and appointments stay in
`pending_payment` until the sweep job cancels them.

Test cards: `4242 4242 4242 4242` succeeds, `4000 0000 0000 9995` is declined.

## 4. Email and SMS (optional locally)

Without these, messages are still written to `message_deliveries` and marked
`skipped` with the reason — the ledger never claims something was sent when it
was not. To send for real:

- **Resend**: create an API key, verify a sending domain, set `RESEND_API_KEY`
  and `EMAIL_FROM` (must be on the verified domain).
- **Twilio**: set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and
  `TWILIO_PHONE_NUMBER` in E.164 form.

## 5. Cron secret

```bash
openssl rand -hex 32   # → CRON_SECRET
```

Locally you can fire the jobs by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/sweep-holds
curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/messages
curl -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/waitlist
```

## 6. Run it

```bash
npm run dev
```

Walk the whole journey: <http://localhost:3000/book> → choose a service and
stylist → pick a time → fill in details → pay with the test card. The
appointment should appear in `/studio/calendar` within a second of the webhook
landing.

## Local database (no Supabase needed)

For schema work and the integration tests, a plain PostgreSQL 16 instance is
enough. `supabase/local/00_shim.sql` recreates the small part of the Supabase
platform the migrations depend on — the `auth` schema, `auth.uid()` and the
`anon`/`authenticated`/`service_role` roles.

```bash
./scripts/db-reset.sh     # drop, recreate, apply every migration
./scripts/db-test.sh      # the above, plus seed, plus the SQL test suites
npm run db:types          # regenerate src/lib/supabase/types.ts
```

`db-test.sh` runs 13 constraint groups and 8 RLS groups. A clean run means
every assertion held, including that a direct `INSERT` cannot overlap an
existing booking and that a customer cannot read another customer's data.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Vitest (unit + database integration) |
| `npm run test:e2e` | Playwright |
| `npm run db:reset` | Rebuild the local database |
| `npm run db:test` | Rebuild, seed and run the SQL suites |
| `npm run db:types` | Regenerate database types |

## Troubleshooting

**Bookings never leave “awaiting payment”** — the webhook is not arriving.
Check `stripe listen` is running and `STRIPE_WEBHOOK_SECRET` matches.

**“Invalid public environment variables”** — `NEXT_PUBLIC_SUPABASE_URL` or the
anon key is missing from `.env.local`. Restart the dev server after editing it.

**Every slot shows as unavailable** — the seed's rosters cover Tuesday to
Saturday only, and the salon closes at 18:00 on Tuesday and Wednesday. A
90-minute service with a 15-minute buffer cannot start after 16:15 on those
days. Check `staff_schedules` and `opening_hours`.

**`npm test` skips the database tests** — that is by design when nothing is
listening on `DATABASE_URL`. Run `./scripts/db-test.sh` first.


## Photography

The site reads its photographs from the `site_images` table, managed at
**/studio/photos**.

**No setup needed:** commit images to `public/photos/` and point each slot at
`/photos/<name>.jpg` using the "Use a path" tab. This works immediately, with
no storage bucket and no credentials.

**For uploads from Studio**, create the storage bucket once:

1. Supabase dashboard → Storage → New bucket
2. Name it `site-images`
3. Mark it **public** — these are photographs on a public website
4. Leave the file size limit at the default; the app refuses anything over 8 MB

Uploads are stored as `<salon-id>/<slot>-<timestamp>.<ext>`. Replacing a
photograph writes a new object rather than overwriting, so a cached copy of the
old one cannot linger at the same URL.

If the bucket does not exist, the upload says so plainly and points at the path
route instead — nothing breaks.
