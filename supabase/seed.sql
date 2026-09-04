-- seed.sql
-- The salon record, its opening hours, client tags and message templates.
--
-- Production-safe and idempotent: every insert is keyed on a stable slug, so
-- running it again updates rather than duplicates.
--
-- The service catalogue and stylists are NOT here -- they live in
-- supabase/catalogue.sql, which carries the salon's real, verified prices.
-- The placeholder catalogue the SQL test suites are written against lives in
-- supabase/local/01_test_fixtures.sql.
--
-- Opening hours below are still a PLACEHOLDER pending confirmation against the
-- salon's live schedule; the public pages say so.

--   psql -d <db> -f supabase/seed.sql
--   psql -d <db> -f supabase/catalogue.sql

-- ---------------------------------------------------------------------------
-- Salon
-- ---------------------------------------------------------------------------

insert into public.salons (
  id, name, slug, address_line1, city, postcode, country_code,
  latitude, longitude, phone, email, timezone, currency,
  booking_window_days, min_notice_minutes, cancellation_window_hours,
  reschedule_window_hours, slot_interval_minutes, hold_duration_minutes,
  tagline, about, google_maps_url
)
values (
  '11111111-1111-4111-8111-111111111111',
  'Prestige Hair Society',
  'prestige-hair-society',
  '2 Queens Road',
  'London',
  'SW11 1AA', -- PLACEHOLDER: confirm the exact postcode before launch
  'GB',
  51.4640, -0.1660, -- PLACEHOLDER coordinates for Battersea
  null,
  null,
  'Europe/London',
  'GBP',
  60, 120, 24, 24, 15, 10,
  'Hair care, elevated to an art.',
  'Prestige Hair Society was built around a simple idea: a salon should give '
  'more back to your hair than it takes. Every appointment starts with an '
  'honest assessment, and every service is chosen for the condition of your '
  'hair rather than a trend.',
  'https://maps.google.com/?q=2+Queens+Road+Battersea+London'
)
on conflict (slug) do update set
  name = excluded.name,
  address_line1 = excluded.address_line1,
  tagline = excluded.tagline;

-- Opening hours. PLACEHOLDER: verify against the salon's live schedule.
insert into public.opening_hours (salon_id, day_of_week, opens_at, closes_at, is_closed)
values
  ('11111111-1111-4111-8111-111111111111', 1, '10:00', '18:00', true),  -- Monday closed
  ('11111111-1111-4111-8111-111111111111', 2, '10:00', '18:00', false),
  ('11111111-1111-4111-8111-111111111111', 3, '10:00', '18:00', false),
  ('11111111-1111-4111-8111-111111111111', 4, '10:00', '20:00', false),
  ('11111111-1111-4111-8111-111111111111', 5, '10:00', '20:00', false),
  ('11111111-1111-4111-8111-111111111111', 6, '09:00', '18:00', false),
  ('11111111-1111-4111-8111-111111111111', 7, '10:00', '18:00', true)   -- Sunday closed
on conflict (salon_id, day_of_week) do update set
  opens_at = excluded.opens_at,
  closes_at = excluded.closes_at,
  is_closed = excluded.is_closed;

-- ---------------------------------------------------------------------------
-- Client tags
-- ---------------------------------------------------------------------------

insert into public.client_tags (salon_id, name, colour)
values
  ('11111111-1111-4111-8111-111111111111', 'VIP', '#AF946A'),
  ('11111111-1111-4111-8111-111111111111', 'Colour client', '#53664A'),
  ('11111111-1111-4111-8111-111111111111', 'New', '#8F9B7B'),
  ('11111111-1111-4111-8111-111111111111', 'Patch test on file', '#687067')
on conflict (salon_id, name) do nothing;

-- ---------------------------------------------------------------------------
-- Message templates. {{placeholders}} are rendered by src/lib/comms/render.ts.
-- ---------------------------------------------------------------------------

insert into public.message_templates (salon_id, kind, channel, subject, body)
values
  ('11111111-1111-4111-8111-111111111111', 'booking_confirmation', 'email',
   'Your appointment at Prestige Hair Society — {{booking.reference}}',
   E'Hello {{customer.firstName}},\n\n'
   'Your appointment is confirmed.\n\n'
   'Service: {{booking.serviceName}}\n'
   'Stylist: {{booking.staffName}}\n'
   'When: {{booking.whenLong}}\n'
   'Where: {{salon.address}}\n\n'
   'Deposit paid: {{booking.depositPaid}}\n'
   'Balance in salon: {{booking.balance}}\n\n'
   'Before you come: {{service.preparation}}\n\n'
   'Manage your booking: {{links.manage}}\n\n'
   'Prestige Hair Society'),

  ('11111111-1111-4111-8111-111111111111', 'booking_confirmation', 'sms', null,
   'Prestige Hair Society: {{booking.serviceName}} with {{booking.staffName}}, '
   '{{booking.whenShort}}. Ref {{booking.reference}}. Manage: {{links.manage}}'),

  ('11111111-1111-4111-8111-111111111111', 'deposit_receipt', 'email',
   'Receipt for your {{salon.name}} deposit',
   E'Hello {{customer.firstName}},\n\n'
   'We have received your deposit of {{payment.amount}} for booking '
   '{{booking.reference}}.\n\n'
   'Balance due in salon: {{booking.balance}}\n\n'
   'Prestige Hair Society'),

  ('11111111-1111-4111-8111-111111111111', 'appointment_reminder', 'email',
   'Your appointment on {{booking.whenShort}}',
   E'Hello {{customer.firstName}},\n\n'
   'A reminder of your appointment.\n\n'
   '{{booking.serviceName}} with {{booking.staffName}}\n'
   '{{booking.whenLong}}\n'
   '{{salon.address}}\n\n'
   'Before you come: {{service.preparation}}\n\n'
   'Need to change it? {{links.manage}}'),

  ('11111111-1111-4111-8111-111111111111', 'appointment_reminder', 'sms', null,
   'Reminder: {{booking.serviceName}} with {{booking.staffName}} '
   '{{booking.whenShort}} at Prestige Hair Society. Change: {{links.manage}}'),

  ('11111111-1111-4111-8111-111111111111', 'reschedule_confirmation', 'email',
   'Your appointment has moved — {{booking.reference}}',
   E'Hello {{customer.firstName}},\n\n'
   'Your appointment is now {{booking.whenLong}} with {{booking.staffName}}.\n\n'
   'Prestige Hair Society'),

  ('11111111-1111-4111-8111-111111111111', 'cancellation_confirmation', 'email',
   'Your appointment has been cancelled',
   E'Hello {{customer.firstName}},\n\n'
   'Your appointment on {{booking.whenLong}} has been cancelled.\n\n'
   '{{booking.refundNote}}\n\n'
   'Book again whenever you are ready: {{links.book}}'),

  ('11111111-1111-4111-8111-111111111111', 'waitlist_availability', 'email',
   'A slot has opened up',
   E'Hello {{customer.firstName}},\n\n'
   'A {{booking.serviceName}} slot has opened on {{booking.whenLong}} with '
   '{{booking.staffName}}.\n\n'
   'It is offered first to you until {{waitlist.expiresAt}}: {{links.offer}}'),

  ('11111111-1111-4111-8111-111111111111', 'payment_failure', 'email',
   'We could not take your deposit',
   E'Hello {{customer.firstName}},\n\n'
   'Your payment for {{booking.reference}} did not go through, so the slot has '
   'not been held.\n\nTry again: {{links.retry}}'),

  ('11111111-1111-4111-8111-111111111111', 'refund_confirmation', 'email',
   'Your refund has been issued',
   E'Hello {{customer.firstName}},\n\n'
   'We have refunded {{payment.amount}} for booking {{booking.reference}}. It '
   'usually reaches your account within five working days.'),

  ('11111111-1111-4111-8111-111111111111', 'post_appointment_thanks', 'email',
   'Thank you for visiting us',
   E'Hello {{customer.firstName}},\n\n'
   'Thank you for coming in. Your aftercare notes:\n\n{{service.aftercare}}\n\n'
   'Book your next visit: {{links.book}}'),

  ('11111111-1111-4111-8111-111111111111', 'review_request', 'email',
   'How was your visit?',
   E'Hello {{customer.firstName}},\n\n'
   'If you have a moment, we would be grateful for your thoughts on your '
   'recent {{booking.serviceName}}.\n\n{{links.review}}'),

  ('11111111-1111-4111-8111-111111111111', 'rebooking_reminder', 'email',
   'Time for your next appointment?',
   E'Hello {{customer.firstName}},\n\n'
   'It has been {{booking.weeksSince}} weeks since your last '
   '{{booking.serviceName}}. Shall we get you back in?\n\n{{links.book}}')
on conflict (salon_id, kind, channel) do update set
  subject = excluded.subject,
  body = excluded.body;

-- ---------------------------------------------------------------------------
-- Alerts to the salon. These go to salons.notification_email, not to a
-- customer, and are the "somebody has booked" notification on the owner's
-- phone. They run through the same idempotent ledger, so a replayed Stripe
-- webhook cannot produce a second alert for the same booking.
-- ---------------------------------------------------------------------------

insert into public.message_templates (salon_id, kind, channel, subject, body)
values
  ('11111111-1111-4111-8111-111111111111', 'staff_booking_alert', 'email',
   'New booking: {{booking.serviceName}}, {{booking.whenShort}}',
   E'{{customer.fullName}} has booked.\n\n'
   'Service: {{booking.serviceName}}\n'
   'Stylist: {{booking.staffName}}\n'
   'When: {{booking.whenLong}}\n'
   'Duration: {{booking.duration}}\n\n'
   'Price: {{booking.total}}\n'
   'Deposit paid: {{booking.depositPaid}}\n'
   'Balance in salon: {{booking.balance}}\n\n'
   'Contact: {{customer.email}} / {{customer.phone}}\n'
   'Notes: {{booking.customerNotes}}\n\n'
   'Reference {{booking.reference}}\n'
   'Open in Studio: {{links.studio}}'),

  ('11111111-1111-4111-8111-111111111111', 'staff_cancellation_alert', 'email',
   'Cancelled: {{booking.serviceName}}, {{booking.whenShort}}',
   E'{{customer.fullName}} has cancelled.\n\n'
   'Service: {{booking.serviceName}}\n'
   'Stylist: {{booking.staffName}}\n'
   'When: {{booking.whenLong}}\n\n'
   '{{booking.refundNote}}\n\n'
   'The slot is free again and anyone on the waiting list for it will be '
   'offered it automatically.\n\n'
   'Reference {{booking.reference}}\n'
   'Open in Studio: {{links.studio}}')
on conflict (salon_id, kind, channel) do update set
  subject = excluded.subject,
  body = excluded.body;
