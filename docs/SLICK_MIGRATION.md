# Migrating from Slick

The salon currently books through
<https://book.getslick.com/#/salon/6580/>. This is how to bring that data
across.

## Before anything else

**Do not scrape the Slick site.** Customer records must come from a lawful
export requested by the salon owner, who is the data controller. Scraping a
booking page to obtain other people's personal data is both a contract breach
and, for the personal data in it, unlawful.

Ask Slick for an export of:

- Services, with categories, durations and prices
- Staff, with their service eligibility
- Opening hours
- Future appointments
- Customers — **only with the owner's written authorisation**, and only for the
  fields you actually need

## What is a placeholder today

`supabase/seed.sql` is entirely placeholder data. Until the export is imported,
the following are invented and must not be presented as real:

- All eight service prices, deposits and durations
- Opening hours
- The six stylist names and biographies
- The Battersea postcode and coordinates

The public pages say so in as many words. That wording should stay until the
real catalogue is in.

## Import order

Dependencies mean the order matters:

1. **Categories** → `service_categories`
2. **Services** → `services` (needs categories)
3. **Staff** → `staff`
4. **Eligibility** → `staff_services` (needs both)
5. **Opening hours** → `opening_hours`, **rosters** → `staff_schedules`
6. **Customers** → `auth.users` + `profiles`
7. **Future appointments** → `bookings` (needs everything above)

Each run is recorded in `import_runs` with its field mapping, a row-level
report and the ids it created, so it can be rolled back.

## Field mapping

### Services

| Slick | This system | Notes |
| --- | --- | --- |
| Name | `services.name` | |
| — | `services.slug` | Generate with `public.slugify(name)`; must be unique |
| Category | `services.category_id` | Create the category first |
| Description | `services.description` | |
| Duration (min) | `services.duration_minutes` | Chair time only |
| — | `services.buffer_minutes` | **Not in Slick.** Ask the salon per service; default 0 |
| Price | `services.base_price_pence` | **× 100.** `£85.00` → `8500` |
| "From" pricing | `services.pricing_mode` | `'from'` or `'fixed'` |
| Deposit | `services.deposit_pence` | × 100; must be ≤ price |

The two that are usually wrong: **prices must be multiplied by 100**, and
**buffer time does not exist in Slick** — without it, back-to-back bookings
leave no time to clean down.

### Customers

| Slick | This system | Notes |
| --- | --- | --- |
| Email | `auth.users.email`, `profiles.email` | Unique; the merge key |
| First / last name | `profiles.first_name` / `last_name` | |
| Mobile | `profiles.phone` | Normalise to E.164 (`toE164()` in `src/lib/comms/send.ts`) |
| Marketing opt-in | `profiles.marketing_email` / `_sms` | **Default to false unless the export proves consent** |
| Notes | `client_notes` | Staff-only. Review before importing — old notes are often unkind |

Imported customers have no password. They sign in with a magic link, or reset
their password. Do **not** invent passwords for them.

Record the provenance of any imported consent:

```sql
insert into public.consent_records (profile_id, kind, granted, source, document_version)
values (:id, 'marketing_email', true, 'import', 'slick-export-2026-01');
```

### Future appointments

Import these last, and expect some to fail: the new system enforces rules Slick
may not have. Overlapping appointments for one stylist will be rejected by the
exclusion constraint — which is the point. Reconcile those by hand.

Set `source = 'import'` and leave `deposit_paid_pence` at whatever the export
proves was actually taken.

## Doing it

The importer lives in `/studio/settings/import` (manager or admin only).

1. **Upload** a CSV. Nothing is written yet.
2. **Map fields** — the mapping is stored on the run, so a later re-import of
   the same shape reuses it.
3. **Preview** — a row-by-row report of what would be created, updated,
   skipped as a duplicate, or rejected as invalid.
4. **Apply** — writes inside a transaction and records the created ids.
5. **Roll back** if it went wrong, which deletes exactly the rows that run
   created and nothing else.

> The importer's UI is not built yet in this repository. The `import_runs`
> table, the mapping and report shape, and the rollback contract are all in
> place; the CSV parsing and screens are outstanding. Until then, import via
> SQL and record a matching `import_runs` row by hand so the audit trail is
> complete.

## Duplicates

Matched on lower-cased email first, then normalised phone. A row matching an
existing profile is reported as a duplicate and skipped rather than merged
automatically — merging two client histories wrongly is much harder to undo
than merging them later.

`/studio/clients` has a merge action for the ones you do want joined.

## After the import

- [ ] Spot-check twenty services against Slick: price, duration, deposit
- [ ] Confirm every service has a buffer, or a deliberate zero
- [ ] Check eligibility: no service should have zero stylists
- [ ] Compare opening hours against the salon's actual week
- [ ] Confirm marketing flags default to off unless consent was exported
- [ ] Book a test appointment for each service to prove availability works
- [ ] Remove the placeholder wording from the public pages
- [ ] Keep Slick live in parallel for a week, and reconcile daily
