/**
 * Prepaid membership-visit helpers (pure — safe on client and server).
 *
 * A membership includes a fixed number of prepaid visits. Booking one never
 * charges again; it only records the requested slot. Staff mark a visit
 * completed afterwards, which is what advances `completed_visits`.
 */

export type VisitCounts = { included_visits: number; completed_visits: number };

/** Visits still owed to the member (completed never exceeds included). */
export function remainingVisits(m: VisitCounts) {
  return Math.max(0, m.included_visits - m.completed_visits);
}

/** Whether a fresh visit may be booked (there is at least one left). */
export function canBookVisit(m: VisitCounts) {
  return remainingVisits(m) > 0;
}

/**
 * Whether Europe/London is on BST (UTC+1) for the given calendar day.
 * Uses the runtime's IANA data rather than shipping a DST table.
 */
export function isLondonBst(date: string) {
  const name = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", timeZoneName: "short" })
    .formatToParts(new Date(`${date}T12:00:00Z`))
    .find((p) => p.type === "timeZoneName")?.value;
  return name === "BST";
}

/**
 * Combine a `YYYY-MM-DD` date and `HH:MM` time (studio wall-clock, Europe/
 * London) into an ISO timestamp with the correct offset, for a timestamptz.
 */
export function toLondonISO(date: string, time: string) {
  const offset = isLondonBst(date) ? "+01:00" : "+00:00";
  return `${date}T${time}:00${offset}`;
}

/** A stable-ish visit reference for the member's records. */
export function visitReference(seed: string) {
  return `PHS-V-${seed.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase()}`;
}
