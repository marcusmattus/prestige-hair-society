"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireManager } from "@/lib/auth/roles";
import { queueRefundConfirmation } from "@/lib/comms/dispatch";
import { isConfigured } from "@/lib/env";
import { refundIdempotencyKey, stripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refundSchema } from "@/lib/validation";

export type PaymentResult = { error?: string; message?: string };

/**
 * Refund a payment through Stripe.
 *
 * Stripe is asked first and the ledger is written from what it returns —
 * never the other way round. A row saying "refunded" that Stripe never
 * processed is worse than an error, because it stops anyone chasing it.
 *
 * The idempotency key is derived from the payment and the amount, so a
 * double-submitted form returns Stripe's original refund rather than issuing
 * a second one.
 */
export async function refundPaymentAction(
  _prev: PaymentResult | null,
  formData: FormData,
): Promise<PaymentResult> {
  const user = await requireManager("/studio/payments");

  const parsed = refundSchema.safeParse({
    paymentId: formData.get("paymentId"),
    amountPence: formData.get("amountPence"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the amount and reason." };
  }

  const supabase = createAdminClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("*")
    .eq("id", parsed.data.paymentId)
    .maybeSingle();

  if (!payment) return { error: "We could not find that payment." };

  if (payment.status !== "succeeded" && payment.status !== "partially_refunded") {
    return { error: "Only a settled payment can be refunded." };
  }

  const refundable = payment.amount_pence - payment.refunded_pence;
  if (parsed.data.amountPence > refundable) {
    return {
      error:
        refundable === 0
          ? "That payment has already been refunded in full."
          : `Only ${(refundable / 100).toFixed(2)} is left to refund on that payment.`,
    };
  }

  // Cash taken in the salon is refunded in the salon; there is no Stripe
  // charge to reverse, so this records the fact rather than moving money.
  if (payment.kind === "in_salon" || !payment.stripe_payment_intent_id) {
    const { error } = await supabase.from("refunds").insert({
      payment_id: payment.id,
      booking_id: payment.booking_id,
      amount_pence: parsed.data.amountPence,
      reason: parsed.data.reason,
      status: "succeeded",
      issued_by: user.id,
    });

    if (error) return { error: "We could not record that refund." };

    await audit({
      actorId: user.id,
      actorEmail: user.email,
      action: "payment.refunded_in_salon",
      entityType: "payment",
      entityId: payment.id,
      metadata: { amountPence: parsed.data.amountPence },
    });

    revalidatePath("/studio/payments");
    return {
      message: "Recorded. This did not move any money — refund the customer in the salon.",
    };
  }

  if (!isConfigured.stripe()) {
    return {
      error:
        "Stripe is not configured in this environment, so no refund can be issued. " +
        "Add STRIPE_SECRET_KEY — see docs/SETUP.md.",
    };
  }

  let stripeRefundId: string;
  try {
    const refund = await stripe().refunds.create(
      {
        payment_intent: payment.stripe_payment_intent_id,
        amount: parsed.data.amountPence,
        reason: "requested_by_customer",
        metadata: {
          bookingId: payment.booking_id ?? "",
          issuedBy: user.id,
          note: parsed.data.reason.slice(0, 400),
        },
      },
      { idempotencyKey: refundIdempotencyKey(payment.id, parsed.data.amountPence) },
    );
    stripeRefundId = refund.id;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[payments] stripe refund failed", message);
    return { error: `Stripe refused the refund: ${message}` };
  }

  // Only now is the ledger written. The trigger in 0007 keeps
  // payments.refunded_pence and the payment status in step.
  const { error } = await supabase.from("refunds").insert({
    payment_id: payment.id,
    booking_id: payment.booking_id,
    amount_pence: parsed.data.amountPence,
    reason: parsed.data.reason,
    stripe_refund_id: stripeRefundId,
    status: "succeeded",
    issued_by: user.id,
  });

  if (error) {
    // The money has moved; losing the record would be worse than a loud error.
    console.error(
      "[payments] refund succeeded at Stripe but the ledger write failed",
      { stripeRefundId, paymentId: payment.id, message: error.message },
    );
    return {
      error:
        `Stripe processed the refund (${stripeRefundId}) but we could not record it. ` +
        "Do not retry — reconcile this by hand.",
    };
  }

  if (payment.booking_id) {
    await queueRefundConfirmation(payment.booking_id);
  }

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "payment.refunded",
    entityType: "payment",
    entityId: payment.id,
    metadata: { amountPence: parsed.data.amountPence, stripeRefundId },
  });

  revalidatePath("/studio/payments");
  revalidatePath("/studio/bookings");

  return {
    message: `Refunded ${(parsed.data.amountPence / 100).toFixed(2)}. The customer has been emailed.`,
  };
}
