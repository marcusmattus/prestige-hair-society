-- 04_demo_data.sql
-- Fictional people and appointments, for local development and end-to-end
-- tests. Apply after supabase/seed.sql:
--
--   ./scripts/db-reset.sh && psql -d prestige_test -f supabase/seed.sql \
--     && psql -d prestige_test -f supabase/local/04_demo_data.sql
--
-- NEVER apply this to a production project, and never put real customer data
-- in it. Every name, address and note below is invented. Emails use the
-- reserved .test TLD so none of them can reach a real inbox.
--
-- On a real Supabase project the auth users must be created through the Admin
-- API instead -- see scripts/seed-users.ts -- because auth.users carries
-- password and identity columns this file does not populate.

set client_min_messages = warning;

do $$
declare
  v_salon uuid := '11111111-1111-4111-8111-111111111111';
  v_nekeia uuid;
  v_silk uuid;
  v_cut uuid;
  v_colour uuid;
  v_treatment uuid;
  v_hold public.slot_holds;
  v_booking public.bookings;
  v_next_tuesday date;
  v_next_thursday date;
  v_last_month timestamptz;

  -- Fictional customers. The dddddddd- space is reserved for demo data so it
  -- can never collide with the aaaaaaaa- fixtures in the integration tests.
  v_ada uuid := 'dddddddd-0000-4000-8000-000000000001';
  v_bea uuid := 'dddddddd-0000-4000-8000-000000000002';
  v_cleo uuid := 'dddddddd-0000-4000-8000-000000000003';
  v_dara uuid := 'dddddddd-0000-4000-8000-000000000004';

  -- Fictional staff logins.
  v_owner uuid := 'bbbbbbbb-0000-4000-8000-000000000001';
  v_desk uuid := 'bbbbbbbb-0000-4000-8000-000000000002';
  v_stylist uuid := 'bbbbbbbb-0000-4000-8000-000000000003';
begin
  -- The real catalogue has one stylist, so every appointment below belongs to
  -- her and they must not overlap. Durations come from supabase/catalogue.sql.
  select id into v_nekeia from public.staff where slug = 'nekeia-griffith';
  select id into v_silk from public.services where slug = 'silk-press-short-hair';        -- 90 + 15
  select id into v_cut from public.services where slug = 'wash-and-blow-dry-medium-hair'; -- 75 + 15
  select id into v_colour from public.services where slug = 'full-head-colour';           -- 90 + 15
  select id into v_treatment from public.services where slug = 'olaplex-rebuilding-treatment'; -- 45 + 15

  -- -------------------------------------------------------------------------
  -- People. handle_new_user() creates the profile and the 'customer' role.
  -- -------------------------------------------------------------------------

  insert into auth.users (id, email, raw_user_meta_data) values
    (v_ada,     'ada@example.test',     '{"first_name":"Ada","last_name":"Nwosu","phone":"07700 900001"}'),
    (v_bea,     'bea@example.test',     '{"first_name":"Bea","last_name":"Fairhurst","phone":"07700 900002"}'),
    (v_cleo,    'cleo@example.test',    '{"first_name":"Cleo","last_name":"Marsden","phone":"07700 900003"}'),
    (v_dara,    'dara@example.test',    '{"first_name":"Dara","last_name":"Whitfield","phone":"07700 900004"}'),
    (v_owner,   'owner@example.test',   '{"first_name":"Rowan","last_name":"Ellis","phone":"07700 900010"}'),
    (v_desk,    'desk@example.test',    '{"first_name":"Priya","last_name":"Raman","phone":"07700 900011"}'),
    (v_stylist, 'stylist@example.test', '{"first_name":"Amara","last_name":"Bennett","phone":"07700 900012"}')
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role) values
    (v_owner, 'admin'),
    (v_owner, 'manager'),
    (v_desk, 'receptionist'),
    (v_stylist, 'stylist')
  on conflict (user_id, role) do nothing;

  -- Give one stylist a login so the "stylist sees only their own column" path
  -- can be exercised.
  update public.staff set profile_id = v_stylist where id = v_nekeia;

  -- Customer context a stylist would actually rely on.
  update public.profiles set
    hair_goals = 'Growing out a bob. Wants length without losing the shape.',
    marketing_email = true,
    reminder_sms = true,
    favourite_staff_id = v_nekeia
  where id = v_ada;

  update public.profiles set
    hair_goals = 'Grey blending, as low-maintenance as possible.',
    allergies = 'Reacted to a PPD-based colour in 2023. Patch test every time.',
    accessibility_requirements = 'Prefers a chair near the front; uses a stick.',
    favourite_staff_id = v_nekeia
  where id = v_bea;

  update public.profiles set
    hair_goals = 'Protective styles between big events.',
    marketing_sms = true
  where id = v_cleo;

  -- -------------------------------------------------------------------------
  -- Dates: the next Tuesday and Thursday, both open days in the seed.
  -- -------------------------------------------------------------------------

  select d::date into v_next_tuesday
  from generate_series(
    (now() at time zone 'Europe/London')::date + 1,
    (now() at time zone 'Europe/London')::date + 14,
    interval '1 day'
  ) d
  where extract(isodow from d) = 2
  limit 1;

  select d::date into v_next_thursday
  from generate_series(
    (now() at time zone 'Europe/London')::date + 1,
    (now() at time zone 'Europe/London')::date + 14,
    interval '1 day'
  ) d
  where extract(isodow from d) = 4
  limit 1;

  -- -------------------------------------------------------------------------
  -- Upcoming appointments, booked the way a customer would book them so every
  -- constraint and price rule applies.
  -- -------------------------------------------------------------------------

  v_hold := public.hold_slot(v_nekeia, v_silk, (v_next_tuesday + time '10:00') at time zone 'Europe/London', v_ada);
  v_booking := public.book_slot(v_hold.hold_token, v_ada, '{}', 'Please keep as much length as possible.');
  perform public.confirm_booking_paid(v_booking.id, 2000, 'deposit');

  insert into public.payments (
    booking_id, profile_id, salon_id, kind, status, amount_pence,
    stripe_payment_intent_id, payment_method_brand, payment_method_last4, paid_at
  ) values (
    v_booking.id, v_ada, v_salon, 'deposit', 'succeeded', 2000,
    'pi_demo_' || replace(v_booking.id::text, '-', ''), 'visa', '4242', now()
  );

  v_hold := public.hold_slot(v_nekeia, v_colour, (v_next_thursday + time '14:00') at time zone 'Europe/London', v_bea);
  v_booking := public.book_slot(v_hold.hold_token, v_bea, '{}', 'Patch test done on the 3rd.');
  perform public.confirm_booking_paid(v_booking.id, 2000, 'deposit');

  insert into public.payments (
    booking_id, profile_id, salon_id, kind, status, amount_pence,
    stripe_payment_intent_id, payment_method_brand, payment_method_last4, paid_at
  ) values (
    v_booking.id, v_bea, v_salon, 'deposit', 'succeeded', 2000,
    'pi_demo_' || replace(v_booking.id::text, '-', ''), 'mastercard', '4444', now()
  );

  v_hold := public.hold_slot(v_nekeia, v_treatment, (v_next_tuesday + time '15:00') at time zone 'Europe/London', v_cleo);
  v_booking := public.book_slot(v_hold.hold_token, v_cleo);
  perform public.confirm_booking_paid(v_booking.id, 2000, 'deposit');

  -- A booking still awaiting payment, so the pipeline has something in it.
  v_hold := public.hold_slot(v_nekeia, v_cut, (v_next_thursday + time '16:00') at time zone 'Europe/London', v_dara);
  perform public.book_slot(v_hold.hold_token, v_dara);

  -- -------------------------------------------------------------------------
  -- History. Inserted directly: hold_slot() rightly refuses past dates.
  -- -------------------------------------------------------------------------

  v_last_month := (v_next_tuesday - 35 + time '10:00') at time zone 'Europe/London';

  insert into public.bookings (
    salon_id, staff_id, profile_id, service_id, status,
    starts_at, ends_at, blocked_until,
    service_price_pence, total_price_pence, deposit_pence,
    deposit_paid_pence, balance_paid_pence, completed_at, source
  ) values (
    v_salon, v_nekeia, v_ada, v_silk, 'completed',
    v_last_month, v_last_month + interval '90 minutes', v_last_month + interval '105 minutes',
    7000, 7000, 2000, 2000, 5000, v_last_month + interval '105 minutes', 'web'
  ) returning * into v_booking;

  insert into public.payments (
    booking_id, profile_id, salon_id, kind, status, amount_pence,
    stripe_payment_intent_id, paid_at
  ) values (
    v_booking.id, v_ada, v_salon, 'deposit', 'succeeded', 2000,
    'pi_demo_past_' || replace(v_booking.id::text, '-', ''), v_last_month - interval '10 days'
  );

  insert into public.payments (
    booking_id, profile_id, salon_id, kind, status, amount_pence,
    recorded_by_staff_id, paid_at
  ) values (
    v_booking.id, v_ada, v_salon, 'in_salon', 'succeeded', 5000,
    v_nekeia, v_last_month + interval '105 minutes'
  );

  -- A no-show, so the counters and the client profile have something to show.
  insert into public.bookings (
    salon_id, staff_id, profile_id, service_id, status,
    starts_at, ends_at, blocked_until,
    service_price_pence, total_price_pence, deposit_pence, deposit_paid_pence, source
  ) values (
    v_salon, v_nekeia, v_dara, v_cut,
    'confirmed', -- set to no_show below so the counter trigger fires
    v_last_month + interval '2 days', v_last_month + interval '2 days 90 minutes',
    v_last_month + interval '2 days 105 minutes',
    6000, 6000, 2000, 2000, 'web'
  ) returning * into v_booking;

  update public.bookings set status = 'no_show' where id = v_booking.id;

  -- -------------------------------------------------------------------------
  -- CRM context
  -- -------------------------------------------------------------------------

  insert into public.client_notes (profile_id, author_id, body, kind) values
    (v_ada, v_stylist, 'Fine density through the crown. Keep heat below 180.', 'note'),
    (v_ada, v_stylist, 'Silk press: 170C, two passes, light serum only.', 'formula'),
    (v_bea, v_owner, 'Patch test on file, dated. Re-test every visit regardless.', 'note'),
    (v_cleo, v_stylist, 'Sensitive at the nape — braid loosely there.', 'note');

  insert into public.client_tag_links (profile_id, tag_id, applied_by)
  select v_ada, id, v_owner from public.client_tags where name = 'VIP'
  on conflict do nothing;

  insert into public.client_tag_links (profile_id, tag_id, applied_by)
  select v_bea, id, v_owner from public.client_tags where name = 'Patch test on file'
  on conflict do nothing;

  insert into public.consent_records (profile_id, kind, granted, source, document_version) values
    (v_ada, 'marketing_email', true, 'web', 'v1'),
    (v_ada, 'terms', true, 'web', 'v1'),
    (v_bea, 'terms', true, 'web', 'v1'),
    (v_cleo, 'marketing_sms', true, 'web', 'v1');

  -- Somebody waiting for a Tuesday cancellation.
  insert into public.waitlist_entries (
    salon_id, profile_id, service_id, staff_id,
    earliest_date, latest_date, times_of_day, status
  ) values (
    v_salon, v_cleo, v_silk, v_nekeia,
    v_next_tuesday, v_next_tuesday + 14, '{morning,afternoon}', 'active'
  );

  raise notice 'Demo data loaded.';
  raise notice '  customers: ada@example.test, bea@example.test, cleo@example.test, dara@example.test';
  raise notice '  staff:     owner@example.test (admin), desk@example.test (reception), stylist@example.test';
end
$$;
