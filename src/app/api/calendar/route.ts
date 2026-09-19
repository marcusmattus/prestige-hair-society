import { NextResponse } from "next/server";
import { z } from "zod";
import { appointmentIcs } from "@/lib/calendly";
import { findService } from "@/lib/services";

export const runtime = "nodejs";

/**
 * Downloadable .ics for a secured appointment. This is the real "Add to
 * calendar" action: it works with Apple Calendar, Google Calendar, Outlook and
 * any RFC 5545 client, with no account or integration required.
 */
const schema = z.object({
  reference: z.string().trim().min(3).max(40),
  service: z.string().trim().min(1).max(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  serviceId: z.string().optional(),
  mins: z.coerce.number().int().min(15).max(600).optional(),
});

export function GET(request: Request) {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = schema.safeParse(params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid calendar request" }, { status: 400 });
  }
  const { reference, service, date, time, serviceId, mins } = parsed.data;
  const durationMinutes = mins ?? (serviceId ? findService(serviceId)?.duration : undefined) ?? 60;

  const ics = appointmentIcs({ reference, service, date, time, durationMinutes });
  return new NextResponse(ics, {
    status: 200,
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${reference}.ics"`,
      "cache-control": "no-store",
    },
  });
}
