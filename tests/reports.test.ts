import { describe, expect, it } from "vitest";
import {
  customerSplit,
  percent,
  rosteredMinutes,
  serviceMix,
  staffPerformance,
  totals,
  type ReportBooking,
  type ReportPayment,
} from "@/lib/studio/reports";

const booking = (over: Partial<ReportBooking> = {}): ReportBooking => ({
  id: "b1",
  profileId: "p1",
  serviceId: "s1",
  serviceName: "Silk Press",
  staffId: "st1",
  staffName: "Nekeia",
  status: "completed",
  startsAt: "2026-09-08T09:00:00Z",
  endsAt: "2026-09-08T10:30:00Z",
  blockedUntil: "2026-09-08T10:45:00Z",
  totalPricePence: 7000,
  depositPaidPence: 2000,
  balancePaidPence: 5000,
  ...over,
});

const payment = (over: Partial<ReportPayment> = {}): ReportPayment => ({
  kind: "deposit",
  status: "succeeded",
  amountPence: 2000,
  refundedPence: 0,
  paidAt: "2026-09-01T09:00:00Z",
  ...over,
});

describe("totals", () => {
  it("counts kept, cancelled and no-shows", () => {
    const t = totals(
      [
        booking({ id: "1", status: "completed" }),
        booking({ id: "2", status: "confirmed" }),
        booking({ id: "3", status: "cancelled_by_customer" }),
        booking({ id: "4", status: "no_show" }),
      ],
      [],
    );

    expect(t.kept).toBe(2);
    expect(t.completed).toBe(1);
    expect(t.cancelled).toBe(1);
    expect(t.noShows).toBe(1);
    expect(t.booked).toBe(4);
  });

  it("excludes unpaid bookings from the loss rate", () => {
    // A booking that never got paid was never confirmed, so counting it as a
    // loss would make the salon look worse than it is.
    const t = totals(
      [
        booking({ id: "1", status: "completed" }),
        booking({ id: "2", status: "no_show" }),
        booking({ id: "3", status: "pending_payment" }),
        booking({ id: "4", status: "pending_payment" }),
      ],
      [],
    );

    expect(t.booked).toBe(2);
    expect(t.noShowRate).toBe(0.5);
  });

  it("reports zero rates rather than dividing by zero", () => {
    const t = totals([], []);
    expect(t.lossRate).toBe(0);
    expect(t.noShowRate).toBe(0);
    expect(t.takingsPence).toBe(0);
  });

  it("nets refunds off takings", () => {
    const t = totals(
      [],
      [
        payment({ amountPence: 5000, refundedPence: 0 }),
        payment({ amountPence: 3000, refundedPence: 3000, status: "refunded" }),
        payment({ amountPence: 2000, refundedPence: 500, status: "partially_refunded" }),
      ],
    );
    // The fully refunded payment has status 'refunded', which is not settled,
    // so it is excluded entirely: 5000 + (2000 - 500).
    expect(t.takingsPence).toBe(6500);
  });

  it("counts only deposits in the deposit total", () => {
    const t = totals(
      [],
      [
        payment({ kind: "deposit", amountPence: 2000 }),
        payment({ kind: "in_salon", amountPence: 5000 }),
      ],
    );
    expect(t.takingsPence).toBe(7000);
    expect(t.depositsPence).toBe(2000);
  });

  it("sums what is still owed, never going negative", () => {
    const t = totals(
      [
        // Fully settled.
        booking({ id: "1", totalPricePence: 7000, depositPaidPence: 2000, balancePaidPence: 5000 }),
        // Deposit only.
        booking({ id: "2", totalPricePence: 8000, depositPaidPence: 3000, balancePaidPence: 0 }),
        // Overpaid, which must not subtract from the total.
        booking({ id: "3", totalPricePence: 5000, depositPaidPence: 6000, balancePaidPence: 0 }),
      ],
      [],
    );
    expect(t.outstandingPence).toBe(5000);
  });

  it("values only kept appointments", () => {
    const t = totals(
      [
        booking({ id: "1", status: "completed", totalPricePence: 7000 }),
        booking({ id: "2", status: "no_show", totalPricePence: 9900 }),
      ],
      [],
    );
    expect(t.bookedValuePence).toBe(7000);
  });
});

describe("serviceMix", () => {
  it("ranks by value, not by volume", () => {
    // Four cheap cuts out-number one colour, but the colour earns more.
    const mix = serviceMix([
      ...Array.from({ length: 4 }, (_, i) =>
        booking({ id: `c${i}`, serviceId: "cut", serviceName: "Cut", totalPricePence: 3000 }),
      ),
      booking({ id: "col", serviceId: "colour", serviceName: "Colour", totalPricePence: 15000 }),
    ]);

    expect(mix[0].name).toBe("Colour");
    expect(mix[0].valuePence).toBe(15000);
    expect(mix[1].name).toBe("Cut");
    expect(mix[1].count).toBe(4);
  });

  it("ignores appointments that were not kept", () => {
    const mix = serviceMix([
      booking({ id: "1", status: "completed" }),
      booking({ id: "2", status: "cancelled_by_customer" }),
    ]);
    expect(mix[0].count).toBe(1);
  });
});

describe("staffPerformance", () => {
  it("computes utilisation against rostered minutes", () => {
    // 105 booked minutes against 420 rostered = 25%.
    const rows = staffPerformance(
      [booking({ startsAt: "2026-09-08T09:00:00Z", blockedUntil: "2026-09-08T10:45:00Z" })],
      new Map([["st1", 420]]),
    );
    expect(rows[0].bookedMinutes).toBe(105);
    expect(rows[0].utilisation).toBeCloseTo(0.25, 5);
  });

  it("caps utilisation at 100%", () => {
    // A manual booking outside the roster would otherwise report >100%, which
    // reads as a bug rather than a fact about the day.
    const rows = staffPerformance([booking()], new Map([["st1", 30]]));
    expect(rows[0].utilisation).toBe(1);
  });

  it("reports zero utilisation when no roster is set", () => {
    const rows = staffPerformance([booking()], new Map());
    expect(rows[0].utilisation).toBe(0);
  });
});

describe("customerSplit", () => {
  it("counts a first-ever appointment as new", () => {
    const split = customerSplit(
      [booking({ profileId: "p1", startsAt: "2026-09-08T09:00:00Z" })],
      new Map([["p1", "2026-09-08T09:00:00Z"]]),
    );
    expect(split.newCustomers).toBe(1);
    expect(split.returning).toBe(0);
  });

  it("counts someone with earlier history as returning", () => {
    const split = customerSplit(
      [booking({ profileId: "p1", startsAt: "2026-09-08T09:00:00Z" })],
      new Map([["p1", "2024-01-01T09:00:00Z"]]),
    );
    expect(split.newCustomers).toBe(0);
    expect(split.returning).toBe(1);
  });

  it("counts a person once however many times they came", () => {
    const split = customerSplit(
      [
        booking({ id: "1", profileId: "p1", startsAt: "2026-09-08T09:00:00Z" }),
        booking({ id: "2", profileId: "p1", startsAt: "2026-09-20T09:00:00Z" }),
      ],
      new Map([["p1", "2026-09-08T09:00:00Z"]]),
    );
    expect(split.newCustomers + split.returning).toBe(1);
  });
});

describe("rosteredMinutes", () => {
  it("counts each occurrence of a weekday in the window", () => {
    // 2026-09-07 is a Monday; a fortnight contains two Tuesdays.
    const minutes = rosteredMinutes(
      [{ staff_id: "st1", day_of_week: 2, starts_at: "10:00", ends_at: "18:00" }],
      [],
      new Date("2026-09-07T00:00:00Z"),
      new Date("2026-09-20T00:00:00Z"),
    );
    expect(minutes.get("st1")).toBe(2 * 8 * 60);
  });

  it("subtracts breaks", () => {
    const minutes = rosteredMinutes(
      [{ staff_id: "st1", day_of_week: 2, starts_at: "10:00", ends_at: "18:00" }],
      [{ staff_id: "st1", day_of_week: 2, starts_at: "13:00", ends_at: "13:45" }],
      new Date("2026-09-07T00:00:00Z"),
      new Date("2026-09-13T00:00:00Z"),
    );
    expect(minutes.get("st1")).toBe(8 * 60 - 45);
  });

  it("never returns a negative when a break exceeds the shift", () => {
    const minutes = rosteredMinutes(
      [{ staff_id: "st1", day_of_week: 2, starts_at: "10:00", ends_at: "11:00" }],
      [{ staff_id: "st1", day_of_week: 2, starts_at: "10:00", ends_at: "18:00" }],
      new Date("2026-09-07T00:00:00Z"),
      new Date("2026-09-13T00:00:00Z"),
    );
    expect(minutes.get("st1")).toBe(0);
  });
});

describe("percent", () => {
  it.each([
    [0, "0%"],
    [0.5, "50%"],
    [0.125, "13%"],
    [1, "100%"],
  ])("formats %f as %s", (input, expected) => {
    expect(percent(input)).toBe(expected);
  });
});
