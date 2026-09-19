-- 0013_marketing.sql
-- CRM email distribution (marketing broadcasts / newsletters).
--
-- Marketing sends reuse the existing message_deliveries ledger so they share
-- the same idempotency, consent and audit machinery as transactional mail. The
-- only new thing they need is a message_kind to file under.

-- ADD VALUE cannot be used in the same transaction that creates it, so this is
-- its own migration and nothing below references the new value.
alter type public.message_kind add value if not exists 'marketing_campaign';
