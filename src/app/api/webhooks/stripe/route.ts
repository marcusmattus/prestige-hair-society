import type Stripe from "stripe";
import { audit } from "@/lib/audit";
import { queueBookingMessages, queuePaymentFailure, queueRefundConfirmation } from "@/lib/comms/dispatch";
import { stripeEnv } from "@/lib/env";
import { stripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
// Signature verification needs the raw body, so this must run on Node.
export const runtime = "nodejs";

/**
 * POST /api/webhooks/stripe
 *
 * The source of truth for payment. The browser's redirect back from the
 * Payment Element is a UI convenience and is never trusted: a booking only
 * becomes `confirmed` here, after Stripe's signature has been verified.
 *
 * Every handler is idempotent. Stripe retries, and events can arrive out of
 * order or twice; replaying an event must leave the same state.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(
      raw,
      signature,
      stripeEnv().STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    // A bad signature is either a misconfiguration or someone probing.
    console.error("[stripe] signature verification failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded":
        await handleSucceeded(event.data.object);
        break;
      case "payment_intent.payment_failed":
        await handleFailed(event.data.object);
        break;
      case "charge.refunded":
        await handleRefunded(event.data.object);
        break;
      case "charge.dispute.created":
        await handleDispute(event.data.object);
        break;
      default:
        // Everything else is acknowledged and ignored, so Stripe stops retrying.
        break;
    }
  } catch (err) {
    console.error(`[stripe] handler for ${event.type} threw`, err);
    // 500 makes Stripe retry with backoff, which is what we want for a
    // transient database failure.
    return new Response("Handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

// ---------------------------------------------------------------------------

async function handleSucceeded(intent: Stripe.PaymentIntent) {
  const supabase = createAdminClient();
  const bookingId = intent.metadata?.booking_id;
  const kind = (intent.metadata?.kind ?? "deposit") as "deposit" | "balance";

  if (!bookingId) {
    console.error("[stripe] payment_intent.succeeded with no booking_id", intent.id);
    return;
  }

  const charge = await latestCharge(intent);

  // Idempotent by stripe_payment_intent_id, which is unique.
  const { error: paymentError } = await supabase.from("payments").upsert(
    {
      booking_id: bookingId,
      profile_id: intent.metadata!.profile_id,
      salon_id: intent.metadata!.salon_id,
      kind,
      status: "succeeded" as const,
      amount_pence: intent.amount_received || intent.amount,
      stripe_payment_intent_id: intent.id,
      stripe_charge_id: charge?.id ?? null,
      payment_method_brand: charge?.payment_method_details?.card?.brand ?? null,
      payment_method_last4: charge?.payment_method_details?.card?.last4 ?? null,
      receipt_url: charge?.receipt_url ?? null,
      paid_at: new Date(intent.created * 1000).toISOString(),
    },
    { onConflict: "stripe_payment_intent_id" },
  );

  if (paymentError) throw new Error(`payments upsert: ${paymentError.message}`);

  // confirm_booking_paid() is itself idempotent: replaying leaves the deposit
  // at the same figure rather than double-counting it.
  const { error: bookingError } = await supabase.rpc("confirm_booking_paid", {
    p_booking_id: bookingId,
    p_amount_pence: intent.amount_received || intent.amount,
    p_kind: kind,
  } as never);

  if (bookingError) throw new Error(`confirm_booking_paid: ${bookingError.message}`);

  await audit({
    action: "payment.succeeded",
    entityType: "booking",
    entityId: bookingId,
    metadata: { intentId: intent.id, amountPence: intent.amount, kind },
  });

  // Confirmation email and SMS, plus the reminder schedule. The delivery
  // ledger is keyed on an idempotency key, so a replayed webhook does not
  // send the customer a second confirmation.
  await queueBookingMessages(bookingId, kind);
}

async function handleFailed(intent: Stripe.PaymentIntent) {
  const supabase = createAdminClient();
  const bookingId = intent.metadata?.booking_id;
  if (!bookingId) return;

  await supabase.from("payments").upsert(
    {
      booking_id: bookingId,
      profile_id: intent.metadata!.profile_id,
      salon_id: intent.metadata!.salon_id,
      kind: (intent.metadata?.kind ?? "deposit") as "deposit" | "balance",
      status: "failed" as const,
      amount_pence: intent.amount,
      stripe_payment_intent_id: intent.id,
      failure_code: intent.last_payment_error?.code ?? null,
      failure_message: intent.last_payment_error?.message ?? null,
    },
    { onConflict: "stripe_payment_intent_id" },
  );

  // The booking deliberately stays `pending_payment` rather than being
  // cancelled: the customer may retry within the hold window, and staff can
  // see the attempt. The sweep job releases it if they do not.
  await audit({
    action: "payment.failed",
    entityType: "booking",
    entityId: bookingId,
    metadata: { intentId: intent.id, code: intent.last_payment_error?.code },
  });

  await queuePaymentFailure(bookingId);
}

async function handleRefunded(charge: Stripe.Charge) {
  const supabase = createAdminClient();
  const intentId = typeof charge.payment_intent === "string"
    ? charge.payment_intent
    : charge.payment_intent?.id;
  if (!intentId) return;

  const { data: payment } = await supabase
    .from("payments")
    .select("id, booking_id, amount_pence")
    .eq("stripe_payment_intent_id", intentId)
    .maybeSingle();

  if (!payment) return;

  // Reconcile against Stripe's figure rather than assuming a full refund;
  // a partial refund must not mark the payment fully refunded.
  for (const refund of charge.refunds?.data ?? []) {
    await supabase.from("refunds").upsert(
      {
        payment_id: payment.id,
        booking_id: payment.booking_id,
        amount_pence: refund.amount,
        stripe_refund_id: refund.id,
        status: "succeeded" as const,
        reason: refund.reason ?? null,
      },
      { onConflict: "stripe_refund_id" },
    );
  }

  await audit({
    action: "payment.refunded",
    entityType: "payment",
    entityId: payment.id,
    metadata: { chargeId: charge.id, amountRefunded: charge.amount_refunded },
  });

  if (payment.booking_id) await queueRefundConfirmation(payment.booking_id);
}

async function handleDispute(dispute: Stripe.Dispute) {
  const supabase = createAdminClient();
  const intentId = typeof dispute.payment_intent === "string"
    ? dispute.payment_intent
    : dispute.payment_intent?.id;
  if (!intentId) return;

  await supabase
    .from("payments")
    .update({ status: "disputed" as const })
    .eq("stripe_payment_intent_id", intentId);

  // Disputes need a human. The studio payments view surfaces this status.
  await audit({
    action: "payment.disputed",
    entityType: "payment",
    entityId: intentId,
    metadata: { disputeId: dispute.id, reason: dispute.reason, amount: dispute.amount },
  });
}

/** Stripe returns the charge inline or as an id, depending on expansion. */
async function latestCharge(intent: Stripe.PaymentIntent): Promise<Stripe.Charge | null> {
  const latest = intent.latest_charge;
  if (!latest) return null;
  if (typeof latest !== "string") return latest;
  try {
    return await stripe().charges.retrieve(latest);
  } catch {
    return null;
  }
}
