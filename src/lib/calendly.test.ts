import { describe, expect, it } from "vitest";
import {
  appointmentIcs,
  calendlyConsultationLink,
  googleCalendarLink,
} from "./calendly";

const event = {
  reference: "PHS-ABCD1234",
  service: "Silk Press — Medium hair",
  date: "2026-10-01",
  time: "10:00",
  durationMinutes: 90,
};

describe("appointmentIcs", () => {
  it("produces a valid VCALENDAR with local start/end times", () => {
    const ics = appointmentIcs(event);
    expect(ics.startsWith("BEGIN:VCALENDAR")).toBe(true);
    expect(ics.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
    expect(ics).toContain("DTSTART;TZID=Europe/London:20261001T100000");
    // 10:00 + 90 min = 11:30
    expect(ics).toContain("DTEND;TZID=Europe/London:20261001T113000");
    expect(ics).toContain("UID:PHS-ABCD1234@prestigehairsociety");
  });

  it("escapes commas in the location", () => {
    const ics = appointmentIcs(event);
    expect(ics).toContain("LOCATION:KOOP Studio\\, 2 Queenstown Road\\, London SW8 3RX");
  });
});

describe("googleCalendarLink", () => {
  it("encodes the London date range and timezone", () => {
    const link = googleCalendarLink(event);
    const url = new URL(link);
    expect(url.searchParams.get("dates")).toBe("20261001T100000/20261001T113000");
    expect(url.searchParams.get("ctz")).toBe("Europe/London");
    expect(url.searchParams.get("text")).toContain("Silk Press");
  });
});

describe("calendlyConsultationLink", () => {
  it("pre-fills name and email when provided", () => {
    const link = calendlyConsultationLink({ name: "Ada Lovelace", email: "ada@example.com" });
    const url = new URL(link);
    expect(url.searchParams.get("name")).toBe("Ada Lovelace");
    expect(url.searchParams.get("email")).toBe("ada@example.com");
  });

  it("returns a bare link when no prefill is given", () => {
    const link = calendlyConsultationLink();
    expect(link).not.toContain("?");
  });
});
