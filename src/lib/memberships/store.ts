import "server-only";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Persist a completed membership purchase.
 *
 * Called from the Stripe webhook with the service-role client (RLS bypassed).
 * Idempotent on the checkout session id, so a replayed webhook is a no-op. The
 * buyer may be a guest: profile_id is linked if a profile already exists for
 * the email, otherwise left null and claimed on first sign-in.
 */

const idOf = (value: string | { id: string } | null | undefined): string | null =>
  typeof value === "string" ? value : value && typeof value === "object" ? value.id : null;

const poundsToPence = (value: string | undefined) => Math.round(Number(value || 0) * 100);

export async function recordMembershipPurchase(session: Stripe.Checkout.Session) {
  const m = session.metadata || {};
  if (m.type !== "membership" || !m.email) return { skipped: true as const };

  const admin = createAdminClient();

  const { data: salon } = await admin
    .from("salons")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!salon) throw new Error("No salon configured for membership");

  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", m.email)
    .is("deleted_at", null)
    .maybeSingle();

  const { error } = await admin.from("memberships").upsert(
    {
      salon_id: salon.id,
      profile_id: profile?.id ?? null,
      email: m.email,
      programme_id: m.programme_id || "",
      programme_name: m.programme_name || "Programme",
      category: m.category || null,
      tier: m.tier || "short",
      payment: m.payment === "monthly" ? "monthly" : "full",
      status: "active",
      total_pence: poundsToPence(m.total),
      amount_now_pence: poundsToPence(m.amount_now),
      months: m.months ? Number(m.months) : null,
      included_visits: m.visits ? Number(m.visits) : 0,
      completed_visits: 0,
      booking_reference: m.booking_reference || null,
      stripe_checkout_session_id: session.id,
      stripe_customer_id: idOf(session.customer),
      stripe_subscription_id: idOf(session.subscription),
      stripe_payment_intent_id: idOf(session.payment_intent),
    },
    { onConflict: "stripe_checkout_session_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(`Could not record membership: ${error.message}`);
  return { ok: true as const };
}

/**
 * Link any unclaimed memberships bought as a guest to the now signed-in user,
 * matched on email. Called on dashboard load with the validated session email.
 */
export async function claimMemberships(userId: string, email: string) {
  const admin = createAdminClient();
  await admin
    .from("memberships")
    .update({ profile_id: userId })
    .is("profile_id", null)
    .eq("email", email);
}
