"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireManager } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export type SettingsResult = { error?: string; message?: string };

const notificationSchema = z.object({
  notificationEmail: z
    .string()
    .trim()
    .email("Enter a valid email address")
    .or(z.literal(""))
    .transform((v) => v || null),
  notifyOnBooking: z.boolean(),
  notifyOnCancellation: z.boolean(),
});

/**
 * Where booking alerts go, and whether they go at all.
 *
 * This is the address the owner reads on their phone, so it is deliberately
 * separate from the public contact address in salons.email -- a salon that
 * publishes hello@ does not want every alert landing in a shared inbox.
 */
export async function updateNotificationSettingsAction(
  _prev: SettingsResult | null,
  formData: FormData,
): Promise<SettingsResult> {
  const user = await requireManager("/studio/settings");

  const parsed = notificationSchema.safeParse({
    notificationEmail: formData.get("notificationEmail") ?? "",
    notifyOnBooking: formData.get("notifyOnBooking") === "on",
    notifyOnCancellation: formData.get("notifyOnCancellation") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details you entered." };
  }

  const supabase = createAdminClient();
  const { data: salon } = await supabase
    .from("salons")
    .select("id")
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!salon) return { error: "No active salon is configured." };

  const { error } = await supabase
    .from("salons")
    .update({
      notification_email: parsed.data.notificationEmail,
      notify_on_booking: parsed.data.notifyOnBooking,
      notify_on_cancellation: parsed.data.notifyOnCancellation,
    })
    .eq("id", salon.id);

  if (error) {
    console.error("[settings] notification update failed", error.message);
    return { error: "We could not save those settings." };
  }

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "settings.notifications_updated",
    entityType: "salon",
    entityId: salon.id,
    // The address itself is personal data; record that it changed, not to what.
    metadata: {
      hasAddress: parsed.data.notificationEmail !== null,
      notifyOnBooking: parsed.data.notifyOnBooking,
      notifyOnCancellation: parsed.data.notifyOnCancellation,
    },
  });

  revalidatePath("/studio/settings");
  return {
    message: parsed.data.notificationEmail
      ? "Saved. New bookings will be emailed to that address."
      : "Saved. With no address set, alerts fall back to the salon's contact email.",
  };
}

/**
 * Rotate a calendar feed token.
 *
 * This is the "my phone was stolen" button: it invalidates every existing
 * subscription to that feed immediately. There is no way to revoke one device
 * and keep another, because the URL is the only credential a calendar app can
 * present -- so this is deliberately blunt and clearly labelled as such.
 */
export async function rotateCalendarTokenAction(
  _prev: SettingsResult | null,
  formData: FormData,
): Promise<SettingsResult> {
  const user = await requireManager("/studio/settings");

  const target = formData.get("target");
  const staffId = formData.get("staffId");

  if (target !== "salon" && target !== "staff") {
    return { error: "Unknown calendar." };
  }

  const supabase = createAdminClient();
  // A v4 UUID from the platform CSPRNG. The column default only applies on
  // INSERT, so a rotation has to supply its own.
  const newToken = randomUUID();

  if (target === "salon") {
    const { data: salon } = await supabase
      .from("salons")
      .select("id")
      .eq("is_active", true)
      .order("created_at")
      .limit(1)
      .maybeSingle();

    if (!salon) return { error: "No active salon is configured." };

    const { error } = await supabase
      .from("salons")
      .update({ calendar_token: newToken })
      .eq("id", salon.id);

    if (error) return { error: "We could not rotate that calendar link." };

    await audit({
      actorId: user.id,
      actorEmail: user.email,
      action: "settings.calendar_token_rotated",
      entityType: "salon",
      entityId: salon.id,
      metadata: { scope: "salon" },
    });
  } else {
    if (typeof staffId !== "string" || !staffId) {
      return { error: "Which stylist's calendar?" };
    }

    const { error } = await supabase
      .from("staff")
      .update({ calendar_token: newToken })
      .eq("id", staffId);

    if (error) return { error: "We could not rotate that calendar link." };

    await audit({
      actorId: user.id,
      actorEmail: user.email,
      action: "settings.calendar_token_rotated",
      entityType: "staff",
      entityId: staffId,
      metadata: { scope: "staff" },
    });
  }

  revalidatePath("/studio/settings");
  revalidatePath("/studio/calendar/subscribe");

  return {
    message:
      "Rotated. Every existing subscription to that calendar has stopped working — " +
      "set it up again on each device that needs it.",
  };
}
