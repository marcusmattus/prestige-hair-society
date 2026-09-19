/**
 * Calendly links and calendar (.ics) helpers.
 *
 * The scheduling URLs below are the connected Calendly account's live links,
 * read from the Calendly MCP for Prestige Hair Society. They let a client book
 * a face-to-face or video consultation before committing to a full service,
 * and back the "Add to calendar" action once an appointment is secured.
 *
 * `NEXT_PUBLIC_CALENDLY_URL` overrides the default when the salon connects its
 * own event type, so nothing here is hard-wired for production.
 */

/** The salon's Calendly consultation booking link. */
export const CALENDLY_CONSULTATION_URL =
  process.env.NEXT_PUBLIC_CALENDLY_URL || "https://calendly.com/mattusmarcus/30min";

/** The account scheduling page (all event types). */
export const CALENDLY_SCHEDULING_URL =
  process.env.NEXT_PUBLIC_CALENDLY_SCHEDULING_URL || "https://calendly.com/mattusmarcus";

/**
 * A Calendly consultation link pre-filled with the client's details, so they
 * do not retype their name and email on the Calendly page.
 * See https://help.calendly.com/hc/en-us/articles/360020052832
 */
export function calendlyConsultationLink(prefill?: { name?: string; email?: string }) {
  const url = new URL(CALENDLY_CONSULTATION_URL);
  if (prefill?.name) url.searchParams.set("name", prefill.name);
  if (prefill?.email) url.searchParams.set("email", prefill.email);
  return url.toString();
}

// ---------------------------------------------------------------------------
// Calendar events for a secured appointment
// ---------------------------------------------------------------------------

export type CalendarEvent = {
  reference: string;
  service: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** 24h time, HH:MM, in Europe/London. */
  time: string;
  /** Appointment length in minutes. */
  durationMinutes: number;
  location?: string;
  description?: string;
};

const DEFAULT_LOCATION = "KOOP Studio, 2 Queenstown Road, London SW8 3RX";

/**
 * Europe/London is UTC in winter and UTC+1 in summer. Rather than ship a
 * timezone database, the .ics uses a floating local time with a VTIMEZONE
 * hint, which every major calendar interprets as the studio's wall-clock time.
 */
function icsStamp(date: string, time: string) {
  return `${date.replace(/-/g, "")}T${time.replace(":", "")}00`;
}

function addMinutes(date: string, time: string, minutes: number) {
  const start = new Date(`${date}T${time}:00Z`);
  const end = new Date(start.getTime() + minutes * 60_000);
  const iso = end.toISOString();
  return {
    date: iso.slice(0, 10),
    time: iso.slice(11, 16),
  };
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/** A downloadable VCALENDAR for the appointment, valid per RFC 5545. */
export function appointmentIcs(event: CalendarEvent) {
  const location = event.location || DEFAULT_LOCATION;
  const end = addMinutes(event.date, event.time, event.durationMinutes);
  const now = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const summary = `Prestige Hair Society — ${event.service}`;
  const description =
    event.description ||
    `Your ${event.service} appointment. Reference ${event.reference}. Balance is paid at the studio.`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Prestige Hair Society//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/London",
    "BEGIN:STANDARD",
    "DTSTART:19701025T020000",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0000",
    "TZNAME:GMT",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "END:STANDARD",
    "BEGIN:DAYLIGHT",
    "DTSTART:19700329T010000",
    "TZOFFSETFROM:+0000",
    "TZOFFSETTO:+0100",
    "TZNAME:BST",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "END:DAYLIGHT",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${event.reference}@prestigehairsociety`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=Europe/London:${icsStamp(event.date, event.time)}`,
    `DTEND;TZID=Europe/London:${icsStamp(end.date, end.time)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `LOCATION:${escapeIcs(location)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

/** A Google Calendar "add event" URL — the web equivalent of the .ics file. */
export function googleCalendarLink(event: CalendarEvent) {
  const end = addMinutes(event.date, event.time, event.durationMinutes);
  const url = new URL("https://calendar.google.com/calendar/render");
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", `Prestige Hair Society — ${event.service}`);
  url.searchParams.set("dates", `${icsStamp(event.date, event.time)}/${icsStamp(end.date, end.time)}`);
  url.searchParams.set("ctz", "Europe/London");
  url.searchParams.set("location", event.location || DEFAULT_LOCATION);
  url.searchParams.set(
    "details",
    event.description || `Reference ${event.reference}. Balance is paid at the studio.`,
  );
  return url.toString();
}
