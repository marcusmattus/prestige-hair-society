import { deliver } from "@/lib/comms/dispatch";
import { authorizeCron } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Never send a reminder for an appointment that is no longer happening. */
const LIVE_STATUSES = ["pending_payment", "confirmed", "completed"];

/**
 * Send queued messages whose time has come.
 *
 * Each row was claimed by its unique idempotency key when it was queued, so a
 * message can only be in this table once. Sending is therefore safe to retry:
 * deliver() is a no-op on a row already marked sent.
 *
 * Suggested schedule: every 15 minutes.
 */
export async function GET(request: Request) {
  const unauthorized = authorizeCron(request);
  if (unauthorized) return unauthorized;

  const supabase = createAdminClient();

  const { data: due, error } = await supabase
    .from("message_deliveries")
    .select("id, booking_id, attempts")
    .eq("status", "queued")
    .lte("scheduled_for", new Date().toISOString())
    // Give up after five attempts rather than retrying a bad address forever.
    .lt("attempts", 5)
    .order("scheduled_for")
    .limit(100);

  if (error) {
    console.error("[cron/messages] query failed", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  const rows = due ?? [];
  const bookingIds = [...new Set(rows.map((r) => r.booking_id).filter(Boolean))] as string[];

  // Skip anything attached to a cancelled appointment.
  const liveBookings = new Set<string>();
  if (bookingIds.length) {
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, status")
      .in("id", bookingIds);
    for (const b of bookings ?? []) {
      if (LIVE_STATUSES.includes(b.status)) liveBookings.add(b.id);
    }
  }

  let sent = 0;
  let skipped = 0;

  for (const row of rows) {
    if (row.booking_id && !liveBookings.has(row.booking_id)) {
      await supabase
        .from("message_deliveries")
        .update({ status: "skipped", error_message: "Appointment is no longer active" })
        .eq("id", row.id);
      skipped += 1;
      continue;
    }

    await deliver(row.id);
    sent += 1;
  }

  return Response.json({ processed: rows.length, sent, skipped });
}
