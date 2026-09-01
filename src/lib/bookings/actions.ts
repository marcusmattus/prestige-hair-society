"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/roles";
import {
  queueCancellationConfirmation,
  queueRescheduleConfirmation,
} from "@/lib/comms/dispatch";
import { formatPence } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isWithinPolicyWindow } from "@/lib/time";
import { cancelBookingSchema, rescheduleSchema } from "@/lib/validation";

export type ActionResult = { error?: string; message?: string };

/**
 * Customer-initiated booking changes.
 *
 * Both re-check ownership server-side even though RLS would already stop a
 * cross-account write: the guard produces a clean message, and defence in
 * depth means a policy mistake is not a data breach.
 *
 * Policy is read from the database, not hard-coded, so changing the
 * cancellation window in /studio/settings changes what customers can do.
 */

export async function rescheduleBookingAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/account/bookings");

  const parsed = rescheduleSchema.safeParse({
    bookingId: formData.get("bookingId"),
    staffId: formData.get("staffId"),
    startsAt: formData.get("startsAt"),
  });

  if (!parsed.success) return { error: "Choose a new time before continuing." };

  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, profile_id, starts_at, status, salon:salon_id(reschedule_window_hours)")
    .eq("id", parsed.data.bookingId)
    .maybeSingle();

  if (!booking || booking.profile_id !== user.id) {
    return { error: "We could not find that appointment." };
  }

  if (!["pending_payment", "confirmed"].includes(booking.status)) {
    return { error: "This appointment can no longer be changed." };
  }

  const windowHours = booking.salon?.reschedule_window_hours ?? 24;
  if (!isWithinPolicyWindow(booking.starts_at, windowHours)) {
    return {
      error: `Appointments can only be moved more than ${windowHours} hours ahead. Please call the salon.`,
    };
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("reschedule_booking", {
    p_booking_id: parsed.data.bookingId,
    p_staff_id: parsed.data.staffId,
    p_starts_at: parsed.data.startsAt,
  } as never);

  if (error) {
    if (error.message.includes("slot_unavailable")) {
      return { error: "That time has just been taken. Please choose another." };
    }
    console.error("[reschedule] failed", error.message);
    return { error: "We could not move that appointment. Please try again." };
  }

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "booking.rescheduled",
    entityType: "booking",
    entityId: parsed.data.bookingId,
    metadata: { newStart: parsed.data.startsAt, by: "customer" },
  });

  await queueRescheduleConfirmation(parsed.data.bookingId);
  revalidatePath("/account/bookings");

  return { message: "Your appointment has been moved. A confirmation is on its way." };
}

export async function cancelBookingAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/account/bookings");

  const parsed = cancelBookingSchema.safeParse({
    bookingId: formData.get("bookingId"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) return { error: "We could not cancel that appointment." };

  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select(
      `id, profile_id, starts_at, status, deposit_paid_pence,
       salon:salon_id(cancellation_window_hours)`,
    )
    .eq("id", parsed.data.bookingId)
    .maybeSingle();

  if (!booking || booking.profile_id !== user.id) {
    return { error: "We could not find that appointment." };
  }

  if (!["pending_payment", "confirmed"].includes(booking.status)) {
    return { error: "This appointment has already been cancelled or completed." };
  }

  const windowHours = booking.salon?.cancellation_window_hours ?? 24;
  const insideWindow = !isWithinPolicyWindow(booking.starts_at, windowHours);

  // The customer's own UPDATE is allowed by RLS and by the guard trigger,
  // which permits exactly this status transition and nothing else.
  const { error } = await supabase
    .from("bookings")
    .update({
      status: "cancelled_by_customer",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: parsed.data.reason || null,
      cancelled_by: user.id,
    })
    .eq("id", parsed.data.bookingId);

  if (error) {
    console.error("[cancel] failed", error.message);
    return { error: "We could not cancel that appointment. Please try again." };
  }

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "booking.cancelled",
    entityType: "booking",
    entityId: parsed.data.bookingId,
    metadata: { insideWindow, by: "customer" },
  });

  // The refund itself is a salon decision, so the message states the position
  // rather than promising money back.
  const refundNote =
    booking.deposit_paid_pence === 0
      ? "No deposit was taken."
      : insideWindow
        ? `Your ${formatPence(booking.deposit_paid_pence)} deposit is non-refundable within ${windowHours} hours of the appointment.`
        : `Your ${formatPence(booking.deposit_paid_pence)} deposit will be refunded within five working days.`;

  await queueCancellationConfirmation(parsed.data.bookingId, refundNote);
  revalidatePath("/account/bookings");

  return { message: "Your appointment has been cancelled." };
}
