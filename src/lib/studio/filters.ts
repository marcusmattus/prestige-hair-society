/**
 * Narrow a query-string value to one of a known set.
 *
 * Search params are strings; the generated database types expect the enum
 * union. This does the check once, so a hand-edited URL like
 * `?status=nonsense` is dropped rather than passed through to PostgREST as an
 * invalid enum comparison.
 */
export function asEnum<const T extends readonly string[]>(
  value: string | undefined,
  allowed: T,
): T[number] | undefined {
  if (!value) return undefined;
  return (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : undefined;
}

export const BOOKING_STATUSES = [
  "pending_payment",
  "confirmed",
  "completed",
  "cancelled_by_customer",
  "cancelled_by_salon",
  "no_show",
] as const;

export const DELIVERY_STATUSES = [
  "queued",
  "sent",
  "delivered",
  "failed",
  "skipped",
] as const;

export const MESSAGE_CHANNELS = ["email", "sms"] as const;

export const MESSAGE_KINDS = [
  "booking_confirmation",
  "deposit_receipt",
  "appointment_reminder",
  "reschedule_confirmation",
  "cancellation_confirmation",
  "waitlist_availability",
  "payment_failure",
  "refund_confirmation",
  "post_appointment_thanks",
  "review_request",
  "rebooking_reminder",
] as const;
