import "server-only";

import Stripe from "stripe";
import { stripeEnv } from "@/lib/env";

let cached: Stripe | null = null;

/** Server-side Stripe client. Throws a readable error if unconfigured. */
export function stripe(): Stripe {
  if (cached) return cached;
  const { STRIPE_SECRET_KEY } = stripeEnv();
  cached = new Stripe(STRIPE_SECRET_KEY, {
    // Pin the version: a silent upgrade must never change webhook payloads.
    // Keep this in step with the pinned `stripe` package major.
    apiVersion: "2026-08-26.dahlia",
    typescript: true,
    appInfo: { name: "Prestige Hair Society", version: "1.0.0" },
  });
  return cached;
}

/**
 * A stable idempotency key for a booking's deposit.
 *
 * Retrying checkout, or a double-submitted form, reuses the same key, so
 * Stripe returns the original PaymentIntent rather than charging twice.
 */
export function depositIdempotencyKey(bookingId: string, amountPence: number) {
  return `deposit:${bookingId}:${amountPence}`;
}

export function balanceIdempotencyKey(bookingId: string, amountPence: number) {
  return `balance:${bookingId}:${amountPence}`;
}

export function refundIdempotencyKey(paymentId: string, amountPence: number) {
  return `refund:${paymentId}:${amountPence}`;
}
