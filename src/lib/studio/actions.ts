"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { DESK_ROLES, requireRole, requireStaff } from "@/lib/auth/roles";
import {
  deliver,
  queueCancellationConfirmation,
  queueRescheduleConfirmation,
} from "@/lib/comms/dispatch";
import { parsePence } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  clientNoteSchema,
  messageTemplateSchema,
  recordPaymentSchema,
  rescheduleSchema,
  serviceFormSchema,
} from "@/lib/validation";

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

/**
 * Queue a fresh copy of a message that has already been sent.
 *
 * A new row rather than a retry of the old one: the log is a record of what
 * went out and when, so re-sending must add to that history rather than
 * rewrite it. The idempotency key carries a timestamp so the new copy cannot
 * collide with the original.
 */
export async function resendMessageAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(["manager", "admin"], "/studio/messages");
  const messageId = String(formData.get("messageId") ?? "");
  if (!messageId) return { error: "No message selected." };

  const supabase = createAdminClient();
  const { data: original } = await supabase
    .from("message_deliveries")
    .select("*")
    .eq("id", messageId)
    .maybeSingle();

  if (!original) return { error: "We could not find that message." };

  const { data: copy, error } = await supabase
    .from("message_deliveries")
    .insert({
      salon_id: original.salon_id,
      profile_id: original.profile_id,
      booking_id: original.booking_id,
      template_id: original.template_id,
      kind: original.kind,
      channel: original.channel,
      status: "queued" as const,
      idempotency_key: `resend:${original.id}:${Date.now()}`,
      recipient: original.recipient,
      subject: original.subject,
      body: original.body,
      provider: original.provider,
      scheduled_for: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !copy) {
    console.error("[studio] resend failed", error?.message);
    return { error: "We could not queue that message again." };
  }

  await deliver(copy.id);

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "message.resent",
    entityType: "message_delivery",
    entityId: original.id,
    metadata: { kind: original.kind, channel: original.channel, copyId: copy.id },
  });

  revalidatePath("/studio/messages");
  return { message: "Sent again." };
}

/**
 * Save a message template.
 *
 * Editing changes every message sent from now on. Messages already in the log
 * keep the text they were sent with, because the delivery row stores the
 * rendered body rather than pointing at the template.
 */
export async function saveTemplateAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(["manager", "admin"], "/studio/messages/templates");

  const parsed = messageTemplateSchema.safeParse({
    templateId: formData.get("templateId"),
    subject: formData.get("subject"),
    body: formData.get("body"),
    isActive: formData.get("isActive") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the template." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("message_templates")
    .update({
      subject: parsed.data.subject || null,
      body: parsed.data.body,
      is_active: parsed.data.isActive,
      updated_by: user.id,
    })
    .eq("id", parsed.data.templateId);

  if (error) {
    console.error("[studio] template save failed", error.message);
    return { error: "We could not save that template." };
  }

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "message_template.updated",
    entityType: "message_template",
    entityId: parsed.data.templateId,
    metadata: { isActive: parsed.data.isActive },
  });

  revalidatePath("/studio/messages/templates");
  return { message: "Template saved." };
}

/**
 * Edit a service. This is what makes the placeholder catalogue replaceable
 * without a deploy, which the Slick import depends on.
 */
export async function saveServiceAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(["manager", "admin"], "/studio/services");

  const parsed = serviceFormSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    categoryId: formData.get("categoryId"),
    shortDescription: formData.get("shortDescription"),
    description: formData.get("description") ?? "",
    preparationInstructions: formData.get("preparationInstructions"),
    aftercareInstructions: formData.get("aftercareInstructions"),
    durationMinutes: formData.get("durationMinutes"),
    bufferMinutes: formData.get("bufferMinutes"),
    // Staff think in pounds; the database stores pence. Convert at the edge
    // so there is exactly one place this can go wrong.
    basePricePence: parsePence(String(formData.get("basePrice") ?? "")),
    pricingMode: formData.get("pricingMode"),
    depositPence: parsePence(String(formData.get("deposit") ?? "")),
    requiresConsultation: formData.get("requiresConsultation") === "on",
    rebookingIntervalDays: formData.get("rebookingIntervalDays") || undefined,
    isActive: formData.get("isActive") === "on",
    isFeatured: formData.get("isFeatured") === "on",
    displayOrder: formData.get("displayOrder") ?? 0,
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    // parsePence returns null on anything that is not money, which surfaces
    // here as a type error on the price field. Say so in plain words.
    if (issue?.path.includes("basePricePence")) {
      return { error: "Enter the price as a number, for example 85 or 85.50." };
    }
    if (issue?.path.includes("depositPence")) {
      return { error: issue.message || "Enter the deposit as a number." };
    }
    return { error: issue?.message ?? "Check the service details." };
  }

  const serviceId = String(formData.get("serviceId") ?? "");
  if (!serviceId) return { error: "No service selected." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("services")
    .update({
      name: parsed.data.name,
      slug: parsed.data.slug,
      category_id: parsed.data.categoryId || null,
      short_description: parsed.data.shortDescription || null,
      description: parsed.data.description,
      preparation_instructions: parsed.data.preparationInstructions || null,
      aftercare_instructions: parsed.data.aftercareInstructions || null,
      duration_minutes: parsed.data.durationMinutes,
      buffer_minutes: parsed.data.bufferMinutes,
      base_price_pence: parsed.data.basePricePence,
      pricing_mode: parsed.data.pricingMode,
      deposit_pence: parsed.data.depositPence,
      requires_consultation: parsed.data.requiresConsultation,
      rebooking_interval_days: parsed.data.rebookingIntervalDays ?? null,
      is_active: parsed.data.isActive,
      is_featured: parsed.data.isFeatured,
      display_order: parsed.data.displayOrder,
    })
    .eq("id", serviceId);

  if (error) {
    // The database has the same deposit-vs-price rule; surface it readably.
    if (error.message.includes("services_deposit_within_price")) {
      return { error: "The deposit cannot be more than the price." };
    }
    if (error.message.includes("services_salon_id_slug_key")) {
      return { error: "Another service already uses that web address." };
    }
    console.error("[studio] service save failed", error.message);
    return { error: "We could not save that service." };
  }

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "service.updated",
    entityType: "service",
    entityId: serviceId,
    metadata: {
      pricePence: parsed.data.basePricePence,
      depositPence: parsed.data.depositPence,
      durationMinutes: parsed.data.durationMinutes,
    },
  });

  revalidatePath("/studio/services");
  revalidatePath("/services");
  return { message: "Service saved." };
}

/** Staff-side cancellation. No policy window applies to the salon. */
export async function studioCancelBookingAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireRole(DESK_ROLES, "/studio/bookings");
  const bookingId = String(formData.get("bookingId") ?? "");
  const reason = String(formData.get("reason") ?? "").slice(0, 500);
  if (!bookingId) return { error: "No appointment selected." };

  const supabase = createAdminClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, status, deposit_paid_pence")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) return { error: "We could not find that appointment." };
  if (!["pending_payment", "confirmed"].includes(booking.status)) {
    return { error: "That appointment is already cancelled or completed." };
  }

  const { error } = await supabase
    .from("bookings")
    .update({
      status: "cancelled_by_salon",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason || null,
      cancelled_by: user.id,
    })
    .eq("id", bookingId);

  if (error) return { error: "We could not cancel that appointment." };

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "booking.cancelled",
    entityType: "booking",
    entityId: bookingId,
    metadata: { by: "salon", hadDeposit: booking.deposit_paid_pence > 0 },
  });

  // When the salon cancels, the deposit goes back regardless of timing.
  await queueCancellationConfirmation(
    bookingId,
    booking.deposit_paid_pence > 0
      ? "Your deposit will be refunded in full within five working days."
      : "No deposit was taken.",
  );

  revalidatePath("/studio/bookings");
  revalidatePath("/studio/calendar");
  return { message: "Cancelled, and the client has been told." };
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
