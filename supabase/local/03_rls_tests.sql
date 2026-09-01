-- 03_rls_tests.sql
-- Proof that Row Level Security isolates customers from each other and keeps
-- internal notes out of customer reach.
--
-- Runs as the `authenticated` role with request.jwt.claim.sub set to the user
-- under test, which is exactly how PostgREST executes a customer's query.

\set ON_ERROR_STOP on
set client_min_messages = notice;

-- Fixtures created by 02_constraint_tests.sql are reused here.
-- ada = customer A, bea = customer B, amara = a stylist.

-- A note only staff may read.
insert into public.client_notes (profile_id, author_id, body, kind)
values (
  '22222222-2222-4222-8222-222222222222',
  '44444444-4444-4444-8444-444444444444',
  'INTERNAL: prefers minimal small talk; sensitive scalp.',
  'note'
);

grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on all tables in schema public to anon;
grant usage, select on all sequences in schema public to authenticated;

do $$
declare
  v_ada uuid := '22222222-2222-4222-8222-222222222222';
  v_bea uuid := '33333333-3333-4333-8333-333333333333';
  v_count integer;
begin
  raise notice '--- RLS ---';

  -- =========================================================================
  raise notice '1. a customer sees only their own bookings';
  -- =========================================================================

  set local role authenticated;
  perform set_config('request.jwt.claim.sub', v_ada::text, true);

  select count(*) into v_count from public.bookings;
  if v_count <> 1 then
    raise exception 'FAIL 1: Ada should see exactly 1 booking, saw %', v_count;
  end if;

  perform set_config('request.jwt.claim.sub', v_bea::text, true);
  select count(*) into v_count from public.bookings;
  if v_count <> 0 then
    raise exception 'FAIL 1: Bea should see 0 bookings, saw %', v_count;
  end if;
  raise notice '   ok - Ada sees 1, Bea sees 0';

  -- =========================================================================
  raise notice '2. a customer cannot read another customer profile';
  -- =========================================================================

  select count(*) into v_count from public.profiles;
  if v_count <> 1 then
    raise exception 'FAIL 2: Bea should see only herself, saw % profiles', v_count;
  end if;
  raise notice '   ok - profile visibility limited to self';

  -- =========================================================================
  raise notice '3. internal client notes are invisible to customers';
  -- =========================================================================

  perform set_config('request.jwt.claim.sub', v_ada::text, true);
  select count(*) into v_count from public.client_notes;
  if v_count <> 0 then
    raise exception 'FAIL 3: customer read % internal notes', v_count;
  end if;
  raise notice '   ok - the note about Ada is invisible to Ada';

  -- =========================================================================
  raise notice '4. a customer cannot write staff-only data';
  -- =========================================================================

  begin
    insert into public.client_notes (profile_id, body) values (v_ada, 'self-authored');
    raise exception 'FAIL 4: customer inserted an internal note';
  exception
    when insufficient_privilege then raise notice '   ok - note insert denied';
  end;

  begin
    update public.services set base_price_pence = 1 where slug = 'silk-press';
    if found then
      raise exception 'FAIL 4: customer repriced the catalogue';
    end if;
    raise notice '   ok - catalogue write matched no rows';
  exception
    when insufficient_privilege then raise notice '   ok - catalogue write denied';
  end;

  -- =========================================================================
  raise notice '5. a customer cannot grant themselves a role';
  -- =========================================================================

  begin
    insert into public.user_roles (user_id, role) values (v_ada, 'admin');
    raise exception 'FAIL 5: privilege escalation succeeded';
  exception
    when insufficient_privilege then raise notice '   ok - role grant denied';
  end;

  -- =========================================================================
  raise notice '6. a customer owns their booking row but not its money or timing';
  -- =========================================================================

  begin
    update public.bookings set total_price_pence = 0 where profile_id = v_ada;
    raise exception 'FAIL 6: customer rewrote the price';
  exception
    when sqlstate '42501' then raise notice '   ok - price write rejected (%)', sqlerrm;
  end;

  begin
    update public.bookings set deposit_paid_pence = 99999 where profile_id = v_ada;
    raise exception 'FAIL 6: customer marked their own deposit paid';
  exception
    when sqlstate '42501' then raise notice '   ok - deposit write rejected';
  end;

  begin
    update public.bookings set starts_at = starts_at + interval '1 day' where profile_id = v_ada;
    raise exception 'FAIL 6: customer moved their own appointment directly';
  exception
    when sqlstate '42501' then raise notice '   ok - direct reschedule rejected';
  end;

  begin
    update public.bookings set status = 'completed' where profile_id = v_ada;
    raise exception 'FAIL 6: customer marked their booking completed';
  exception
    when sqlstate '42501' then raise notice '   ok - illegal status transition rejected';
  end;

  begin
    update public.bookings set internal_notes = 'peeking' where profile_id = v_ada;
    raise exception 'FAIL 6: customer wrote internal notes';
  exception
    when sqlstate '42501' then raise notice '   ok - internal notes write rejected';
  end;

  -- ...but cancelling, which the portal offers, is allowed.
  update public.bookings set status = 'cancelled_by_customer' where profile_id = v_ada;
  select count(*) into v_count
  from public.bookings where profile_id = v_ada and status = 'cancelled_by_customer';
  if v_count <> 1 then
    raise exception 'FAIL 6: customer could not cancel their own booking';
  end if;
  raise notice '   ok - cancelling own booking still works';

  -- Restore for the staff checks below.
  perform set_config('app.privileged_write', 'on', true);
  update public.bookings set status = 'confirmed' where profile_id = v_ada;
  perform set_config('app.privileged_write', 'off', true);

  -- =========================================================================
  raise notice '6b. a customer cannot fabricate a payment';
  -- =========================================================================

  begin
    insert into public.payments (
      profile_id, salon_id, kind, amount_pence, status, stripe_payment_intent_id
    ) values (
      v_ada, '11111111-1111-4111-8111-111111111111', 'deposit', 3000,
      'succeeded', 'pi_fake_from_the_browser'
    );
    raise exception 'FAIL 6b: customer inserted a payment';
  exception
    when sqlstate '42501' then raise notice '   ok - payment insert rejected';
    when insufficient_privilege then raise notice '   ok - payment insert denied by RLS';
  end;

  -- =========================================================================
  raise notice '7. staff see what they need to';
  -- =========================================================================

  perform set_config('request.jwt.claim.sub', '44444444-4444-4444-8444-444444444444', true);

  select count(*) into v_count from public.client_notes;
  if v_count <> 1 then
    raise exception 'FAIL 7: stylist should see 1 note, saw %', v_count;
  end if;

  select count(*) into v_count from public.bookings;
  if v_count <> 1 then
    raise exception 'FAIL 7: stylist should see the booking, saw %', v_count;
  end if;
  raise notice '   ok - stylist reads notes and bookings';

  -- A stylist is not a manager: no access to money or settings writes.
  begin
    insert into public.discount_codes (salon_id, code, percent_off)
    values ('11111111-1111-4111-8111-111111111111', 'FREEBIE', 100);
    raise exception 'FAIL 7: stylist created a discount code';
  exception
    when insufficient_privilege then raise notice '   ok - stylist cannot create discounts';
  end;

  -- =========================================================================
  raise notice '8. anonymous visitors see the catalogue and nothing else';
  -- =========================================================================

  reset role;
  set local role anon;
  perform set_config('request.jwt.claim.sub', '', true);

  select count(*) into v_count from public.services;
  if v_count = 0 then
    raise exception 'FAIL 8: anon cannot read the public catalogue';
  end if;

  select count(*) into v_count from public.bookings;
  if v_count <> 0 then
    raise exception 'FAIL 8: anon read % bookings', v_count;
  end if;

  select count(*) into v_count from public.profiles;
  if v_count <> 0 then
    raise exception 'FAIL 8: anon read % profiles', v_count;
  end if;

  select count(*) into v_count from public.client_notes;
  if v_count <> 0 then
    raise exception 'FAIL 8: anon read % internal notes', v_count;
  end if;
  raise notice '   ok - catalogue readable, everything personal is not';

  reset role;
  raise notice '';
  raise notice 'All RLS tests passed.';
end
$$;
