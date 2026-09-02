import { describe, expect, it } from "vitest";
import {
  depositState,
  pipelineStage,
  totalsFor,
  type StageInput,
} from "@/lib/studio/pipeline";

// A fixed "now": 09:00 London on Wednesday 15 July 2026 (BST, so 08:00Z).
const NOW = new Date("2026-07-15T08:00:00Z");

const booking = (over: Partial<StageInput> = {}): StageInput => ({
  status: "confirmed",
  startsAt: "2026-07-20T09:00:00Z",
  totalPricePence: 8500,
  depositPaidPence: 3000,
  balancePaidPence: 0,
  ...over,
});

describe("pipelineStage", () => {
  it("puts an unpaid booking in the chase list", () => {
    expect(pipelineStage(booking({ status: "pending_payment", depositPaidPence: 0 }), NOW)).toBe(
      "awaiting_deposit",
    );
  });

  it("separates today from the rest of the diary", () => {
    // Same salon-local day as NOW.
    expect(pipelineStage(booking({ startsAt: "2026-07-15T13:00:00Z" }), NOW)).toBe("today");
    expect(pipelineStage(booking({ startsAt: "2026-07-16T09:00:00Z" }), NOW)).toBe("confirmed");
  });

  it("uses the salon's day, not the server's", () => {
    // 23:30 London on the 15th is 22:30Z the same day: still today.
    expect(pipelineStage(booking({ startsAt: "2026-07-15T22:30:00Z" }), NOW)).toBe("today");
    // 00:30 London on the 16th is 23:30Z on the 15th: no longer today, even
    // though the UTC date still reads the 15th.
    expect(pipelineStage(booking({ startsAt: "2026-07-15T23:30:00Z" }), NOW)).toBe("confirmed");
  });

  it("splits completed work by whether it was actually paid for", () => {
    expect(
      pipelineStage(booking({ status: "completed", depositPaidPence: 3000 }), NOW),
    ).toBe("balance_due");

    expect(
      pipelineStage(
        booking({ status: "completed", depositPaidPence: 3000, balancePaidPence: 5500 }),
        NOW,
      ),
    ).toBe("settled");
  });

  it("treats an over-payment as settled rather than as a credit", () => {
    expect(
      pipelineStage(
        booking({ status: "completed", depositPaidPence: 9000, balancePaidPence: 0 }),
        NOW,
      ),
    ).toBe("settled");
  });

  it("collects every kind of lost booking in one place", () => {
    for (const status of ["cancelled_by_customer", "cancelled_by_salon", "no_show"]) {
      expect(pipelineStage(booking({ status }), NOW)).toBe("lost");
    }
  });

  it("does not chase money on a cancelled booking", () => {
    // Cancelled wins over an outstanding balance: nobody should be chased for
    // an appointment that never happened.
    expect(
      pipelineStage(
        booking({ status: "cancelled_by_salon", depositPaidPence: 0, balancePaidPence: 0 }),
        NOW,
      ),
    ).toBe("lost");
  });

  it("is stable — the same booking and moment always give the same stage", () => {
    const b = booking();
    expect(pipelineStage(b, NOW)).toBe(pipelineStage(b, NOW));
  });
});

describe("depositState", () => {
  it("distinguishes not-required from unpaid", () => {
    // A £0 deposit service is not "outstanding"; nobody owes anything.
    expect(depositState({ depositPence: 0, depositPaidPence: 0 })).toBe("none_required");
    expect(depositState({ depositPence: 3000, depositPaidPence: 0 })).toBe("outstanding");
    expect(depositState({ depositPence: 3000, depositPaidPence: 3000 })).toBe("paid");
  });

  it("counts an overpayment as paid", () => {
    expect(depositState({ depositPence: 3000, depositPaidPence: 5000 })).toBe("paid");
  });

  it("counts a part-payment as still outstanding", () => {
    expect(depositState({ depositPence: 3000, depositPaidPence: 1000 })).toBe("outstanding");
  });
});

describe("totalsFor", () => {
  it("adds up what came in and what is still owed", () => {
    const totals = totalsFor([
      { ...booking(), depositPence: 3000 },
      { ...booking({ depositPaidPence: 2500, totalPricePence: 7500 }), depositPence: 2500 },
    ]);

    expect(totals.count).toBe(2);
    expect(totals.depositsPaidPence).toBe(5500);
    // (8500 - 3000) + (7500 - 2500)
    expect(totals.outstandingPence).toBe(10500);
  });

  it("is zero for an empty column", () => {
    expect(totalsFor([])).toEqual({
      count: 0,
      depositsPaidPence: 0,
      outstandingPence: 0,
    });
  });
});
