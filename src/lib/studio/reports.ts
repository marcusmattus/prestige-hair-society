/**
 * Report arithmetic, kept apart from the page so it can be tested.
 *
 * Everything here is pure: rows in, numbers out. Money stays integer pence
 * throughout, and rates are returned as fractions rather than pre-formatted
 * percentages so rounding happens once, at the edge.
 */

export type ReportBooking = {
  id: string;
  profileId: string;
  serviceId: string;
  serviceName: string;
  staffId: string;
  staffName: string;
  status: string;
  startsAt: string;
  endsAt: string;
  blockedUntil: string;
  totalPricePence: number;
  depositPaidPence: number;
  balancePaidPence: number;
};

export type ReportPayment = {
  kind: string;
  status: string;
  amountPence: number;
  refundedPence: number;
  paidAt: string | null;
};

const COUNTS_AS_KEPT = ["confirmed", "completed"];
const COUNTS_AS_LOST = ["cancelled_by_customer", "cancelled_by_salon", "no_show"];

export type Totals = {
  booked: number;
  kept: number;
  completed: number;
  cancelled: number;
  noShows: number;
  /** Fraction 0–1. Cancellations and no-shows over everything that was booked. */
  lossRate: number;
  noShowRate: number;
  /** Gross value of kept appointments, in pence. */
  bookedValuePence: number;
  /** Money actually received, net of refunds. */
  takingsPence: number;
  depositsPence: number;
  outstandingPence: number;
};

export function totals(
  bookings: ReportBooking[],
  payments: ReportPayment[],
): Totals {
  const kept = bookings.filter((b) => COUNTS_AS_KEPT.includes(b.status));
  const completed = bookings.filter((b) => b.status === "completed");
  const cancelled = bookings.filter((b) => b.status.startsWith("cancelled"));
  const noShows = bookings.filter((b) => b.status === "no_show");

  // A booking still awaiting payment was never really booked, so it is
  // excluded from the denominator rather than counted as a loss.
  const decided = bookings.filter(
    (b) => COUNTS_AS_KEPT.includes(b.status) || COUNTS_AS_LOST.includes(b.status),
  );

  const settled = payments.filter(
    (p) => p.status === "succeeded" || p.status === "partially_refunded",
  );

  return {
    booked: decided.length,
    kept: kept.length,
    completed: completed.length,
    cancelled: cancelled.length,
    noShows: noShows.length,
    lossRate: decided.length === 0 ? 0 : (cancelled.length + noShows.length) / decided.length,
    noShowRate: decided.length === 0 ? 0 : noShows.length / decided.length,
    bookedValuePence: kept.reduce((sum, b) => sum + b.totalPricePence, 0),
    takingsPence: settled.reduce((sum, p) => sum + p.amountPence - p.refundedPence, 0),
    depositsPence: settled
      .filter((p) => p.kind === "deposit")
      .reduce((sum, p) => sum + p.amountPence - p.refundedPence, 0),
    outstandingPence: kept.reduce(
      (sum, b) =>
        sum + Math.max(0, b.totalPricePence - b.depositPaidPence - b.balancePaidPence),
      0,
    ),
  };
}

export type ServiceMixRow = {
  serviceId: string;
  name: string;
  count: number;
  valuePence: number;
};

/** Which services actually earn, ordered by value rather than by volume. */
export function serviceMix(bookings: ReportBooking[]): ServiceMixRow[] {
  const rows = new Map<string, ServiceMixRow>();

  for (const booking of bookings) {
    if (!COUNTS_AS_KEPT.includes(booking.status)) continue;
    const existing = rows.get(booking.serviceId) ?? {
      serviceId: booking.serviceId,
      name: booking.serviceName,
      count: 0,
      valuePence: 0,
    };
    existing.count += 1;
    existing.valuePence += booking.totalPricePence;
    rows.set(booking.serviceId, existing);
  }

  return [...rows.values()].sort((a, b) => b.valuePence - a.valuePence);
}

export type StaffRow = {
  staffId: string;
  name: string;
  appointments: number;
  valuePence: number;
  /** Chair minutes booked, including buffer. */
  bookedMinutes: number;
  /** Fraction 0–1 of rostered minutes that were booked. */
  utilisation: number;
};

export function staffPerformance(
  bookings: ReportBooking[],
  rosteredMinutesByStaff: Map<string, number>,
): StaffRow[] {
  const rows = new Map<string, StaffRow>();

  for (const booking of bookings) {
    if (!COUNTS_AS_KEPT.includes(booking.status)) continue;

    const existing = rows.get(booking.staffId) ?? {
      staffId: booking.staffId,
      name: booking.staffName,
      appointments: 0,
      valuePence: 0,
      bookedMinutes: 0,
      utilisation: 0,
    };

    existing.appointments += 1;
    existing.valuePence += booking.totalPricePence;
    existing.bookedMinutes += Math.round(
      (Date.parse(booking.blockedUntil) - Date.parse(booking.startsAt)) / 60_000,
    );
    rows.set(booking.staffId, existing);
  }

  for (const row of rows.values()) {
    const rostered = rosteredMinutesByStaff.get(row.staffId) ?? 0;
    // Capped at 1: a manual booking outside the roster can otherwise report
    // more than 100% utilisation, which reads as a bug rather than a fact.
    row.utilisation = rostered === 0 ? 0 : Math.min(1, row.bookedMinutes / rostered);
  }

  return [...rows.values()].sort((a, b) => b.valuePence - a.valuePence);
}

export type CustomerSplit = {
  newCustomers: number;
  returning: number;
  /** Fraction 0–1 of kept appointments from someone booking for the first time. */
  newShare: number;
};

/**
 * New versus returning, judged against the customer's whole history rather
 * than the reporting window — somebody who first came two years ago is a
 * returning customer even if this is their only visit this month.
 */
export function customerSplit(
  bookings: ReportBooking[],
  firstBookingByProfile: Map<string, string>,
): CustomerSplit {
  const kept = bookings.filter((b) => COUNTS_AS_KEPT.includes(b.status));
  const seen = new Set<string>();
  let newCustomers = 0;
  let returning = 0;

  for (const booking of kept) {
    if (seen.has(booking.profileId)) continue;
    seen.add(booking.profileId);

    const first = firstBookingByProfile.get(booking.profileId);
    if (first && Date.parse(first) >= Date.parse(booking.startsAt)) {
      newCustomers += 1;
    } else {
      returning += 1;
    }
  }

  const total = newCustomers + returning;
  return {
    newCustomers,
    returning,
    newShare: total === 0 ? 0 : newCustomers / total,
  };
}

/** 0.1234 -> "12%" */
export function percent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/**
 * Rostered minutes in a window, so utilisation has a denominator.
 *
 * Counts each rostered day that falls in the window, minus its breaks. Time
 * off is not subtracted: a stylist on holiday should read as under-utilised
 * rather than have the holiday hidden.
 */
export function rosteredMinutes(
  schedules: { staff_id: string; day_of_week: number; starts_at: string; ends_at: string }[],
  breaks: { staff_id: string; day_of_week: number; starts_at: string; ends_at: string }[],
  from: Date,
  to: Date,
): Map<string, number> {
  const minutesBetween = (a: string, b: string) => {
    const [ah, am] = a.split(":").map(Number);
    const [bh, bm] = b.split(":").map(Number);
    return bh * 60 + bm - (ah * 60 + am);
  };

  // How many times each ISO weekday occurs in the window.
  const dayCounts = new Map<number, number>();
  const cursor = new Date(from);
  cursor.setUTCHours(0, 0, 0, 0);
  const end = new Date(to);

  while (cursor <= end) {
    const iso = cursor.getUTCDay() === 0 ? 7 : cursor.getUTCDay();
    dayCounts.set(iso, (dayCounts.get(iso) ?? 0) + 1);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const totalsByStaff = new Map<string, number>();

  for (const shift of schedules) {
    const occurrences = dayCounts.get(shift.day_of_week) ?? 0;
    if (occurrences === 0) continue;

    const shiftMinutes = minutesBetween(shift.starts_at, shift.ends_at);
    const breakMinutes = breaks
      .filter((b) => b.staff_id === shift.staff_id && b.day_of_week === shift.day_of_week)
      .reduce((sum, b) => sum + minutesBetween(b.starts_at, b.ends_at), 0);

    totalsByStaff.set(
      shift.staff_id,
      (totalsByStaff.get(shift.staff_id) ?? 0) +
        Math.max(0, shiftMinutes - breakMinutes) * occurrences,
    );
  }

  return totalsByStaff;
}
