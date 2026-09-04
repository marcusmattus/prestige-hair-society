import { TZDate } from "@date-fns/tz";
import { addDays, format, isSameDay, startOfDay } from "date-fns";

/**
 * Time helpers.
 *
 * Instants are stored and transported as UTC ISO strings. They are only ever
 * rendered in the salon's timezone, which is configuration (salons.timezone),
 * not a constant -- but Europe/London is the default and the only one in use.
 *
 * Rendering goes through TZDate rather than the server's local zone so that a
 * Vercel function running in UTC and a browser in New York both show the same
 * London wall-clock time to the customer.
 */

export const DEFAULT_TIMEZONE = "Europe/London";

export function inZone(instant: string | Date, timeZone = DEFAULT_TIMEZONE) {
  return new TZDate(new Date(instant), timeZone);
}

/** "Wed, 2 Sept" -- the compact form used in summaries and chips. */
export function formatDateShort(instant: string | Date, timeZone = DEFAULT_TIMEZONE) {
  return format(inZone(instant, timeZone), "EEE, d MMM");
}

/** "Wednesday, 2 September 2026" */
export function formatDateLong(instant: string | Date, timeZone = DEFAULT_TIMEZONE) {
  return format(inZone(instant, timeZone), "EEEE, d MMMM yyyy");
}

/** "10:00" -- 24-hour, matching the design. */
export function formatTime(instant: string | Date, timeZone = DEFAULT_TIMEZONE) {
  return format(inZone(instant, timeZone), "HH:mm");
}

/** "Wednesday, 2 September 2026 at 10:00" */
export function formatWhenLong(instant: string | Date, timeZone = DEFAULT_TIMEZONE) {
  return `${formatDateLong(instant, timeZone)} at ${formatTime(instant, timeZone)}`;
}

/** "Wed, 2 Sept at 10:00" */
export function formatWhenShort(instant: string | Date, timeZone = DEFAULT_TIMEZONE) {
  return `${formatDateShort(instant, timeZone)} at ${formatTime(instant, timeZone)}`;
}

/** "Today" / "Tomorrow" / "Wed" for the date strip. */
export function formatRelativeDay(instant: string | Date, timeZone = DEFAULT_TIMEZONE) {
  const target = inZone(instant, timeZone);
  const today = new TZDate(new Date(), timeZone);
  if (isSameDay(target, today)) return "Today";
  if (isSameDay(target, addDays(today, 1))) return "Tomorrow";
  return format(target, "EEE");
}

/** "2 Sept" */
export function formatDayMonth(instant: string | Date, timeZone = DEFAULT_TIMEZONE) {
  return format(inZone(instant, timeZone), "d MMM");
}

/** "yyyy-MM-dd" in the salon's zone -- the shape the availability API takes. */
export function toSalonDate(instant: string | Date, timeZone = DEFAULT_TIMEZONE) {
  return format(inZone(instant, timeZone), "yyyy-MM-dd");
}

/** The next `count` dates, starting today, as salon-local yyyy-MM-dd strings. */
export function upcomingSalonDates(count: number, timeZone = DEFAULT_TIMEZONE) {
  const today = startOfDay(new TZDate(new Date(), timeZone));
  return Array.from({ length: count }, (_, i) => toSalonDate(addDays(today, i), timeZone));
}

export type TimeOfDay = "morning" | "afternoon" | "evening";

/** Which filter bucket a slot falls in. Morning < 12:00, afternoon < 17:00. */
export function timeOfDay(instant: string | Date, timeZone = DEFAULT_TIMEZONE): TimeOfDay {
  const hour = inZone(instant, timeZone).getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

/** "1 hour 30 minutes" / "45 minutes" */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (mins) parts.push(`${mins} minute${mins === 1 ? "" : "s"}`);
  return parts.join(" ") || "0 minutes";
}

/** "90 min" -- the compact form the catalogue uses. */
export function formatDurationShort(minutes: number): string {
  return `${minutes} min`;
}

/** Hours between now and an instant. Negative once it is in the past. */
export function hoursUntil(instant: string | Date): number {
  return (new Date(instant).getTime() - Date.now()) / 3_600_000;
}

/**
 * Whether a booking may still be cancelled or moved free of charge.
 * The window is salon policy, overridable per service.
 */
export function isWithinPolicyWindow(startsAt: string | Date, windowHours: number): boolean {
  return hoursUntil(startsAt) >= windowHours;
}

/**
 * Advance a salon-local YYYY-MM-DD date by whole days.
 *
 * Works on the date string rather than an instant, so it cannot drift across a
 * DST boundary and needs no second read of the clock.
 */
export function addDaysToSalonDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  return shifted.toISOString().slice(0, 10);
}
