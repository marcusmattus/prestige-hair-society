import "server-only";

import { appUrl } from "@/lib/env";
import { balanceDue, formatPence } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Enums } from "@/lib/supabase/types";
import { formatDuration, formatWhenLong, formatWhenShort } from "@/lib/time";
import { render, type TemplateContext } from "./render";
import { sendEmail, sendSms } from "./send";

type MessageKind = Enums<"message_kind">;
type Channel = Enums<"message_channel">;

/**
 * Message dispatch.
 *
 * Everything goes through the message_deliveries ledger, whose unique
 * idempotency_key is what stops a retried cron run or a replayed Stripe
 * webhook sending a customer the same thing twice. The rule is:
 *
 *   1. Claim the key by inserting a 'queued' row. A duplicate key means
 *      someone already claimed it -- stop, do not send.
 *   2. Send.
 *   3. Record the outcome.
 *
 * A crash between 1 and 3 leaves a stuck 'queued' row rather than a duplicate
 * message; /api/cron/messages retries those, which is the safer failure.
 */

/** Deterministic and collision-free: one message of each kind per booking. */
export function idempotencyKey(parts: (string | number)[]): string {
  return parts.join(":");
}

type BookingContext = {
  bookingId: string;
  salonId: string;
  profileId: string;
  email: string;
  phone: string | null;
  reminderEmail: boolean;
  reminderSms: boolean;
  marketingEmail: boolean;
  context: TemplateContext;
};

/** Assemble everything a template might reference for one booking. */
async function loadBookingContext(bookingId: string): Promise<BookingContext | null> {
  const supabase = createAdminClient();

  const { data: booking } = await supabase
    .from("bookings")
    // One template literal, not a concatenation: supabase-js types embedded
    // selects from the string's literal type, which `+` erases.
    .select(
      `id, reference, salon_id, profile_id, starts_at, ends_at, total_price_pence,
       deposit_pence, deposit_paid_pence, balance_paid_pence,
       service:service_id(name, preparation_instructions, aftercare_instructions),
       staff:staff_id(display_name),
       profile:profile_id(first_name, last_name, email, phone, reminder_email, reminder_sms, marketing_email),
       salon:salon_id(name, address_line1, city, postcode, phone, timezone)`,
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) return null;

  const service = booking.service as unknown as {
    name: string;
    preparation_instructions: string | null;
    aftercare_instructions: string | null;
  } | null;
  const staff = booking.staff as unknown as { display_name: string } | null;
  const profile = booking.profile as unknown as {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    reminder_email: boolean;
    reminder_sms: boolean;
    marketing_email: boolean;
  } | null;
  const salon = booking.salon as unknown as {
    name: string;
    address_line1: string;
    city: string;
    postcode: string;
    phone: string | null;
    timezone: string;
  } | null;

  if (!profile || !salon) return null;

  const tz = salon.timezone;
  const durationMinutes = Math.round(
    (Date.parse(booking.ends_at) - Date.parse(booking.starts_at)) / 60_000,
  );
  const outstanding = balanceDue(
    booking.total_price_pence,
    booking.deposit_paid_pence,
    booking.balance_paid_pence,
  );

  return {
    bookingId: booking.id,
    salonId: booking.salon_id,
    profileId: booking.profile_id,
    email: profile.email,
    phone: profile.phone,
    reminderEmail: profile.reminder_email,
    reminderSms: profile.reminder_sms,
    marketingEmail: profile.marketing_email,
    context: {
      customer: {
        firstName: profile.first_name,
        lastName: profile.last_name,
        email: profile.email,
      },
      booking: {
        reference: booking.reference,
        serviceName: service?.name ?? "your appointment",
        staffName: staff?.display_name ?? "one of our stylists",
        whenLong: formatWhenLong(booking.starts_at, tz),
        whenShort: formatWhenShort(booking.starts_at, tz),
        duration: formatDuration(durationMinutes),
        total: formatPence(booking.total_price_pence),
        depositPaid: formatPence(booking.deposit_paid_pence),
        balance: formatPence(outstanding),
      },
      service: {
        preparation: service?.preparation_instructions ?? "Nothing in particular.",
        aftercare: service?.aftercare_instructions ?? "",
      },
      salon: {
        name: salon.name,
        address: `${salon.address_line1}, ${salon.city} ${salon.postcode}`,
        phone: salon.phone ?? "",
      },
      links: {
        manage: `${appUrl}/account/bookings`,
        book: `${appUrl}/book`,
        preferences: `${appUrl}/account/preferences`,
        retry: `${appUrl}/book?retry=${booking.reference}`,
        review: `${appUrl}/account/bookings`,
      },
    },
  };
}

/**
 * Queue-then-send one message. Returns false when the idempotency key was
 * already taken, which is the normal outcome on a webhook replay.
 */
async function dispatch(args: {
  kind: MessageKind;
  channel: Channel;
  salonId: string;
  profileId: string;
  bookingId: string | null;
  recipient: string;
  context: TemplateContext;
  idempotencyKey: string;
  scheduledFor?: string;
}): Promise<boolean> {
  const supabase = createAdminClient();

  const { data: template } = await supabase
    .from("message_templates")
    .select("id, subject, body")
    .eq("salon_id", args.salonId)
    .eq("kind", args.kind)
    .eq("channel", args.channel)
    .eq("is_active", true)
    .maybeSingle();

  if (!template) return false;

  const subject = template.subject ? render(template.subject, args.context) : null;
  const body = render(template.body, args.context);

  // Step 1: claim the key. A unique violation means another run got there.
  const { data: delivery, error: claimError } = await supabase
    .from("message_deliveries")
    .insert({
      salon_id: args.salonId,
      profile_id: args.profileId,
      booking_id: args.bookingId,
      template_id: template.id,
      kind: args.kind,
      channel: args.channel,
      status: "queued" as const,
      idempotency_key: args.idempotencyKey,
      recipient: args.recipient,
      subject,
      body,
      scheduled_for: args.scheduledFor ?? null,
      provider: args.channel === "email" ? "resend" : "twilio",
    })
    .select("id")
    .single();

  if (claimError || !delivery) return false;

  // Scheduled messages are left for the cron route to pick up.
  if (args.scheduledFor && Date.parse(args.scheduledFor) > Date.now()) return true;

  await deliver(delivery.id);
  return true;
}

/** Send a queued row and record the outcome. Safe to call again on a retry. */
export async function deliver(deliveryId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: row } = await supabase
    .from("message_deliveries")
    .select("*")
    .eq("id", deliveryId)
    .maybeSingle();

  if (!row || row.status === "sent" || row.status === "delivered") return;

  const result =
    row.channel === "email"
      ? await sendEmail({
          to: row.recipient,
          subject: row.subject ?? "Prestige Hair Society",
          text: row.body,
        })
      : await sendSms({ to: row.recipient, body: row.body });

  await supabase
    .from("message_deliveries")
    .update({
      status:
        result.status === "sent"
          ? ("sent" as const)
          : result.status === "skipped"
            ? ("skipped" as const)
            : ("failed" as const),
      provider_message_id: result.status === "sent" ? result.providerMessageId : null,
      error_message:
        result.status === "failed"
          ? result.error
          : result.status === "skipped"
            ? result.reason
            : null,
      sent_at: result.status === "sent" ? new Date().toISOString() : null,
      attempts: row.attempts + 1,
    })
    .eq("id", deliveryId);
}

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/**
 * Confirmation now, plus the reminder ladder:
 *   email 48h before, SMS 24h before, final SMS 3h before,
 *   thank-you after, rebooking reminder at the service's interval.
 *
 * Reminders are queued with scheduled_for and sent by /api/cron/messages.
 */
export async function queueBookingMessages(
  bookingId: string,
  paymentKind: "deposit" | "balance" = "deposit",
) {
  const ctx = await loadBookingContext(bookingId);
  if (!ctx) return;

  const base = {
    salonId: ctx.salonId,
    profileId: ctx.profileId,
    bookingId: ctx.bookingId,
    context: ctx.context,
  };

  await dispatch({
    ...base,
    kind: "booking_confirmation",
    channel: "email",
    recipient: ctx.email,
    idempotencyKey: idempotencyKey(["confirmation", "email", bookingId]),
  });

  if (ctx.phone) {
    await dispatch({
      ...base,
      kind: "booking_confirmation",
      channel: "sms",
      recipient: ctx.phone,
      idempotencyKey: idempotencyKey(["confirmation", "sms", bookingId]),
    });
  }

  await dispatch({
    ...base,
    kind: "deposit_receipt",
    channel: "email",
    recipient: ctx.email,
    idempotencyKey: idempotencyKey(["receipt", paymentKind, bookingId]),
    context: {
      ...ctx.context,
      payment: { amount: (ctx.context.booking as Record<string, string>).depositPaid },
    },
  });

  await scheduleReminders(bookingId);
}

/** (Re)build the reminder ladder. Called after booking and after a reschedule. */
export async function scheduleReminders(bookingId: string) {
  const supabase = createAdminClient();
  const ctx = await loadBookingContext(bookingId);
  if (!ctx) return;

  const { data: booking } = await supabase
    .from("bookings")
    .select("starts_at, ends_at, service:service_id(rebooking_interval_days)")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) return;

  const startsAt = Date.parse(booking.starts_at);
  const endsAt = Date.parse(booking.ends_at);
  const hour = 3_600_000;

  const base = {
    salonId: ctx.salonId,
    profileId: ctx.profileId,
    bookingId: ctx.bookingId,
    context: ctx.context,
  };

  // A customer who has switched a channel off is not scheduled on it at all,
  // rather than being queued and skipped at send time.
  const plan: {
    kind: MessageKind;
    channel: Channel;
    at: number;
    enabled: boolean;
    recipient: string | null;
  }[] = [
    {
      kind: "appointment_reminder",
      channel: "email",
      at: startsAt - 48 * hour,
      enabled: ctx.reminderEmail,
      recipient: ctx.email,
    },
    {
      kind: "appointment_reminder",
      channel: "sms",
      at: startsAt - 24 * hour,
      enabled: ctx.reminderSms,
      recipient: ctx.phone,
    },
    {
      kind: "appointment_reminder",
      channel: "sms",
      at: startsAt - 3 * hour,
      enabled: ctx.reminderSms,
      recipient: ctx.phone,
    },
    {
      kind: "post_appointment_thanks",
      channel: "email",
      at: endsAt + 2 * hour,
      enabled: true,
      recipient: ctx.email,
    },
  ];

  const rebookDays = (booking.service as unknown as { rebooking_interval_days: number | null } | null)
    ?.rebooking_interval_days;
  if (rebookDays && ctx.marketingEmail) {
    plan.push({
      kind: "rebooking_reminder",
      channel: "email",
      at: endsAt + rebookDays * 24 * hour,
      enabled: true,
      recipient: ctx.email,
    });
  }

  for (const item of plan) {
    if (!item.enabled || !item.recipient || item.at <= Date.now()) continue;
    await dispatch({
      ...base,
      kind: item.kind,
      channel: item.channel,
      recipient: item.recipient,
      scheduledFor: new Date(item.at).toISOString(),
      // The timestamp is in the key so a reschedule queues a fresh ladder
      // rather than colliding with the old one.
      idempotencyKey: idempotencyKey([item.kind, item.channel, bookingId, item.at]),
    });
  }
}

export async function queuePaymentFailure(bookingId: string) {
  const ctx = await loadBookingContext(bookingId);
  if (!ctx) return;
  await dispatch({
    kind: "payment_failure",
    channel: "email",
    salonId: ctx.salonId,
    profileId: ctx.profileId,
    bookingId: ctx.bookingId,
    recipient: ctx.email,
    context: ctx.context,
    // Attempt-scoped so a second failed card does notify the customer again.
    idempotencyKey: idempotencyKey(["payment_failure", bookingId, Date.now()]),
  });
}

export async function queueRefundConfirmation(bookingId: string) {
  const ctx = await loadBookingContext(bookingId);
  if (!ctx) return;
  await dispatch({
    kind: "refund_confirmation",
    channel: "email",
    salonId: ctx.salonId,
    profileId: ctx.profileId,
    bookingId: ctx.bookingId,
    recipient: ctx.email,
    context: {
      ...ctx.context,
      payment: { amount: (ctx.context.booking as Record<string, string>).depositPaid },
    },
    idempotencyKey: idempotencyKey(["refund", bookingId]),
  });
}

export async function queueRescheduleConfirmation(bookingId: string) {
  const ctx = await loadBookingContext(bookingId);
  if (!ctx) return;
  await dispatch({
    kind: "reschedule_confirmation",
    channel: "email",
    salonId: ctx.salonId,
    profileId: ctx.profileId,
    bookingId: ctx.bookingId,
    recipient: ctx.email,
    context: ctx.context,
    idempotencyKey: idempotencyKey(["reschedule", bookingId, Date.now()]),
  });
  await scheduleReminders(bookingId);
}

export async function queueCancellationConfirmation(
  bookingId: string,
  refundNote: string,
) {
  const ctx = await loadBookingContext(bookingId);
  if (!ctx) return;

  // Any reminders still pending for a cancelled appointment must not go out.
  const supabase = createAdminClient();
  await supabase
    .from("message_deliveries")
    .update({ status: "skipped" as const, error_message: "Booking cancelled" })
    .eq("booking_id", bookingId)
    .eq("status", "queued");

  await dispatch({
    kind: "cancellation_confirmation",
    channel: "email",
    salonId: ctx.salonId,
    profileId: ctx.profileId,
    bookingId: ctx.bookingId,
    recipient: ctx.email,
    context: {
      ...ctx.context,
      booking: { ...(ctx.context.booking as object), refundNote },
    },
    idempotencyKey: idempotencyKey(["cancellation", bookingId]),
  });
}
