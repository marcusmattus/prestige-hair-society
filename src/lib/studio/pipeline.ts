import { balanceDue } from "@/lib/money";
import { toSalonDate } from "@/lib/time";

/**
 * The booking pipeline.
 *
 * A booking's `status` column says what it is; a stage says what the salon
 * needs to *do* about it. Those are not the same question. "Confirmed" covers
 * both an appointment three weeks out and one walking through the door in an
 * hour, and "completed" covers both a settled bill and eighty pounds nobody
 * has chased.
 *
 * Stages are derived, never stored: a booking cannot drift out of step with
 * its own money, and there is no second source of truth to reconcile.
 */

export type PipelineStage =
  | "awaiting_deposit"
  | "confirmed"
  | "today"
  | "balance_due"
  | "settled"
  | "lost";

export const PIPELINE_STAGES: PipelineStage[] = [
  "awaiting_deposit",
  "today",
  "confirmed",
  "balance_due",
  "settled",
  "lost",
];

export const STAGE_META: Record<
  PipelineStage,
  { label: string; hint: string; tone: "warn" | "active" | "good" | "muted" }
> = {
  awaiting_deposit: {
    label: "Awaiting deposit",
    hint: "Booked, but the deposit has not cleared. These release automatically.",
    tone: "warn",
  },
  today: {
    label: "In today",
    hint: "Confirmed and due in the salon today.",
    tone: "active",
  },
  confirmed: {
    label: "Confirmed",
    hint: "Deposit taken, appointment ahead.",
    tone: "good",
  },
  balance_due: {
    label: "Balance outstanding",
    hint: "Service done, money still owed.",
    tone: "warn",
  },
  settled: {
    label: "Settled",
    hint: "Done and paid in full.",
    tone: "good",
  },
  lost: {
    label: "Cancelled or missed",
    hint: "Cancelled by either side, or a no-show.",
    tone: "muted",
  },
};

export type StageInput = {
  status: string;
  startsAt: string;
  totalPricePence: number;
  depositPaidPence: number;
  balancePaidPence: number;
};

/**
 * Which stage a booking sits in.
 *
 * `now` and `timezone` are parameters rather than ambient reads so this stays
 * pure: the same booking always lands in the same stage for a given moment,
 * and "today" means the salon's today, not the server's.
 */
export function pipelineStage(
  booking: StageInput,
  now: Date,
  timezone = "Europe/London",
): PipelineStage {
  if (
    booking.status === "cancelled_by_customer" ||
    booking.status === "cancelled_by_salon" ||
    booking.status === "no_show"
  ) {
    return "lost";
  }

  const outstanding = balanceDue(
    booking.totalPricePence,
    booking.depositPaidPence,
    booking.balancePaidPence,
  );

  if (booking.status === "completed") {
    return outstanding > 0 ? "balance_due" : "settled";
  }

  if (booking.status === "pending_payment") return "awaiting_deposit";

  // Confirmed: split by whether it is happening today, because that is the
  // difference between "keep an eye on it" and "get the chair ready".
  if (toSalonDate(booking.startsAt, timezone) === toSalonDate(now, timezone)) {
    return "today";
  }

  return "confirmed";
}

/** Has this booking's deposit actually been taken? */
export function depositState(booking: {
  depositPence: number;
  depositPaidPence: number;
}): "none_required" | "paid" | "outstanding" {
  if (booking.depositPence === 0) return "none_required";
  return booking.depositPaidPence >= booking.depositPence ? "paid" : "outstanding";
}

export type PipelineTotals = {
  count: number;
  /** Deposits actually received, in pence. */
  depositsPaidPence: number;
  /** Still owed in the salon, in pence. */
  outstandingPence: number;
};

export function totalsFor(bookings: (StageInput & { depositPence: number })[]): PipelineTotals {
  return bookings.reduce<PipelineTotals>(
    (acc, b) => ({
      count: acc.count + 1,
      depositsPaidPence: acc.depositsPaidPence + b.depositPaidPence,
      outstandingPence:
        acc.outstandingPence +
        balanceDue(b.totalPricePence, b.depositPaidPence, b.balancePaidPence),
    }),
    { count: 0, depositsPaidPence: 0, outstandingPence: 0 },
  );
}
