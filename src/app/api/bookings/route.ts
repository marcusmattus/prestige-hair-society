import { cookies } from "next/headers";
import { audit, requestContext } from "@/lib/audit";
import { enforceRateLimit, fail, fromDatabaseError, ok, parseBody } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/roles";
import { resolveCustomer } from "@/lib/customers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createBookingSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/bookings
 *
 * Turns a held slot into a `pending_payment` booking and returns what the
 * payment step needs. It does NOT confirm the appointment: only the Stripe
 * webhook does that (see /api/webhooks/stripe).
 *
 * A guest is given an account here, so that every booking has an owner and the
 * customer can manage it later without a second sign-up.
 */
export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "bookings", { limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const { data, response } = await parseBody(request, createBookingSchema);
  if (response) return response;

  const { holdToken, details, addonIds, discountCode } = data;
  const supabase = createAdminClient();
  const existingUser = await getSessionUser();

  // -------------------------------------------------------------------------
  // Resolve the customer: the signed-in user, an existing account with that
  // email, or a new account created for them.
  // -------------------------------------------------------------------------
  const resolved = await resolveCustomer(details, existingUser?.id ?? null);
  if (!resolved.ok) {
    return fail(
      resolved.code === "account_exists" ? 409 : 500,
      resolved.code,
      resolved.message,
    );
  }
  const { profileId, createdAccount } = resolved;

  // Keep the profile in step with what was typed at checkout.
  await supabase
    .from("profiles")
    .update({
      first_name: details.firstName,
      last_name: details.lastName,
      phone: details.phone,
      birthday: details.birthday || null,
      hair_goals: details.hairGoals || null,
      accessibility_requirements: details.accessibilityRequirements || null,
      marketing_email: details.marketingEmail,
      marketing_sms: details.marketingSms,
    })
    .eq("id", profileId);

  // -------------------------------------------------------------------------
  // Consume the hold. book_slot() re-validates the slot and re-derives price
  // and duration from the catalogue inside one transaction.
  // -------------------------------------------------------------------------
  const { data: booking, error } = await supabase.rpc("book_slot", {
    p_hold_token: holdToken,
    p_profile_id: profileId,
    p_addon_ids: addonIds,
    p_customer_notes: details.notes || null,
    p_accessibility_requirements: details.accessibilityRequirements || null,
    p_source: "web",
    p_discount_code: discountCode || null,
  } as never);

  if (error) return fromDatabaseError(error);

  const row = booking as unknown as {
    id: string;
    reference: string;
    total_price_pence: number;
    deposit_pence: number;
    starts_at: string;
    ends_at: string;
  } | null;

  if (!row) return fail(500, "server_error", "We could not create that booking.");

  // Consent is evidence, so each acceptance is its own row.
  const ctx = requestContext(request);
  await supabase.from("consent_records").insert([
    {
      profile_id: profileId,
      kind: "terms" as const,
      granted: true,
      document_version: "2026-01",
      source: "web" as const,
      ip_address: ctx.ipAddress,
      user_agent: ctx.userAgent,
    },
    {
      profile_id: profileId,
      kind: "marketing_email" as const,
      granted: details.marketingEmail,
      source: "web" as const,
      ip_address: ctx.ipAddress,
      user_agent: ctx.userAgent,
    },
    {
      profile_id: profileId,
      kind: "marketing_sms" as const,
      granted: details.marketingSms,
      source: "web" as const,
      ip_address: ctx.ipAddress,
      user_agent: ctx.userAgent,
    },
  ]);

  await audit({
    actorId: profileId,
    actorEmail: details.email,
    action: "booking.created",
    entityType: "booking",
    entityId: row.id,
    metadata: { reference: row.reference, createdAccount, source: "web" },
    ...ctx,
  });

  const jar = await cookies();
  jar.delete("phs_hold");

  return ok({
    bookingId: row.id,
    reference: row.reference,
    totalPence: row.total_price_pence,
    depositPence: row.deposit_pence,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAccount,
  });
}
