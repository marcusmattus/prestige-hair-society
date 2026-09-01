"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * Add-to-calendar.
 *
 * Google gets a URL; everyone else gets an .ics file built in the browser, so
 * there is no round trip and no server route holding appointment details.
 */
export function AddToCalendar({
  title,
  startsAt,
  endsAt,
  location,
  description,
}: {
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  description: string;
}) {
  const [open, setOpen] = useState(false);

  const start = toIcsStamp(startsAt);
  const end = toIcsStamp(endsAt);

  const googleUrl =
    "https://calendar.google.com/calendar/render?" +
    new URLSearchParams({
      action: "TEMPLATE",
      text: title,
      dates: `${start}/${end}`,
      details: description,
      location,
    });

  function downloadIcs() {
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Prestige Hair Society//Booking//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${crypto.randomUUID()}@prestigehairsociety`,
      `DTSTAMP:${toIcsStamp(new Date().toISOString())}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeIcs(title)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      `LOCATION:${escapeIcs(location)}`,
      "BEGIN:VALARM",
      "TRIGGER:-PT2H",
      "ACTION:DISPLAY",
      `DESCRIPTION:${escapeIcs(title)}`,
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");

    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "prestige-hair-society.ics";
    link.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  }

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        Add to calendar
      </Button>

      {open && (
        <div className="absolute top-full left-0 z-10 mt-2 w-52 rounded-[6px] border border-line bg-cream p-2 shadow-[0_18px_44px_rgba(33,49,38,0.10)]">
          <a
            href={googleUrl.toString()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="block rounded-[4px] px-3 py-2.5 text-left text-[14px] hover:bg-sand"
          >
            Google Calendar
          </a>
          <button
            type="button"
            onClick={downloadIcs}
            className="block w-full cursor-pointer rounded-[4px] px-3 py-2.5 text-left text-[14px] hover:bg-sand"
          >
            Apple, Outlook or other
          </button>
        </div>
      )}
    </div>
  );
}

/** ISO instant -> "20260902T100000Z", the form iCalendar wants. */
function toIcsStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcs(value: string): string {
  return value.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
}
