"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { updatePreferencesSchema, updateProfileSchema } from "@/lib/validation";

export type ActionResult = { error?: string; message?: string };

/**
 * Profile and preference updates.
 *
 * The write goes through the customer's own session, so RLS confines it to
 * their row and the guard trigger in 0012 stops them touching the salon's
 * counters. Nothing here can widen what a customer may change.
 */
export async function updateProfileAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/account/profile");

  const parsed = updateProfileSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    phone: formData.get("phone"),
    birthday: formData.get("birthday"),
    hairGoals: formData.get("hairGoals"),
    accessibilityRequirements: formData.get("accessibilityRequirements"),
    allergies: formData.get("allergies"),
    favouriteStaffId: formData.get("favouriteStaffId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details you entered." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      phone: parsed.data.phone,
      birthday: parsed.data.birthday || null,
      hair_goals: parsed.data.hairGoals || null,
      accessibility_requirements: parsed.data.accessibilityRequirements || null,
      allergies: parsed.data.allergies || null,
      favourite_staff_id: parsed.data.favouriteStaffId || null,
    })
    .eq("id", user.id);

  if (error) {
    console.error("[profile] update failed", error.message);
    return { error: "We could not save those changes. Please try again." };
  }

  // The values themselves are personal (allergies especially), so the audit
  // entry records that a change happened, not what it said.
  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "profile.updated",
    entityType: "profile",
    entityId: user.id,
    metadata: { fields: Object.keys(parsed.data) },
  });

  revalidatePath("/account/profile");
  return { message: "Your details have been saved." };
}

export async function updatePreferencesAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser("/account/preferences");

  const parsed = updatePreferencesSchema.safeParse({
    marketingEmail: formData.get("marketingEmail") === "on",
    marketingSms: formData.get("marketingSms") === "on",
    reminderEmail: formData.get("reminderEmail") === "on",
    reminderSms: formData.get("reminderSms") === "on",
  });

  if (!parsed.success) return { error: "We could not save those preferences." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      marketing_email: parsed.data.marketingEmail,
      marketing_sms: parsed.data.marketingSms,
      reminder_email: parsed.data.reminderEmail,
      reminder_sms: parsed.data.reminderSms,
    })
    .eq("id", user.id);

  if (error) return { error: "We could not save those preferences. Please try again." };

  // Consent changes are evidence and must be provable after the fact, so each
  // one is recorded as its own row rather than only flipping the flag.
  await supabase.from("consent_records").insert([
    {
      profile_id: user.id,
      kind: "marketing_email" as const,
      granted: parsed.data.marketingEmail,
      source: "web" as const,
    },
    {
      profile_id: user.id,
      kind: "marketing_sms" as const,
      granted: parsed.data.marketingSms,
      source: "web" as const,
    },
  ]);

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "preferences.updated",
    entityType: "profile",
    entityId: user.id,
    metadata: parsed.data,
  });

  revalidatePath("/account/preferences");
  return { message: "Your preferences have been saved." };
}
