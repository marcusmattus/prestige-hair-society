import { authorizeCron } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Release abandoned holds, and abandon bookings whose payment never arrived.
 *
 * hold_slot() and book_slot() already sweep the stylist they are working on,
 * so this is hygiene rather than the primary mechanism: it keeps the table
 * small and frees chairs for the availability query, which does not sweep.
 *
 * Suggested schedule: every 5 minutes.
 */
export async function GET(request: Request) {
  const unauthorized = authorizeCron(request);
  if (unauthorized) return unauthorized;

  const supabase = createAdminClient();

  const { data: released, error: sweepError } = await supabase.rpc(
    "release_expired_holds",
    { p_staff_id: null } as never,
  );

  if (sweepError) {
    console.error("[cron/sweep-holds] sweep failed", sweepError.message);
    return Response.json({ error: sweepError.message }, { status: 500 });
  }

  // A booking stuck in pending_payment past its hold window means the customer
  // left checkout or their card failed. Cancelling frees the slot; the
  // exclusion constraint stops blocking as soon as the status changes.
  const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: abandoned, error: abandonError } = await supabase
    .from("bookings")
    .update({
      status: "cancelled_by_salon",
      cancellation_reason: "Payment was not completed",
      cancelled_at: new Date().toISOString(),
    })
    .eq("status", "pending_payment")
    .lt("created_at", cutoff)
    .select("id, reference");

  if (abandonError) {
    console.error("[cron/sweep-holds] abandon failed", abandonError.message);
  }

  return Response.json({
    holdsReleased: released ?? 0,
    bookingsAbandoned: abandoned?.length ?? 0,
  });
}
