import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBookingEmails } from "@/lib/email";
import { TIMES } from "@/lib/services";
import { canBookVisit, remainingVisits, toLondonISO, visitReference } from "@/lib/memberships/visits";

export const runtime = "nodejs";

const schema = z.object({
  membershipId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.enum(TIMES as [string, ...string[]]),
  notes: z.string().max(1000).optional(),
  reschedule: z.boolean().optional(),
});

/**
 * Book (or reschedule) a prepaid membership visit. No charge is taken — the
 * visit is already covered by the programme. Ownership is verified server-side
 * before the admin client records the requested slot.
 */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });

    const input = schema.parse(await request.json());
    const requested = new Date(toLondonISO(input.date, input.time));
    if (!Number.isFinite(requested.valueOf()) || requested < new Date()) {
      return NextResponse.json({ error: "Please choose a future appointment" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: membership } = await admin
      .from("memberships")
      .select("id, profile_id, email, programme_name, included_visits, completed_visits, booking_reference, status")
      .eq("id", input.membershipId)
      .maybeSingle();

    // Verify ownership in code (admin bypasses RLS).
    if (!membership || membership.profile_id !== user.id) {
      return NextResponse.json({ error: "Membership not found" }, { status: 404 });
    }
    if (membership.status === "cancelled") {
      return NextResponse.json({ error: "This membership is no longer active" }, { status: 400 });
    }
    // A reschedule moves the existing booked visit; a new booking needs one left.
    if (!input.reschedule && !canBookVisit(membership)) {
      return NextResponse.json({ error: "You have used all included visits" }, { status: 400 });
    }

    const { error } = await admin
      .from("memberships")
      .update({ next_visit_at: toLondonISO(input.date, input.time) })
      .eq("id", membership.id);
    if (error) throw new Error(error.message);

    const reference = membership.booking_reference || visitReference(membership.id);
    // Confirmation email (best-effort). It's a prepaid visit, so £0 is due.
    try {
      await sendBookingEmails({
        reference,
        name: `${user.profile.first_name || ""} ${user.profile.last_name || ""}`.trim() || user.email,
        email: membership.email || user.email,
        phone: user.profile.phone || "",
        service: `${membership.programme_name} — membership visit`,
        date: input.date,
        time: input.time,
        deposit: "£0",
        balance: "£0",
        paymentStatus: "Included in your membership — no charge",
        durationMinutes: 60,
        paidInFull: true,
      });
    } catch (cause) {
      console.error("membership_visit_email_error", cause);
    }

    return NextResponse.json({ ok: true, reference, remaining: remainingVisits(membership) });
  } catch (cause) {
    console.error("membership_visit_error", cause);
    const message = cause instanceof z.ZodError ? "Please check the appointment details" : "Unable to book your visit";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
