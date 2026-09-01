-- seed.sql
-- Salon, catalogue, staff and message templates.
--
-- Every price and every opening hour here is a PLACEHOLDER pending the
-- verified Slick catalogue import (see docs/SLICK_MIGRATION.md). Staff names
-- are fictional. No real customer data belongs in this file.
--
-- Safe to run repeatedly: every insert is keyed on a stable slug.

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
-- Categories
-- ---------------------------------------------------------------------------

insert into public.service_categories (salon_id, name, slug, description, display_order)
values
  ('11111111-1111-4111-8111-111111111111', 'Consultation', 'consultation',
   'Where every relationship with your hair begins.', 1),
  ('11111111-1111-4111-8111-111111111111', 'Cutting', 'cutting',
   'Precision cutting and finishing.', 2),
  ('11111111-1111-4111-8111-111111111111', 'Smoothing', 'smoothing',
   'Silk press and smoothing services.', 3),
  ('11111111-1111-4111-8111-111111111111', 'Colour', 'colour',
   'Bespoke colour, correction and grey blending.', 4),
  ('11111111-1111-4111-8111-111111111111', 'Protective Styling', 'protective-styling',
   'Braiding, extensions and long-term scalp health.', 5),
  ('11111111-1111-4111-8111-111111111111', 'Treatments', 'treatments',
   'Restorative and scalp treatments.', 6),
  ('11111111-1111-4111-8111-111111111111', 'Occasions', 'occasions',
   'Event and bridal styling.', 7)
on conflict (salon_id, slug) do update set name = excluded.name;

-- ---------------------------------------------------------------------------
-- Services. All prices are PLACEHOLDERS in integer pence.
-- ---------------------------------------------------------------------------

insert into public.services (
  salon_id, category_id, name, slug, short_description, description,
  preparation_instructions, aftercare_instructions,
  duration_minutes, buffer_minutes, base_price_pence, pricing_mode,
  deposit_pence, requires_consultation, rebooking_interval_days,
  display_order, is_featured
)
select
  '11111111-1111-4111-8111-111111111111',
  (select id from public.service_categories
   where salon_id = '11111111-1111-4111-8111-111111111111' and slug = v.category_slug),
  v.name, v.slug, v.short_description, v.description,
  v.preparation, v.aftercare,
  v.duration, v.buffer, v.price, v.mode::public.pricing_mode,
  v.deposit, v.consultation, v.rebook, v.display_order, v.featured
from (values
  ('consultation', 'Consultation', 'consultation',
   'Personalised advice to understand your hair goals and build a plan.',
   'A thirty-minute conversation and assessment. We look at the condition of '
   'your hair and scalp, talk through what you want, and build a realistic plan '
   'before any service is booked.',
   'Arrive with your hair as you normally wear it. Please do not wash it that morning.',
   'You will leave with a written plan and product recommendations.',
   30, 0, 4500, 'fixed', 2000, false, null, 1, true),

  ('cutting', 'Wash, Cut & Finish', 'wash-cut-and-finish',
   'Expert cutting with a restorative wash and a flawless finish.',
   'A full wash, cut and finish. Includes a scalp massage and a botanical '
   'treatment matched to your hair type.',
   'Please arrive with dry, detangled hair unless agreed otherwise.',
   'Leave 24 hours before washing to let the shape settle.',
   90, 15, 7500, 'fixed', 2500, false, 42, 2, true),

  ('smoothing', 'Silk Press', 'silk-press',
   'Smooth, shining, beautifully polished results without compromise.',
   'A heat-styled smoothing service using low-tension technique and thermal '
   'protection throughout, finished for movement rather than flatness.',
   'Arrive with clean, detangled hair. Avoid heavy oils for 48 hours beforehand.',
   'Wrap at night and avoid moisture for the first three days.',
   90, 15, 8500, 'fixed', 3000, false, 28, 3, true),

  ('colour', 'Colour Services', 'colour-services',
   'Bespoke colour that enhances your style and complements your tone.',
   'Balayage, grey blending, gloss and correction. Every colour service begins '
   'with a consultation and, where required, a patch test.',
   'A patch test is required at least 48 hours before your appointment.',
   'Use colour-safe products and book a gloss at six weeks.',
   180, 30, 15000, 'from', 5000, true, 42, 4, true),

  ('protective-styling', 'Protective Styling', 'protective-styling',
   'Braiding and protective styles built around long-term scalp health.',
   'Knotless braids, twists and protective sets, installed with low tension.',
   'Arrive with hair washed, deep conditioned and fully detangled.',
   'Cleanse the scalp weekly and keep the style no longer than eight weeks.',
   150, 30, 12000, 'from', 4000, false, 56, 5, false),

  ('treatments', 'Hair Treatments', 'hair-treatments',
   'Restorative bond, protein and scalp treatments.',
   'A targeted treatment chosen after assessment: bond repair, protein '
   'rebalancing or a scalp reset.',
   'Come with hair unwashed for at least 24 hours.',
   'Repeat every four to six weeks for a full course.',
   45, 15, 5500, 'fixed', 2000, false, 35, 6, false),

  ('protective-styling', 'Extensions', 'extensions',
   'Consultation-led extensions, colour-matched and fitted with care.',
   'Weft, tape and micro-ring extensions. Priced after consultation because '
   'hair length, density and quantity all change the cost.',
   'A consultation and colour match are required before booking.',
   'Return every six weeks for a maintenance check.',
   240, 30, 22000, 'from', 7500, true, 42, 7, false),

  ('occasions', 'Event Styling', 'event-styling',
   'Occasion and bridal styling, including trials.',
   'Styling for weddings, events and photography, with an optional trial.',
   'Arrive with clean, dry hair styled as you normally wear it.',
   'Bring pins and a light spray for touch-ups on the day.',
   90, 15, 9000, 'from', 3000, false, null, 8, false)
) as v(category_slug, name, slug, short_description, description, preparation,
       aftercare, duration, buffer, price, mode, deposit, consultation, rebook,
       display_order, featured)
on conflict (salon_id, slug) do update set
  short_description = excluded.short_description,
  description = excluded.description,
  duration_minutes = excluded.duration_minutes,
  base_price_pence = excluded.base_price_pence,
  deposit_pence = excluded.deposit_pence;

-- ---------------------------------------------------------------------------
-- Add-ons
-- ---------------------------------------------------------------------------

insert into public.service_addons (salon_id, name, slug, description, duration_minutes, price_pence, display_order)
values
  ('11111111-1111-4111-8111-111111111111', 'Bond repair treatment', 'bond-repair',
   'An in-service bond rebuilding treatment.', 15, 2500, 1),
  ('11111111-1111-4111-8111-111111111111', 'Scalp ritual', 'scalp-ritual',
   'Extended botanical scalp massage and cleanse.', 20, 2000, 2),
  ('11111111-1111-4111-8111-111111111111', 'Deep conditioning', 'deep-conditioning',
   'Steam-assisted deep conditioning.', 20, 1800, 3),
  ('11111111-1111-4111-8111-111111111111', 'Fringe trim', 'fringe-trim',
   'Fringe shaped and trimmed.', 10, 1000, 4)
on conflict (salon_id, slug) do update set price_pence = excluded.price_pence;

-- Attach the sensible add-ons to each service.
insert into public.service_addon_links (service_id, addon_id)
select s.id, a.id
from public.services s
cross join public.service_addons a
where s.salon_id = '11111111-1111-4111-8111-111111111111'
  and a.salon_id = '11111111-1111-4111-8111-111111111111'
  and (
    (a.slug = 'bond-repair' and s.slug in ('wash-cut-and-finish', 'silk-press', 'colour-services', 'hair-treatments'))
    or (a.slug = 'scalp-ritual' and s.slug in ('wash-cut-and-finish', 'silk-press', 'hair-treatments', 'protective-styling'))
    or (a.slug = 'deep-conditioning' and s.slug in ('silk-press', 'hair-treatments', 'protective-styling'))
    or (a.slug = 'fringe-trim' and s.slug in ('wash-cut-and-finish', 'silk-press'))
  )
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- Staff. Fictional placeholder names and biographies.
-- ---------------------------------------------------------------------------

insert into public.staff (salon_id, display_name, slug, title, bio, specialties, display_order)
values
  ('11111111-1111-4111-8111-111111111111', 'Amara Bennett', 'amara-bennett', 'Senior stylist',
   'Fifteen years behind the chair, with a focus on silk press and precision cutting for textured hair.',
   array['Silk press', 'Precision cutting', 'Textured hair'], 1),
  ('11111111-1111-4111-8111-111111111111', 'Nadia Okonkwo', 'nadia-okonkwo', 'Colour specialist',
   'Balayage, grey blending and colour correction, with a preference for lived-in colour that grows out kindly.',
   array['Balayage', 'Grey blending', 'Colour correction'], 2),
  ('11111111-1111-4111-8111-111111111111', 'Simone Clarke', 'simone-clarke', 'Protective styling',
   'Knotless braiding and extensions, installed with low tension and long-term scalp health in mind.',
   array['Braiding', 'Extensions', 'Scalp health'], 3),
  ('11111111-1111-4111-8111-111111111111', 'Rebecca Adeyemi', 'rebecca-adeyemi', 'Senior stylist',
   'Cutting and finishing for fine and wavy hair, and a steady hand with a first big change.',
   array['Cutting', 'Fine hair', 'Restyles'], 4),
  ('11111111-1111-4111-8111-111111111111', 'Yasmin Haddad', 'yasmin-haddad', 'Treatment specialist',
   'Bond repair, protein rebalancing and scalp treatments, with an assessment-first approach.',
   array['Bond repair', 'Scalp treatments', 'Consultations'], 5),
  ('11111111-1111-4111-8111-111111111111', 'Grace Thompson', 'grace-thompson', 'Stylist',
   'Event and bridal styling, and the person most likely to talk you out of a fringe you will regret.',
   array['Event styling', 'Bridal', 'Blow-dry'], 6)
on conflict (salon_id, slug) do update set
  title = excluded.title,
  bio = excluded.bio,
  specialties = excluded.specialties;

-- Service eligibility.
insert into public.staff_services (staff_id, service_id)
select st.id, sv.id
from public.staff st
join public.services sv on sv.salon_id = st.salon_id
where st.salon_id = '11111111-1111-4111-8111-111111111111'
  and (
    -- Everyone consults.
    sv.slug = 'consultation'
    or (st.slug = 'amara-bennett' and sv.slug in ('wash-cut-and-finish', 'silk-press', 'hair-treatments'))
    or (st.slug = 'nadia-okonkwo' and sv.slug in ('colour-services', 'wash-cut-and-finish', 'hair-treatments'))
    or (st.slug = 'simone-clarke' and sv.slug in ('protective-styling', 'extensions', 'hair-treatments'))
    or (st.slug = 'rebecca-adeyemi' and sv.slug in ('wash-cut-and-finish', 'silk-press', 'event-styling'))
    or (st.slug = 'yasmin-haddad' and sv.slug in ('hair-treatments', 'silk-press'))
    or (st.slug = 'grace-thompson' and sv.slug in ('event-styling', 'wash-cut-and-finish'))
  )
on conflict do nothing;

-- Working patterns, inside the salon's opening hours.
insert into public.staff_schedules (staff_id, day_of_week, starts_at, ends_at)
select st.id, d.day_of_week, d.starts_at, d.ends_at
from public.staff st
cross join (values
  (2, time '10:00', time '18:00'),
  (3, time '10:00', time '18:00'),
  (4, time '10:00', time '20:00'),
  (5, time '10:00', time '20:00'),
  (6, time '09:00', time '18:00')
) as d(day_of_week, starts_at, ends_at)
where st.salon_id = '11111111-1111-4111-8111-111111111111'
on conflict do nothing;

-- A daily lunch break for every stylist.
insert into public.staff_breaks (staff_id, day_of_week, starts_at, ends_at, label)
select st.id, d.day_of_week, time '13:00', time '13:45', 'Lunch'
from public.staff st
cross join generate_series(2, 6) as d(day_of_week)
where st.salon_id = '11111111-1111-4111-8111-111111111111'
on conflict do nothing;

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
