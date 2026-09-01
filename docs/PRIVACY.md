# Privacy and data retention

Notes for whoever operates this system. Not legal advice, and not a substitute
for the salon's own privacy notice — but the technical facts a notice has to be
built on.

The salon is the data controller. Supabase, Vercel, Stripe, Resend and Twilio
are processors, and each needs a processing agreement in place.

## What is stored, and why

| Data | Where | Basis | Notes |
| --- | --- | --- | --- |
| Name, email, phone | `profiles` | Contract | Needed to hold and confirm an appointment |
| Birthday | `profiles` | Consent | Optional; only used for greetings |
| Hair goals | `profiles`, `bookings` | Contract | Supplied by the customer |
| Accessibility requirements | `profiles`, `bookings` | Contract | May imply health information — treat as special category |
| **Allergies and sensitivities** | `profiles.allergies` | Explicit consent | **Special category data** under UK GDPR Art. 9 |
| Appointment history | `bookings` | Contract, then legal obligation | Financial record |
| Payment records | `payments`, `refunds` | Legal obligation | Stripe ids and last four digits only |
| Internal staff notes | `client_notes` | Legitimate interests | Staff-only, but disclosable in a subject access request |
| Before/after photographs | `client_photos` | Explicit consent | Publication gated on a consent record |
| Consent history | `consent_records` | Legal obligation | Evidence that consent was given |
| Message history | `message_deliveries` | Contract / consent | Proof of what was sent |
| Audit log | `audit_logs` | Legitimate interests | Who changed what, never the content |

### What is deliberately not stored

- **Card numbers, CVCs, expiry dates.** These never reach this application.
  The Payment Element is a Stripe-hosted iframe on a different origin; the
  server sees a PaymentIntent id and, after the fact, a brand and last four
  digits.
- **Passwords.** Supabase Auth holds the hashes.
- **Note bodies, allergies, or tokens in the audit log.** `src/lib/audit.ts`
  redacts a keyword list before writing, and truncates free text.

## Special category data

`profiles.allergies` and, in practice, `accessibility_requirements` can reveal
health information. Consequences:

- Both are optional and volunteered.
- Neither is ever exposed to an unauthenticated reader; RLS restricts them to
  the customer and to staff.
- The client record marks allergies with a "sensitive" flag so staff can see
  what they are handling.
- They are excluded from any export that is not explicitly authorised.
- They must not be used for marketing segmentation.

## Photographs

`client_photos.is_published` cannot be true without a `consent_record_id` — a
`CHECK` constraint, not a convention:

```sql
constraint client_photos_consent_required check (
  not is_published or consent_record_id is not null
)
```

Consent is per-photo, recorded with the document version the customer agreed
to, and withdrawal is a new `consent_records` row rather than an edit — so the
history of what was agreed, and when, survives.

## Retention

Nothing is deleted automatically. These are the periods to implement and put
in the privacy notice; the salon owner should confirm them.

| Data | Suggested period | Why |
| --- | --- | --- |
| Payment records | 6 years after the tax year | HMRC requirement |
| Bookings | 6 years | Tied to the payment record |
| Profiles (no bookings) | 24 months of inactivity | No reason to keep them |
| Internal notes | 3 years after the last visit | Service continuity |
| Photographs | Until consent is withdrawn | |
| Consent records | 6 years after withdrawal | Evidence |
| Message deliveries | 24 months | Dispute resolution |
| Audit logs | 24 months | Security investigation |

`deleted_at` columns exist on the tables where a soft delete is the right
answer. Financial records use `ON DELETE RESTRICT` so a profile cannot be
hard-deleted out from under a booking.

## Requests from customers

**Access.** Everything about one person:

```sql
select * from public.profiles where id = :id;
select * from public.bookings where profile_id = :id;
select * from public.payments where profile_id = :id;
select * from public.client_notes where profile_id = :id;   -- yes, these too
select * from public.consent_records where profile_id = :id;
select * from public.message_deliveries where profile_id = :id;
```

Internal notes are disclosable. Staff should be told this — the studio UI says
so above the note field.

**Erasure.** Not absolute: financial records must be kept. The workable
approach is to anonymise the profile (replace name, email and phone with
placeholders, null the free-text and health fields, delete the notes and
photos) while leaving the booking and payment rows intact and pointing at the
anonymised profile.

**Objection to marketing.** `/account/preferences`, immediately. Reminders for
an appointment the customer has actually booked are contractual, not
marketing, and continue.

## Transfers

Supabase and Vercel should both be configured in an EU or UK region. Stripe,
Resend and Twilio process in the US under their standard contractual clauses.
Check the region setting when creating each project — it cannot be changed
afterwards.

## Breach

The audit log answers "who touched what, when". If a breach is suspected:

1. Rotate `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` and `CRON_SECRET`.
2. Query `audit_logs` for the window in question.
3. Check Supabase's own auth logs for unexpected sign-ins.
4. The ICO must be told within 72 hours where the risk warrants it.
