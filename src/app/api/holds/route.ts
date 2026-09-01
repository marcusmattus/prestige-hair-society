import { cookies } from "next/headers";
import { enforceRateLimit, fail, fromDatabaseError, ok, parseBody } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { holdSlotSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/** Guest holds are proved by this cookie; a signed-in hold is proved by the session. */
const HOLD_COOKIE = "phs_hold";

/**
 * POST /api/holds
 *
 * Reserves a slot for the salon's configured hold window (10 minutes by
 * default). The reservation itself is made by hold_slot() inside a single
 * transaction, and the exclusion constraint on slot_holds is what actually
 * prevents two people holding the same chair.
 *
 * Runs on the service role because guests have no session yet. The function is
 * given only the ids the caller chose; duration, buffer and price all come
 * from the catalogue inside the database.
 */
export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "holds", { limit: 12, windowMs: 60_000 });
  if (limited) return limited;

  const { data, response } = await parseBody(request, holdSlotSchema);
  if (response) return response;

  const user = await getSessionUser();
  const supabase = createAdminClient();

  const { data: hold, error } = await supabase.rpc("hold_slot", {
    p_staff_id: data.staffId,
    p_service_id: data.serviceId,
    p_starts_at: data.startsAt,
    p_profile_id: user?.id ?? null,
    p_addon_ids: data.addonIds,
  } as never);

  if (error) return fromDatabaseError(error);

  const row = hold as unknown as {
    hold_token: string;
    starts_at: string;
    ends_at: string;
    expires_at: string;
  } | null;

  if (!row) {
    return fail(500, "server_error", "We could not hold that slot. Please try again.");
  }

  // Remember the token for a guest, so a page refresh does not lose the hold.
  const jar = await cookies();
  jar.set(HOLD_COOKIE, row.hold_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 60,
  });

  return ok({
    holdToken: row.hold_token,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    expiresAt: row.expires_at,
  });
}

/**
 * DELETE /api/holds — release a hold the caller owns, so abandoning checkout
 * frees the chair immediately rather than after the timeout.
 */
export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("holdToken");
  if (!token) return fail(422, "missing_token", "No hold token was supplied.");

  const user = await getSessionUser();
  const jar = await cookies();
  const cookieToken = jar.get(HOLD_COOKIE)?.value;

  const supabase = createAdminClient();
  const { data: hold } = await supabase
    .from("slot_holds")
    .select("id, profile_id, hold_token, consumed_at")
    .eq("hold_token", token)
    .maybeSingle();

  if (!hold) return ok({ released: false });
  if (hold.consumed_at) return fail(409, "hold_already_used", "That slot is already booked.");

  // Ownership: either the signed-in owner, or the browser that created it.
  const owns = hold.profile_id ? hold.profile_id === user?.id : cookieToken === token;
  if (!owns) return fail(403, "hold_not_owned", "That held slot belongs to someone else.");

  await supabase.from("slot_holds").delete().eq("id", hold.id);
  jar.delete(HOLD_COOKIE);

  return ok({ released: true });
}
