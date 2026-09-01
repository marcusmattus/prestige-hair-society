import { enforceRateLimit, fail, ok } from "@/lib/api";
import { getSessionUser } from "@/lib/auth/roles";
import { isConfigured } from "@/lib/env";
import { depositIdempotencyKey, stripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  bookingId: z.string().uuid(),
  /** 'deposit' at booking time; 'balance' when settling from /account. */
  kind: z.enum(["deposit", "balance"]).default("deposit"),
});

/**
 * POST /api/checkout
 *
 * Creates (or reuses) a Stripe PaymentIntent and returns its client secret for
 * the Payment Element.
 *
 * The amount is read from the booking row, never from the request: a client
 * cannot ask to pay £1. The idempotency key is derived from the booking and
 * amount, so a double-submitted form reuses the same intent rather than
 * charging twice.
 */
export async function POST(request: Request) {
  const limited = enforceRateLimit(request, "checkout", { limit: 15, windowMs: 60_000 });
  if (limited) return limited;

  if (!isConfigured.stripe()) {
    return fail(
      503,
      "stripe_not_configured",
      "Card payments are not available yet. Please call the salon to secure your appointment.",
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_json", "The request body was not valid JSON.");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail(422, "validation_failed", "Missing booking reference.");

  const { bookingId, kind } = parsed.data;
  const supabase = createAdminClient();

  const { data: booking } = await supabase
    .from("bookings")
    // One template literal, not a concatenation: supabase-js types embedded
    // selects from the string's literal type, which `+` erases.
    .select(
      `id, reference, profile_id, salon_id, status, total_price_pence, deposit_pence,
       deposit_paid_pence, balance_paid_pence, starts_at,
       profile:profile_id(email, first_name, last_name)`,
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) return fail(404, "booking_not_found", "We could not find that booking.");

  // A signed-in user may only pay for their own booking. A guest is allowed
  // through only while the booking is still awaiting its first payment, which
  // is the window between POST /api/bookings and the webhook landing.
  const user = await getSessionUser();
  if (user && user.id !== booking.profile_id) {
    return fail(403, "not_your_booking", "That booking belongs to another account.");
  }
  if (!user && booking.status !== "pending_payment") {
    return fail(403, "sign_in_required", "Please sign in to pay the balance on this booking.");
  }

  const amountPence =
    kind === "deposit"
      ? Math.max(0, booking.deposit_pence - booking.deposit_paid_pence)
      : Math.max(
          0,
          booking.total_price_pence - booking.deposit_paid_pence - booking.balance_paid_pence,
        );

  if (amountPence <= 0) {
    return fail(409, "nothing_to_pay", "There is nothing outstanding on this booking.");
  }

  const profile = booking.profile as unknown as {
    email: string;
    first_name: string;
    last_name: string;
  } | null;

  try {
    const intent = await stripe().paymentIntents.create(
      {
        amount: amountPence,
        currency: "gbp",
        // Card, Apple Pay and Google Pay are all delivered by the Payment
        // Element through automatic payment methods.
        automatic_payment_methods: { enabled: true },
        receipt_email: profile?.email,
        description: `${kind === "deposit" ? "Deposit" : "Balance"} — ${booking.reference}`,
        // The webhook reads these back. They are the only link between a
        // Stripe event and our booking, so they must always be set.
        metadata: {
          booking_id: booking.id,
          booking_reference: booking.reference,
          profile_id: booking.profile_id,
          salon_id: booking.salon_id,
          kind,
        },
      },
      {
        idempotencyKey: depositIdempotencyKey(`${booking.id}:${kind}`, amountPence),
      },
    );

    // Record the attempt now so a webhook that arrives before the browser
    // returns has a row to update.
    await supabase.from("payments").upsert(
      {
        booking_id: booking.id,
        profile_id: booking.profile_id,
        salon_id: booking.salon_id,
        kind,
        status: "requires_payment" as const,
        amount_pence: amountPence,
        stripe_payment_intent_id: intent.id,
      },
      { onConflict: "stripe_payment_intent_id" },
    );

    return ok({
      clientSecret: intent.client_secret,
      amountPence,
      reference: booking.reference,
    });
  } catch (err) {
    console.error("[checkout] stripe error", err);
    return fail(502, "stripe_error", "We could not start the payment. Please try again.");
  }
}
