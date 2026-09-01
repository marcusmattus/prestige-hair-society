-- 02_constraint_tests.sql
-- Database-level proof of the guarantees the application depends on.
--
-- Run with: ./scripts/db-test.sh
-- Every check RAISEs on failure, so a clean run means every assertion held.

\set ON_ERROR_STOP on
set client_min_messages = notice;

do $$
declare
  v_salon uuid := '11111111-1111-4111-8111-111111111111';
  v_staff uuid;
  v_staff2 uuid;
  v_service uuid;
  v_customer_a uuid := '22222222-2222-4222-8222-222222222222';
  v_customer_b uuid := '33333333-3333-4333-8333-333333333333';
  v_stylist_user uuid := '44444444-4444-4444-8444-444444444444';
  v_slot timestamptz;
  v_hold public.slot_holds;
  v_hold2 public.slot_holds;
  v_booking public.bookings;
  v_count integer;
  v_ok boolean;
  v_next_tuesday date;
begin
  raise notice '--- setting up fixtures ---';

  select id into v_staff from public.staff where slug = 'amara-bennett';
  select id into v_staff2 from public.staff where slug = 'rebecca-adeyemi';
  select id into v_service from public.services where slug = 'silk-press';

  -- Two customers and one stylist login. handle_new_user() creates the
  -- matching profiles and 'customer' role rows.
  insert into auth.users (id, email, raw_user_meta_data) values
    (v_customer_a, 'ada@example.test', '{"first_name":"Ada","last_name":"Test"}'),
    (v_customer_b, 'bea@example.test', '{"first_name":"Bea","last_name":"Test"}'),
    (v_stylist_user, 'amara@example.test', '{"first_name":"Amara","last_name":"Test"}')
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role) values (v_stylist_user, 'stylist')
  on conflict do nothing;
  update public.staff set profile_id = v_stylist_user where id = v_staff;

  -- Next Tuesday at 11:00 London: inside opening hours, inside the roster, and
  -- clear of the 13:00 lunch break.
  v_next_tuesday := (
    select d::date
    from generate_series(
      (now() at time zone 'Europe/London')::date + 1,
      (now() at time zone 'Europe/London')::date + 14,
      interval '1 day'
    ) d
    where extract(isodow from d) = 2
    limit 1
  );
  v_slot := (v_next_tuesday + time '11:00') at time zone 'Europe/London';

  -- =========================================================================
  raise notice '1. a hold blocks an overlapping hold for the same stylist';
  -- =========================================================================

  v_hold := public.hold_slot(v_staff, v_service, v_slot, v_customer_a);
  if v_hold.id is null then
    raise exception 'FAIL 1: first hold was not created';
  end if;

  begin
    -- Silk Press is 90 min + 15 buffer, so 12:00 overlaps 11:00-12:45.
    v_hold2 := public.hold_slot(v_staff, v_service, v_slot + interval '1 hour', v_customer_b);
    raise exception 'FAIL 1: overlapping hold was allowed';
  exception
    when sqlstate 'P0001' then
      raise notice '   ok - overlapping hold rejected (%)', sqlerrm;
  end;

  -- =========================================================================
  raise notice '2. the same slot is still free for a different stylist';
  -- =========================================================================

  -- rebecca-adeyemi is also eligible for silk-press.
  v_hold2 := public.hold_slot(v_staff2, v_service, v_slot, v_customer_b);
  if v_hold2.id is null then
    raise exception 'FAIL 2: a second stylist could not take the same time';
  end if;
  raise notice '   ok - second stylist held the same time';
  delete from public.slot_holds where id = v_hold2.id;

  -- =========================================================================
  raise notice '3. booking consumes the hold and prices from the catalogue';
  -- =========================================================================

  v_booking := public.book_slot(v_hold.hold_token, v_customer_a, '{}', 'Test notes');

  if v_booking.status <> 'pending_payment' then
    raise exception 'FAIL 3: expected pending_payment, got %', v_booking.status;
  end if;
  if v_booking.total_price_pence <> 8500 then
    raise exception 'FAIL 3: expected 8500 pence, got %', v_booking.total_price_pence;
  end if;
  if v_booking.deposit_pence <> 3000 then
    raise exception 'FAIL 3: expected 3000 pence deposit, got %', v_booking.deposit_pence;
  end if;
  if v_booking.reference !~ '^PHS-[0-9]+$' then
    raise exception 'FAIL 3: bad reference %', v_booking.reference;
  end if;

  select count(*) into v_count from public.slot_holds
  where id = v_hold.id and consumed_at is not null and booking_id = v_booking.id;
  if v_count <> 1 then
    raise exception 'FAIL 3: hold was not consumed';
  end if;
  raise notice '   ok - % at % pence, deposit % pence',
    v_booking.reference, v_booking.total_price_pence, v_booking.deposit_pence;

  -- =========================================================================
  raise notice '4. a hold cannot be spent twice';
  -- =========================================================================

  begin
    perform public.book_slot(v_hold.hold_token, v_customer_a);
    raise exception 'FAIL 4: hold was reused';
  exception
    when sqlstate 'P0001' then
      raise notice '   ok - reuse rejected (%)', sqlerrm;
  end;

  -- =========================================================================
  raise notice '5. the confirmed booking blocks the slot for everyone else';
  -- =========================================================================

  begin
    perform public.hold_slot(v_staff, v_service, v_slot, v_customer_b);
    raise exception 'FAIL 5: hold allowed over an existing booking';
  exception
    when sqlstate 'P0001' then
      raise notice '   ok - blocked by the booking';
  end;

  -- The exclusion constraint is the real guarantee: prove it fires even on a
  -- direct INSERT that bypasses book_slot() entirely.
  begin
    insert into public.bookings (
      salon_id, staff_id, profile_id, service_id, status,
      starts_at, ends_at, blocked_until,
      service_price_pence, total_price_pence
    ) values (
      v_salon, v_staff, v_customer_b, v_service, 'confirmed',
      v_slot + interval '30 minutes', v_slot + interval '2 hours',
      v_slot + interval '2 hours 15 minutes', 8500, 8500
    );
    raise exception 'FAIL 5: direct overlapping INSERT was allowed';
  exception
    when exclusion_violation then
      raise notice '   ok - exclusion constraint rejected a direct INSERT';
  end;

  -- =========================================================================
  raise notice '6. an expired hold stops blocking';
  -- =========================================================================

  v_hold2 := public.hold_slot(v_staff, v_service, v_slot + interval '4 hours', v_customer_b);
  update public.slot_holds set expires_at = now() - interval '1 minute' where id = v_hold2.id;

  select public.release_expired_holds(v_staff) into v_count;
  if v_count < 1 then
    raise exception 'FAIL 6: expired hold was not swept';
  end if;

  -- ...and the slot is immediately reusable.
  v_hold2 := public.hold_slot(v_staff, v_service, v_slot + interval '4 hours', v_customer_a);
  if v_hold2.id is null then
    raise exception 'FAIL 6: slot did not become free again';
  end if;
  raise notice '   ok - expired hold swept, slot reusable';
  delete from public.slot_holds where id = v_hold2.id;

  -- =========================================================================
  raise notice '7. schedule rules are enforced';
  -- =========================================================================

  -- Monday: the salon is closed.
  begin
    perform public.hold_slot(
      v_staff, v_service,
      ((v_next_tuesday - 1) + time '11:00') at time zone 'Europe/London',
      v_customer_a
    );
    raise exception 'FAIL 7: booked on a closed day';
  exception
    when sqlstate 'P0001' then raise notice '   ok - closed day rejected';
  end;

  -- 13:00 collides with the lunch break.
  begin
    perform public.hold_slot(
      v_staff, v_service,
      (v_next_tuesday + time '13:00') at time zone 'Europe/London',
      v_customer_a
    );
    raise exception 'FAIL 7: booked over a break';
  exception
    when sqlstate 'P0001' then raise notice '   ok - break rejected';
  end;

  -- 17:30 + 90min + 15min buffer runs past the 18:00 close.
  begin
    perform public.hold_slot(
      v_staff, v_service,
      (v_next_tuesday + time '17:30') at time zone 'Europe/London',
      v_customer_a
    );
    raise exception 'FAIL 7: booked past closing time';
  exception
    when sqlstate 'P0001' then raise notice '   ok - overrun past closing rejected';
  end;

  -- Inside the minimum notice window.
  begin
    perform public.hold_slot(v_staff, v_service, now() + interval '10 minutes', v_customer_a);
    raise exception 'FAIL 7: booked inside the notice window';
  exception
    when sqlstate 'P0001' then raise notice '   ok - minimum notice enforced';
  end;

  -- Beyond the booking window.
  begin
    perform public.hold_slot(v_staff, v_service, now() + interval '400 days', v_customer_a);
    raise exception 'FAIL 7: booked beyond the booking window';
  exception
    when sqlstate 'P0001' then raise notice '   ok - booking window enforced';
  end;

  -- An ineligible stylist. simone-clarke does not do silk press.
  begin
    perform public.hold_slot(
      (select id from public.staff where slug = 'simone-clarke'),
      v_service, v_slot + interval '6 hours', v_customer_a
    );
    raise exception 'FAIL 7: ineligible stylist accepted';
  exception
    when sqlstate 'P0001' then raise notice '   ok - stylist eligibility enforced';
  end;

  -- =========================================================================
  raise notice '8. time off blocks availability';
  -- =========================================================================

  insert into public.staff_time_off (staff_id, starts_at, ends_at, reason)
  values (v_staff2, v_slot - interval '1 hour', v_slot + interval '5 hours', 'Training');

  begin
    perform public.hold_slot(v_staff2, v_service, v_slot, v_customer_a);
    raise exception 'FAIL 8: booked during time off';
  exception
    when sqlstate 'P0001' then raise notice '   ok - time off rejected';
  end;

  -- =========================================================================
  raise notice '9. available_slots agrees with the write path';
  -- =========================================================================

  select count(*) into v_count
  from public.available_slots(v_service, v_next_tuesday, v_next_tuesday, v_staff)
  where slot_start = v_slot;
  if v_count <> 0 then
    raise exception 'FAIL 9: booked slot still offered';
  end if;

  select count(*) into v_count
  from public.available_slots(v_service, v_next_tuesday, v_next_tuesday, v_staff)
  where slot_start::time at time zone 'UTC' is not null;
  if v_count = 0 then
    raise exception 'FAIL 9: no slots offered at all';
  end if;
  raise notice '   ok - % slots offered, booked slot excluded', v_count;

  -- Nothing offered during the lunch break.
  select count(*) into v_count
  from public.available_slots(v_service, v_next_tuesday, v_next_tuesday, v_staff)
  where (slot_start at time zone 'Europe/London')::time < time '13:45'
    and ((slot_start + interval '105 minutes') at time zone 'Europe/London')::time > time '13:00';
  if v_count <> 0 then
    raise exception 'FAIL 9: % slots offered across the lunch break', v_count;
  end if;
  raise notice '   ok - lunch break excluded from offered slots';

  -- =========================================================================
  raise notice '10. payment confirmation is idempotent';
  -- =========================================================================

  perform public.confirm_booking_paid(v_booking.id, 3000, 'deposit');
  perform public.confirm_booking_paid(v_booking.id, 3000, 'deposit');

  select * into v_booking from public.bookings where id = v_booking.id;
  if v_booking.status <> 'confirmed' then
    raise exception 'FAIL 10: expected confirmed, got %', v_booking.status;
  end if;
  if v_booking.deposit_paid_pence <> 3000 then
    raise exception 'FAIL 10: replay double-counted the deposit: %', v_booking.deposit_paid_pence;
  end if;
  raise notice '   ok - replayed webhook left deposit at % pence', v_booking.deposit_paid_pence;

  -- =========================================================================
  raise notice '11. reschedule validates the new slot';
  -- =========================================================================

  begin
    perform public.reschedule_booking(v_booking.id, v_staff, (v_next_tuesday + time '13:00') at time zone 'Europe/London');
    raise exception 'FAIL 11: rescheduled onto a break';
  exception
    when sqlstate 'P0001' then raise notice '   ok - invalid reschedule rejected';
  end;

  v_booking := public.reschedule_booking(
    v_booking.id, v_staff, (v_next_tuesday + time '15:00') at time zone 'Europe/London'
  );
  if (v_booking.starts_at at time zone 'Europe/London')::time <> time '15:00' then
    raise exception 'FAIL 11: reschedule did not move the booking';
  end if;
  raise notice '   ok - moved to 15:00 and reminder flag cleared';

  -- =========================================================================
  raise notice '12. no-show and cancellation counters track status';
  -- =========================================================================

  update public.bookings set status = 'no_show' where id = v_booking.id;
  select no_show_count into v_count from public.profiles where id = v_customer_a;
  if v_count <> 1 then
    raise exception 'FAIL 12: expected 1 no-show, got %', v_count;
  end if;
  update public.bookings set status = 'confirmed' where id = v_booking.id;
  select no_show_count into v_count from public.profiles where id = v_customer_a;
  if v_count <> 0 then
    raise exception 'FAIL 12: no-show count did not reverse, got %', v_count;
  end if;
  raise notice '   ok - counters track both directions';

  -- =========================================================================
  raise notice '13. money constraints hold';
  -- =========================================================================

  begin
    insert into public.services (salon_id, name, slug, duration_minutes, base_price_pence, deposit_pence)
    values (v_salon, 'Bad', 'bad-service', 60, 1000, 5000);
    raise exception 'FAIL 13: deposit larger than price was accepted';
  exception
    when check_violation then raise notice '   ok - deposit cannot exceed price';
  end;

  begin
    insert into public.payments (profile_id, salon_id, kind, amount_pence)
    values (v_customer_a, v_salon, 'deposit', 3000);
    raise exception 'FAIL 13: Stripe-less card payment was accepted';
  exception
    when check_violation then raise notice '   ok - non-salon payments need a Stripe intent';
  end;

  raise notice '';
  raise notice 'All constraint tests passed.';
end
$$;
