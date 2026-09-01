import { Client, Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Database integration tests.
 *
 * The SQL suite in supabase/local/ proves the rules sequentially. This proves
 * them under genuine concurrency: two connections racing for the same chair in
 * overlapping transactions, which is the case that actually happens when two
 * customers tap "book" at the same moment.
 *
 * Skipped automatically when no database is reachable, so `npm test` still
 * runs on a machine without PostgreSQL.
 *
 * Set up with:  ./scripts/db-reset.sh && psql -d prestige_test -f supabase/seed.sql
 */

const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/prestige_test";

let available = false;
let pool: Pool;

// Fixtures resolved from the seed.
let salonId: string;
let staffId: string;
let otherStaffId: string;
let serviceId: string;
const customerA = "aaaaaaaa-0000-4000-8000-000000000001";
const customerB = "aaaaaaaa-0000-4000-8000-000000000002";

beforeAll(async () => {
  try {
    const probe = new Client({ connectionString: DATABASE_URL, connectionTimeoutMillis: 2000 });
    await probe.connect();
    await probe.end();
    available = true;
  } catch {
    console.warn("[db tests] no database at %s -- skipping", DATABASE_URL);
    return;
  }

  pool = new Pool({ connectionString: DATABASE_URL, max: 8 });

  const { rows } = await pool.query(`
    select
      (select id from public.salons limit 1) as salon_id,
      (select id from public.staff where slug = 'amara-bennett') as staff_id,
      (select id from public.staff where slug = 'rebecca-adeyemi') as other_staff_id,
      (select id from public.services where slug = 'silk-press') as service_id
  `);

  salonId = rows[0].salon_id;
  staffId = rows[0].staff_id;
  otherStaffId = rows[0].other_staff_id;
  serviceId = rows[0].service_id;

  // Two test customers, created through the same trigger real sign-ups use.
  await pool.query(
    `insert into auth.users (id, email, raw_user_meta_data) values
       ($1, 'race-a@example.test', '{"first_name":"Race","last_name":"A"}'),
       ($2, 'race-b@example.test', '{"first_name":"Race","last_name":"B"}')
     on conflict (id) do nothing`,
    [customerA, customerB],
  );
});

afterAll(async () => {
  if (!available) return;
  await pool.query("delete from public.bookings where profile_id = any($1)", [
    [customerA, customerB],
  ]);
  await pool.query("delete from public.slot_holds where profile_id = any($1)", [
    [customerA, customerB],
  ]);
  await pool.end();
});

/** A Tuesday two weeks out at the given local time, clear of the lunch break. */
async function futureSlot(localTime: string): Promise<string> {
  const { rows } = await pool.query(
    `select ((
       select d::date from generate_series(
         (now() at time zone 'Europe/London')::date + 7,
         (now() at time zone 'Europe/London')::date + 21,
         interval '1 day') d
       where extract(isodow from d) = 2 limit 1
     ) + $1::time) at time zone 'Europe/London' as slot`,
    [localTime],
  );
  return rows[0].slot.toISOString();
}

describe.runIf(process.env.VITEST_DB !== "off")("booking under concurrency", () => {
  it("lets only one of two simultaneous holds win the same chair", async () => {
    if (!available) return;
    const slot = await futureSlot("11:00");

    // Two connections, two transactions, both opened before either commits.
    const a = await pool.connect();
    const b = await pool.connect();

    try {
      await a.query("begin");
      await b.query("begin");

      const holdA = a.query("select * from public.hold_slot($1, $2, $3::timestamptz, $4)", [
        staffId,
        serviceId,
        slot,
        customerA,
      ]);
      const holdB = b.query("select * from public.hold_slot($1, $2, $3::timestamptz, $4)", [
        staffId,
        serviceId,
        slot,
        customerB,
      ]);

      const results = await Promise.allSettled([
        holdA.then(() => a.query("commit")),
        holdB.then(() => b.query("commit")),
      ]);

      const won = results.filter((r) => r.status === "fulfilled").length;
      const lost = results.filter((r) => r.status === "rejected").length;

      // Exactly one. Not zero (a deadlock), not two (a double booking).
      expect(won).toBe(1);
      expect(lost).toBe(1);
    } finally {
      await a.query("rollback").catch(() => {});
      await b.query("rollback").catch(() => {});
      a.release();
      b.release();
      await pool.query("delete from public.slot_holds where starts_at = $1", [slot]);
    }
  });

  it("lets two customers hold the same time with different stylists", async () => {
    if (!available) return;
    const slot = await futureSlot("11:00");

    const [a, b] = await Promise.allSettled([
      pool.query("select * from public.hold_slot($1, $2, $3::timestamptz, $4)", [
        staffId,
        serviceId,
        slot,
        customerA,
      ]),
      pool.query("select * from public.hold_slot($1, $2, $3::timestamptz, $4)", [
        otherStaffId,
        serviceId,
        slot,
        customerB,
      ]),
    ]);

    expect(a.status).toBe("fulfilled");
    expect(b.status).toBe("fulfilled");

    await pool.query("delete from public.slot_holds where starts_at = $1", [slot]);
  });

  it("prices from the catalogue, whatever the caller thinks", async () => {
    if (!available) return;
    const slot = await futureSlot("15:00");

    const { rows: holdRows } = await pool.query(
      "select * from public.hold_slot($1, $2, $3::timestamptz, $4)",
      [staffId, serviceId, slot, customerA],
    );
    const holdToken = holdRows[0].hold_token;

    const { rows: bookingRows } = await pool.query(
      "select * from public.book_slot($1, $2)",
      [holdToken, customerA],
    );
    const booking = bookingRows[0];

    const { rows: serviceRows } = await pool.query(
      "select base_price_pence, deposit_pence from public.services where id = $1",
      [serviceId],
    );

    expect(booking.total_price_pence).toBe(serviceRows[0].base_price_pence);
    expect(booking.deposit_pence).toBe(serviceRows[0].deposit_pence);
    expect(booking.status).toBe("pending_payment");

    await pool.query("delete from public.bookings where id = $1", [booking.id]);
  });

  it("survives a replayed payment webhook without double-counting", async () => {
    if (!available) return;
    const slot = await futureSlot("16:00");

    const { rows: holdRows } = await pool.query(
      "select * from public.hold_slot($1, $2, $3::timestamptz, $4)",
      [staffId, serviceId, slot, customerB],
    );
    const { rows: bookingRows } = await pool.query("select * from public.book_slot($1, $2)", [
      holdRows[0].hold_token,
      customerB,
    ]);
    const bookingId = bookingRows[0].id;

    // Stripe retries. Five times, concurrently, for good measure.
    await Promise.all(
      Array.from({ length: 5 }, () =>
        pool.query("select public.confirm_booking_paid($1, $2, 'deposit')", [bookingId, 3000]),
      ),
    );

    const { rows } = await pool.query(
      "select status, deposit_paid_pence from public.bookings where id = $1",
      [bookingId],
    );

    expect(rows[0].status).toBe("confirmed");
    expect(rows[0].deposit_paid_pence).toBe(3000);

    await pool.query("delete from public.bookings where id = $1", [bookingId]);
  });

  it("frees the chair as soon as an abandoned hold expires", async () => {
    if (!available) return;
    // 10:00 opening: Silk Press is 90 min + 15 buffer, so anything after
    // 16:15 on a Tuesday would overrun the 18:00 close and be refused.
    const slot = await futureSlot("10:00");

    const { rows } = await pool.query(
      "select * from public.hold_slot($1, $2, $3::timestamptz, $4)",
      [staffId, serviceId, slot, customerA],
    );

    // A second customer cannot take it while the hold is live.
    await expect(
      pool.query("select * from public.hold_slot($1, $2, $3::timestamptz, $4)", [
        staffId,
        serviceId,
        slot,
        customerB,
      ]),
    ).rejects.toThrow(/slot_unavailable/);

    // Once it lapses, they can.
    await pool.query("update public.slot_holds set expires_at = now() - interval '1 second' where id = $1", [
      rows[0].id,
    ]);

    const { rows: second } = await pool.query(
      "select * from public.hold_slot($1, $2, $3::timestamptz, $4)",
      [staffId, serviceId, slot, customerB],
    );
    expect(second[0].id).toBeTruthy();

    await pool.query("delete from public.slot_holds where starts_at = $1", [slot]);
  });

  it("refuses to book a stylist who does not offer the service", async () => {
    if (!available) return;
    const slot = await futureSlot("11:00");
    const { rows } = await pool.query(
      "select id from public.staff where slug = 'simone-clarke'",
    );

    await expect(
      pool.query("select * from public.hold_slot($1, $2, $3::timestamptz, $4)", [
        rows[0].id,
        serviceId,
        slot,
        customerA,
      ]),
    ).rejects.toThrow(/slot_unavailable/);
  });

  it("keeps availability and the write path in agreement", async () => {
    if (!available) return;
    const slot = await futureSlot("11:00");

    const { rows: before } = await pool.query(
      `select count(*)::int as n from public.available_slots(
         $1, ($2::timestamptz at time zone 'Europe/London')::date,
         ($2::timestamptz at time zone 'Europe/London')::date, $3)
       where slot_start = $2::timestamptz`,
      [serviceId, slot, staffId],
    );
    expect(before[0].n).toBe(1);

    const { rows: holdRows } = await pool.query(
      "select * from public.hold_slot($1, $2, $3::timestamptz, $4)",
      [staffId, serviceId, slot, customerA],
    );

    const { rows: after } = await pool.query(
      `select count(*)::int as n from public.available_slots(
         $1, ($2::timestamptz at time zone 'Europe/London')::date,
         ($2::timestamptz at time zone 'Europe/London')::date, $3)
       where slot_start = $2::timestamptz`,
      [serviceId, slot, staffId],
    );
    // Held slots stop being offered immediately, not after the hold lapses.
    expect(after[0].n).toBe(0);

    await pool.query("delete from public.slot_holds where id = $1", [holdRows[0].id]);
  });
});
