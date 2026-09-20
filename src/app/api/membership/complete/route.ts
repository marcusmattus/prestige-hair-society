import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, isManager } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const schema = z.object({ membershipId: z.string().uuid() });

/**
 * Mark one prepaid membership visit as completed. Staff-only (managers): this
 * is what advances the N / total counter and clears the booked slot. When the
 * last included visit is completed the membership is marked completed.
 */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || !isManager(user)) return NextResponse.json({ error: "Not permitted" }, { status: 403 });

    const { membershipId } = schema.parse(await request.json());
    const admin = createAdminClient();
    const { data: membership } = await admin
      .from("memberships")
      .select("id, included_visits, completed_visits, status")
      .eq("id", membershipId)
      .maybeSingle();
    if (!membership) return NextResponse.json({ error: "Membership not found" }, { status: 404 });

    const completed = Math.min(membership.included_visits, membership.completed_visits + 1);
    const status = completed >= membership.included_visits && membership.included_visits > 0 ? "completed" : membership.status;

    const { error } = await admin
      .from("memberships")
      .update({ completed_visits: completed, next_visit_at: null, status })
      .eq("id", membership.id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true, completed_visits: completed, status });
  } catch (cause) {
    console.error("membership_complete_error", cause);
    const message = cause instanceof z.ZodError ? "Invalid request" : "Unable to update the membership";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
