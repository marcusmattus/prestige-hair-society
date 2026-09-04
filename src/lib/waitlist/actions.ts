"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { getSessionUser } from "@/lib/auth/roles";
import { resolveCustomer } from "@/lib/customers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { waitlistSchema } from "@/lib/validation";

export type WaitlistResult = { error?: string; message?: string };

/**
 * Join the waiting list.
 *
 * Joining reserves nothing. When a slot opens, /api/cron/waitlist offers it by
 * email with a time-limited link; the chair stays bookable by anyone until
 * somebody actually starts checkout. That is deliberate -- holding a slot for
 * an hour on the chance an email gets read costs the salon more than it gains
 * the customer.
 */
export async function joinWaitlistAction(
  _prev: WaitlistResult | null,
  formData: FormData,
): Promise<WaitlistResult> {
  const parsed = waitlistSchema.safeParse({
    serviceId: formData.get("serviceId"),
    staffId: formData.get("staffId") || undefined,
    earliestDate: formData.get("earliestDate"),
    latestDate: formData.get("latestDate"),
    timesOfDay: formData.getAll("timesOfDay"),
    details: {
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: formData.get("email"),
      phone: formData.get("phone"),
    },
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details you entered." };
  }

  const { serviceId, staffId, earliestDate, latestDate, timesOfDay, details } = parsed.data;

  const sessionUser = await getSessionUser();
  const resolved = await resolveCustomer(details, sessionUser?.id ?? null);
  if (!resolved.ok) return { error: resolved.message };

  const admin = createAdminClient();

  // The service determines the salon; never take a salon id from the browser.
  const { data: service } = await admin
    .from("services")
    .select("salon_id")
    .eq("id", serviceId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (!service) {
    return { error: "That service is no longer available." };
  }

  // One active entry per person per service: a second identical request is a
  // double-click, not a stronger preference.
  const { data: existing } = await admin
    .from("waitlist_entries")
    .select("id")
    .eq("profile_id", resolved.profileId)
    .eq("service_id", serviceId)
    .in("status", ["active", "offered"])
    .maybeSingle();

  if (existing) {
    const { error } = await admin
      .from("waitlist_entries")
      .update({
        staff_id: staffId ?? null,
        earliest_date: earliestDate,
        latest_date: latestDate,
        times_of_day: timesOfDay,
        status: "active",
      })
      .eq("id", existing.id);

    if (error) {
      console.error("[waitlist] update failed", error.message);
      return { error: "We could not update your waiting-list entry." };
    }

    return { message: "Your waiting-list preferences have been updated." };
  }

  const { data: entry, error } = await admin
    .from("waitlist_entries")
    .insert({
      salon_id: service.salon_id,
      profile_id: resolved.profileId,
      service_id: serviceId,
      staff_id: staffId ?? null,
      earliest_date: earliestDate,
      latest_date: latestDate,
      times_of_day: timesOfDay,
      status: "active",
    })
    .select("id")
    .single();

  if (error) {
    console.error("[waitlist] insert failed", error.message);
    return { error: "We could not add you to the waiting list. Please try again." };
  }

  await audit({
    actorId: resolved.profileId,
    actorEmail: details.email,
    action: "waitlist.joined",
    entityType: "waitlist_entry",
    entityId: entry.id,
    metadata: { serviceId, earliestDate, latestDate },
  });

  revalidatePath("/account");

  return {
    message: resolved.createdAccount
      ? "You are on the list. We have set up an account so you can manage it — check your email to set a password."
      : "You are on the list. We will email you the moment something opens up.",
  };
}

/** Remove yourself from the waiting list, from /account. */
export async function leaveWaitlistAction(entryId: string): Promise<WaitlistResult> {
  const supabase = await createClient();

  // RLS confines this to the caller's own entries.
  const { error } = await supabase
    .from("waitlist_entries")
    .update({ status: "cancelled" })
    .eq("id", entryId);

  if (error) {
    return { error: "We could not remove that entry." };
  }

  revalidatePath("/account");
  return { message: "Removed from the waiting list." };
}
