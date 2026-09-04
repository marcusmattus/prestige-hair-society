import { describe, expect, it } from "vitest";
import {
  buildCalendar,
  escapeIcsText,
  foldIcsLine,
  formatIcsDate,
} from "@/lib/calendar/ics";

/**
 * A calendar app that dislikes a line shows nothing at all rather than an
 * error, so these assert the format itself rather than only the content.
 */

const encoder = new TextEncoder();

describe("formatIcsDate", () => {
  it("emits the UTC basic format", () => {
    expect(formatIcsDate(new Date("2026-09-08T10:00:00Z"))).toBe("20260908T100000Z");
  });

  it("converts a local instant to UTC", () => {
    // 11:00 London in September is BST, so 10:00 UTC.
    expect(formatIcsDate(new Date("2026-09-08T11:00:00+01:00"))).toBe("20260908T100000Z");
  });
});

describe("escapeIcsText", () => {
  it("escapes the delimiters", () => {
    expect(escapeIcsText("Wash, cut; finish")).toBe("Wash\\, cut\\; finish");
  });

  it("escapes backslashes before anything else", () => {
    expect(escapeIcsText("a\\b")).toBe("a\\\\b");
  });

  it("turns newlines into the literal escape", () => {
    expect(escapeIcsText("one\ntwo")).toBe("one\\ntwo");
    expect(escapeIcsText("one\r\ntwo")).toBe("one\\ntwo");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeIcsText("Silk Press — £70")).toBe("Silk Press — £70");
  });
});

describe("foldIcsLine", () => {
  it("leaves a short line alone", () => {
    expect(foldIcsLine("SUMMARY:Cut")).toBe("SUMMARY:Cut");
  });

  it("folds at 75 octets with a leading space on continuations", () => {
    const long = `DESCRIPTION:${"a".repeat(200)}`;
    const folded = foldIcsLine(long);
    const lines = folded.split("\r\n");

    expect(lines.length).toBeGreaterThan(1);
    for (const [i, l] of lines.entries()) {
      expect(encoder.encode(l).length).toBeLessThanOrEqual(75);
      if (i > 0) expect(l.startsWith(" ")).toBe(true);
    }
    // RFC 5545 unfolding removes the CRLF *and* the single leading space that
    // marks a continuation, so that space is a delimiter, not content.
    const unfolded = lines[0] + lines.slice(1).map((l) => l.slice(1)).join("");
    expect(unfolded).toBe(long);
  });

  it("never splits a multi-byte character", () => {
    // £ is two octets and — is three; a naive character-count fold corrupts
    // these and takes the whole calendar down.
    const long = `DESCRIPTION:${"£—".repeat(60)}`;
    const folded = foldIcsLine(long);

    for (const l of folded.split("\r\n")) {
      expect(encoder.encode(l).length).toBeLessThanOrEqual(75);
    }
    const rejoined = folded.split("\r\n").join("").replace(/^ /gm, "");
    expect(rejoined.replace(/ /g, "")).toContain("£—£—");
    // No replacement characters, which is what a mid-character split produces.
    expect(folded).not.toContain("�");
  });
});

describe("buildCalendar", () => {
  const event = {
    uid: "booking-abc@prestigehairsociety",
    start: new Date("2026-09-08T09:00:00Z"),
    end: new Date("2026-09-08T10:45:00Z"),
    summary: "Silk Press - Short Hair — Ada Nwosu",
    description: "Phone: 07700 900001\nDeposit: £20.00 — paid",
    location: "2 Queens Road, London, SW11 1AA",
  };

  it("produces a well-formed calendar", () => {
    const ics = buildCalendar({ name: "Prestige", events: [event] });

    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
  });

  it("uses CRLF throughout, never a bare LF", () => {
    const ics = buildCalendar({ name: "Prestige", events: [event] });
    // Every \n must be preceded by \r.
    expect(/[^\r]\n/.test(ics)).toBe(false);
  });

  it("keeps every line inside 75 octets", () => {
    const ics = buildCalendar({
      name: "Prestige",
      events: [
        {
          ...event,
          description: "A very long note. ".repeat(30),
        },
      ],
    });

    for (const l of ics.split("\r\n")) {
      expect(encoder.encode(l).length).toBeLessThanOrEqual(75);
    }
  });

  it("carries the times and identity of the appointment", () => {
    const ics = buildCalendar({ name: "Prestige", events: [event] });
    expect(ics).toContain("DTSTART:20260908T090000Z");
    expect(ics).toContain("DTEND:20260908T104500Z");
    expect(ics).toContain("UID:booking-abc@prestigehairsociety");
  });

  it("escapes the summary and description", () => {
    const ics = buildCalendar({ name: "Prestige", events: [event] });
    // The newline in the description became a literal \n, not a real break.
    expect(ics).toContain("\\nDeposit");
  });

  it("marks a cancelled appointment rather than dropping it", () => {
    // A subscriber that simply stops seeing an event often keeps showing the
    // old one, so cancellation has to be stated.
    const ics = buildCalendar({
      name: "Prestige",
      events: [{ ...event, status: "CANCELLED" }],
    });
    expect(ics).toContain("STATUS:CANCELLED");
  });

  it("adds an alarm only when asked", () => {
    expect(buildCalendar({ name: "P", events: [event] })).not.toContain("BEGIN:VALARM");

    const withAlarm = buildCalendar({
      name: "P",
      events: [{ ...event, alarmMinutesBefore: 60 }],
    });
    expect(withAlarm).toContain("BEGIN:VALARM");
    expect(withAlarm).toContain("TRIGGER:-PT60M");
    expect(withAlarm).toContain("END:VALARM");
  });

  it("advertises a refresh interval in both spellings", () => {
    const ics = buildCalendar({ name: "P", events: [], refreshMinutes: 15 });
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT15M");
    expect(ics).toContain("X-PUBLISHED-TTL:PT15M");
  });

  it("is valid with no events at all", () => {
    const ics = buildCalendar({ name: "P", events: [] });
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("balances BEGIN and END for many events", () => {
    const ics = buildCalendar({
      name: "P",
      events: Array.from({ length: 25 }, (_, i) => ({ ...event, uid: `e${i}` })),
    });
    const begins = ics.match(/BEGIN:VEVENT/g)?.length ?? 0;
    const ends = ics.match(/END:VEVENT/g)?.length ?? 0;
    expect(begins).toBe(25);
    expect(ends).toBe(25);
  });
});
