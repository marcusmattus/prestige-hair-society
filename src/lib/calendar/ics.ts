/**
 * iCalendar (RFC 5545) generation for the subscribable feed.
 *
 * Written by hand rather than pulled from a library because the format is
 * small and the failure mode is silent: a calendar app that dislikes a line
 * shows nothing at all rather than an error, so the details below -- CRLF
 * endings, 75-octet line folding, correct escaping and stable UIDs -- are the
 * whole job.
 */

export type CalendarEvent = {
  /** Stable across regenerations, so an update edits rather than duplicates. */
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  location?: string;
  /** Bumped when the appointment changes, so subscribers pick up the edit. */
  sequence?: number;
  status?: "CONFIRMED" | "TENTATIVE" | "CANCELLED";
  /** Minutes before the start to alarm. Omit for no alarm. */
  alarmMinutesBefore?: number;
  organizerName?: string;
  organizerEmail?: string;
  lastModified?: Date;
};

/** RFC 5545 §3.3.5 — UTC form, no punctuation. */
export function formatIcsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/**
 * Escape a TEXT value: backslash, semicolon and comma are delimiters, and a
 * literal newline must become \n. Carriage returns are dropped rather than
 * escaped -- they carry no meaning inside a value and confuse some parsers.
 */
export function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Fold to 75 octets per line, continuing with a leading space.
 *
 * The limit counts octets, not characters, so a line is measured after UTF-8
 * encoding and never split inside a multi-byte character -- a £ sign cut in
 * half takes the whole calendar down.
 */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const parts: string[] = [];
  let current = "";
  let currentBytes = 0;
  // First line allows 75 octets; continuations allow 74 plus the leading space.
  let limit = 75;

  for (const char of line) {
    const size = encoder.encode(char).length;
    if (currentBytes + size > limit) {
      parts.push(current);
      current = "";
      currentBytes = 0;
      limit = 74;
    }
    current += char;
    currentBytes += size;
  }
  if (current) parts.push(current);

  return parts.join("\r\n ");
}

function line(name: string, value: string): string {
  return foldIcsLine(`${name}:${value}`);
}

export function buildCalendar(args: {
  name: string;
  description?: string;
  timezone?: string;
  events: CalendarEvent[];
  /** How often a subscriber should re-fetch. Default one hour. */
  refreshMinutes?: number;
}): string {
  const now = new Date();
  const refresh = args.refreshMinutes ?? 60;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Prestige Hair Society//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    line("X-WR-CALNAME", escapeIcsText(args.name)),
    line("NAME", escapeIcsText(args.name)),
  ];

  if (args.description) {
    lines.push(line("X-WR-CALDESC", escapeIcsText(args.description)));
    lines.push(line("DESCRIPTION", escapeIcsText(args.description)));
  }
  if (args.timezone) {
    lines.push(line("X-WR-TIMEZONE", args.timezone));
  }

  // Both spellings: Apple reads the X- form, others read the RFC 7986 one.
  lines.push(`REFRESH-INTERVAL;VALUE=DURATION:PT${refresh}M`);
  lines.push(`X-PUBLISHED-TTL:PT${refresh}M`);

  for (const event of args.events) {
    lines.push("BEGIN:VEVENT");
    lines.push(line("UID", event.uid));
    lines.push(line("DTSTAMP", formatIcsDate(event.lastModified ?? now)));
    lines.push(line("DTSTART", formatIcsDate(event.start)));
    lines.push(line("DTEND", formatIcsDate(event.end)));
    lines.push(line("SUMMARY", escapeIcsText(event.summary)));

    if (event.description) {
      lines.push(line("DESCRIPTION", escapeIcsText(event.description)));
    }
    if (event.location) {
      lines.push(line("LOCATION", escapeIcsText(event.location)));
    }
    if (event.organizerEmail) {
      const name = event.organizerName
        ? `;CN=${escapeIcsText(event.organizerName)}`
        : "";
      lines.push(foldIcsLine(`ORGANIZER${name}:mailto:${event.organizerEmail}`));
    }

    lines.push(`SEQUENCE:${event.sequence ?? 0}`);
    lines.push(`STATUS:${event.status ?? "CONFIRMED"}`);
    lines.push("TRANSP:OPAQUE");

    if (event.lastModified) {
      lines.push(line("LAST-MODIFIED", formatIcsDate(event.lastModified)));
    }

    if (event.alarmMinutesBefore != null) {
      lines.push("BEGIN:VALARM");
      lines.push("ACTION:DISPLAY");
      lines.push(line("DESCRIPTION", escapeIcsText(event.summary)));
      lines.push(`TRIGGER:-PT${event.alarmMinutesBefore}M`);
      lines.push("END:VALARM");
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  // RFC 5545 requires CRLF, and a trailing one.
  return lines.join("\r\n") + "\r\n";
}
