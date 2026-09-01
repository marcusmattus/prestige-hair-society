import { randomUUID } from "node:crypto";
import { appUrl } from "@/lib/env";
import { authorizeCron } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatWhenLong, timeOfDay, toSalonDate } from "@/lib/time";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** How long a customer gets to take an offered slot before the next in line. */
const OFFER_WINDOW_MINUTES = 60;

/**
 * Match waiting-list entries against slots that have opened up.
 *
 * Important: an offer does NOT reserve the slot. Reserving it would take the
 * chair out of circulation for an hour on the chance someone reads their email.
 * Instead the customer gets a time-limited link, and the slot is only held when
 * they actually start checkout -- so a walk-in booking the same time is fine,
 * and the offer simply lapses.
 *
 * Suggested schedule: every 15 minutes.
 */
export async function GET(request: Request) {
  const unauthorized = authorizeCron(request);
  if (unauthorized) return unauthorized;

  const supabase = createAdminClient();
  const now = new Date();

  // Expire offers nobody took, so the entry can be matched again.
  await supabase
    .from("waitlist_entries")
    .update({
      status: "active",
      offered_at: null,
      offer_expires_at: null,
      offered_slot_starts_at: null,
      offered_staff_id: null,
      offer_token: null,
    })
    .eq("status", "offered")
    .lt("offer_expires_at", now.toISOString());

  const { data: entries, error } = await supabase
    .from("waitlist_entries")
    .select(
      `id, salon_id, profile_id, service_id, staff_id, earliest_date, latest_date, times_of_day,
       profile:profile_id(first_name, email, phone),
       service:service_id(name),
       salon:salon_id(timezone)`,
    )
    .eq("status", "active")
    .gte("latest_date", toSalonDate(now))
    .order("created_at")
    .limit(50);

  if (error) {
    console.error("[cron/waitlist] query failed", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  let offered = 0;

  for (const entry of entries ?? []) {
    const tz = entry.salon?.timezone ?? "Europe/London";

    const { data: slots } = await supabase.rpc("available_slots", {
      p_service_id: entry.service_id,
      p_from: maxDate(entry.earliest_date, toSalonDate(now, tz)),
      p_to: entry.latest_date,
      p_staff_id: entry.staff_id,
      p_extra_minutes: 0,
    } as never);

    const candidates = ((slots ?? []) as unknown as {
      staff_id: string;
      slot_start: string;
    }[]).filter((slot) => entry.times_of_day.includes(timeOfDay(slot.slot_start, tz)));

    const match = candidates[0];
    if (!match) continue;

    const token = randomUUID();
    const expiresAt = new Date(now.getTime() + OFFER_WINDOW_MINUTES * 60_000);

    const { error: claimError } = await supabase
      .from("waitlist_entries")
      .update({
        status: "offered",
        offered_at: now.toISOString(),
        offer_expires_at: expiresAt.toISOString(),
        offered_slot_starts_at: match.slot_start,
        offered_staff_id: match.staff_id,
        offer_token: token,
      })
      .eq("id", entry.id)
      // Only claim an entry still active, so two overlapping cron runs cannot
      // both offer the same person.
      .eq("status", "active");

    if (claimError) continue;

    const email = entry.profile?.email;
    if (!email) continue;

    const { data: template } = await supabase
      .from("message_templates")
      .select("id, subject, body")
      .eq("salon_id", entry.salon_id)
      .eq("kind", "waitlist_availability")
      .eq("channel", "email")
      .eq("is_active", true)
      .maybeSingle();

    if (!template) continue;

    const context = {
      customer: { firstName: entry.profile?.first_name ?? "there" },
      booking: {
        serviceName: entry.service?.name ?? "your service",
        whenLong: formatWhenLong(match.slot_start, tz),
        staffName: "one of our stylists",
      },
      waitlist: { expiresAt: formatWhenLong(expiresAt.toISOString(), tz) },
      links: { offer: `${appUrl}/book/offer/${token}` },
    };

    const { render } = await import("@/lib/comms/render");

    await supabase.from("message_deliveries").insert({
      salon_id: entry.salon_id,
      profile_id: entry.profile_id,
      template_id: template.id,
      kind: "waitlist_availability",
      channel: "email",
      status: "queued",
      // Slot-scoped: the same person may legitimately be offered a different
      // slot later, but never the same one twice.
      idempotency_key: `waitlist:${entry.id}:${match.slot_start}`,
      recipient: email,
      subject: template.subject ? render(template.subject, context) : null,
      body: render(template.body, context),
      provider: "resend",
      scheduled_for: now.toISOString(),
    });

    offered += 1;
  }

  return Response.json({ considered: entries?.length ?? 0, offered });
}

function maxDate(a: string, b: string): string {
  return a > b ? a : b;
}
