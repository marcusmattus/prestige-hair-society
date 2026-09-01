"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { DESK_ROLES, requireRole, requireStaff } from "@/lib/auth/roles";
import { queueRescheduleConfirmation } from "@/lib/comms/dispatch";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { clientNoteSchema, recordPaymentSchema, rescheduleSchema } from "@/lib/validation";

export type ActionResult = { error?: string; message?: string };

/**
 * Staff actions.
 *
 * Each one names the roles it needs. requireRole() is the server-side half;
 * RLS is the other half, and a mistake in one is caught by the other.
 */

export async function addClientNoteAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireStaff("/studio/clients");

  const parsed = clientNoteSchema.safeParse({
    profileId: formData.get("profileId"),
    body: formData.get("body"),
    kind: formData.get("kind"),
  });

  if (!parsed.success) return { error: "Write something before saving." };

  const supabase = await createClient();
  const { error } = await supabase.from("client_notes").insert({
    profile_id: parsed.data.profileId,
    author_id: user.id,
    body: parsed.data.body,
    kind: parsed.data.kind,
  });

  if (error) {
    console.error("[studio] note insert failed", error.message);
    return { error: "We could not save that note." };
  }

  // The note's text is personal; the audit records that one was written.
  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "client_note.created",
    entityType: "profile",
    entityId: parsed.data.profileId,
    metadata: { kind: parsed.data.kind },
  });

  revalidatePath(`/studio/clients/${parsed.data.profileId}`);
  return { message: "Note added." };
}

export async function markNoShowAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(DESK_ROLES, "/studio/bookings");
  const bookingId = String(formData.get("bookingId") ?? "");
  if (!bookingId) return { error: "No appointment selected." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update({ status: "no_show" })
    .eq("id", bookingId);

  if (error) return { error: "We could not update that appointment." };

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "booking.marked_no_show",
    entityType: "booking",
    entityId: bookingId,
  });

  revalidatePath("/studio");
  revalidatePath("/studio/bookings");
  return { message: "Marked as a no-show." };
}

export async function completeBookingAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireStaff("/studio/bookings");
  const bookingId = String(formData.get("bookingId") ?? "");
  if (!bookingId) return { error: "No appointment selected." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", bookingId);

  if (error) return { error: "We could not update that appointment." };

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "booking.completed",
    entityType: "booking",
    entityId: bookingId,
  });

  revalidatePath("/studio");
  return { message: "Marked as completed." };
}

/**
 * Record a balance settled in the salon (cash, or a card machine outside
 * Stripe). This is the one payment row staff may write; everything else comes
 * from the webhook, and the guard trigger in 0012 enforces that.
 */
export async function recordInSalonPaymentAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(["manager", "admin"], "/studio/payments");

  const parsed = recordPaymentSchema.safeParse({
    bookingId: formData.get("bookingId"),
    amountPence: formData.get("amountPence"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) return { error: "Enter a valid amount." };

  const supabase = await createClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, profile_id, salon_id, total_price_pence, deposit_paid_pence, balance_paid_pence")
    .eq("id", parsed.data.bookingId)
    .maybeSingle();

  if (!booking) return { error: "We could not find that appointment." };

  const outstanding =
    booking.total_price_pence - booking.deposit_paid_pence - booking.balance_paid_pence;

  if (parsed.data.amountPence > outstanding) {
    return { error: "That is more than the outstanding balance." };
  }

  const { error } = await supabase.from("payments").insert({
    booking_id: booking.id,
    profile_id: booking.profile_id,
    salon_id: booking.salon_id,
    kind: "in_salon",
    status: "succeeded",
    amount_pence: parsed.data.amountPence,
    notes: parsed.data.notes || null,
    paid_at: new Date().toISOString(),
  });

  if (error) {
    console.error("[studio] in-salon payment failed", error.message);
    return { error: "We could not record that payment." };
  }

  // Keep the booking's running total in step.
  const admin = createAdminClient();
  await admin.rpc("confirm_booking_paid", {
    p_booking_id: booking.id,
    p_amount_pence: parsed.data.amountPence,
    p_kind: "in_salon",
  } as never);

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "payment.recorded_in_salon",
    entityType: "booking",
    entityId: booking.id,
    metadata: { amountPence: parsed.data.amountPence },
  });

  revalidatePath("/studio/payments");
  return { message: "Payment recorded." };
}

/** Staff-initiated reschedule. Policy windows do not apply to the salon. */
export async function studioRescheduleAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(DESK_ROLES, "/studio/calendar");

  const parsed = rescheduleSchema.safeParse({
    bookingId: formData.get("bookingId"),
    staffId: formData.get("staffId"),
    startsAt: formData.get("startsAt"),
  });

  if (!parsed.success) return { error: "Choose a stylist and a time." };

  const admin = createAdminClient();
  const { error } = await admin.rpc("reschedule_booking", {
    p_booking_id: parsed.data.bookingId,
    p_staff_id: parsed.data.staffId,
    p_starts_at: parsed.data.startsAt,
  } as never);

  if (error) {
    if (error.message.includes("slot_unavailable")) {
      return { error: "That stylist is not free then." };
    }
    return { error: "We could not move that appointment." };
  }

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "booking.rescheduled",
    entityType: "booking",
    entityId: parsed.data.bookingId,
    metadata: { newStart: parsed.data.startsAt, by: "staff" },
  });

  // The customer is told, and their reminder ladder is rebuilt.
  await queueRescheduleConfirmation(parsed.data.bookingId);

  revalidatePath("/studio/calendar");
  return { message: "Appointment moved and the client has been told." };
}
