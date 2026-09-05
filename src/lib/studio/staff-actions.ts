"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireManager } from "@/lib/auth/roles";
import { slugify } from "@/lib/import/csv";
import { createAdminClient } from "@/lib/supabase/admin";

export type StaffResult = { error?: string; message?: string };

const staffSchema = z.object({
  id: z.string().uuid().optional(),
  displayName: z.string().trim().min(2, "Enter a name"),
  title: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(2000).optional(),
  specialties: z.string().max(400).optional(),
  isBookable: z.boolean(),
  isActive: z.boolean(),
  displayOrder: z.coerce.number().int().min(0).max(999),
});

/**
 * Create or update a stylist.
 *
 * The slug is derived once, on creation, and never changes afterwards: it is
 * in the public URL of their profile page, and silently moving that would
 * break any link anyone has shared.
 */
export async function saveStaffAction(
  _prev: StaffResult | null,
  formData: FormData,
): Promise<StaffResult> {
  const user = await requireManager("/studio/stylists");

  const parsed = staffSchema.safeParse({
    id: formData.get("id") || undefined,
    displayName: formData.get("displayName"),
    title: formData.get("title") || undefined,
    bio: formData.get("bio") || undefined,
    specialties: formData.get("specialties") || undefined,
    isBookable: formData.get("isBookable") === "on",
    isActive: formData.get("isActive") === "on",
    displayOrder: formData.get("displayOrder") || 0,
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

  const specialties = (parsed.data.specialties ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const fields = {
    display_name: parsed.data.displayName,
    title: parsed.data.title || null,
    bio: parsed.data.bio || null,
    specialties,
    is_bookable: parsed.data.isBookable,
    is_active: parsed.data.isActive,
    display_order: parsed.data.displayOrder,
  };

  if (parsed.data.id) {
    const { error } = await supabase
      .from("staff")
      .update(fields)
      .eq("id", parsed.data.id);

    if (error) {
      console.error("[staff] update failed", error.message);
      return { error: "We could not save those changes." };
    }

    await audit({
      actorId: user.id,
      actorEmail: user.email,
      action: "staff.updated",
      entityType: "staff",
      entityId: parsed.data.id,
      metadata: { isActive: parsed.data.isActive, isBookable: parsed.data.isBookable },
    });

    revalidatePath("/studio/stylists");
    revalidatePath("/stylists");
    return { message: "Saved." };
  }

  const slug = slugify(parsed.data.displayName);
  if (!slug) return { error: "That name cannot be turned into a web address." };

  const { data: created, error } = await supabase
    .from("staff")
    .insert({ salon_id: salon.id, slug, ...fields })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "A stylist with that name already exists." };
    }
    console.error("[staff] insert failed", error.message);
    return { error: "We could not add that stylist." };
  }

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "staff.created",
    entityType: "staff",
    entityId: created.id,
    metadata: { slug },
  });

  revalidatePath("/studio/stylists");
  revalidatePath("/stylists");
  return {
    message:
      "Added. Set their working week in Availability and tick the services they offer — " +
      "a stylist with no services and no roster is not bookable.",
  };
}

/**
 * Which services a stylist can deliver.
 *
 * Removing an eligibility does not touch appointments already booked under it:
 * the booking holds its own snapshot, and cancelling somebody's appointment
 * because a tickbox changed would be indefensible.
 */
export async function saveStaffServicesAction(
  _prev: StaffResult | null,
  formData: FormData,
): Promise<StaffResult> {
  const user = await requireManager("/studio/stylists");

  const staffId = String(formData.get("staffId") ?? "");
  if (!staffId) return { error: "Which stylist?" };

  const selected = formData.getAll("serviceIds").map(String).filter(Boolean);
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("staff_services")
    .select("service_id")
    .eq("staff_id", staffId);

  const before = new Set((existing ?? []).map((r) => r.service_id));
  const after = new Set(selected);

  const toAdd = selected.filter((id) => !before.has(id));
  const toRemove = [...before].filter((id) => !after.has(id));

  if (toRemove.length > 0) {
    const { error } = await supabase
      .from("staff_services")
      .delete()
      .eq("staff_id", staffId)
      .in("service_id", toRemove);
    if (error) return { error: "We could not update those services." };
  }

  if (toAdd.length > 0) {
    const { error } = await supabase
      .from("staff_services")
      .insert(toAdd.map((serviceId) => ({ staff_id: staffId, service_id: serviceId })));
    if (error) return { error: "We could not update those services." };
  }

  // A service nobody can deliver disappears from the booking page without
  // warning, so say which.
  const { data: orphaned } = await supabase
    .from("services")
    .select("name")
    .is("deleted_at", null)
    .eq("is_active", true)
    .not("id", "in", `(${await eligibleServiceIds(supabase)})`);

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "staff.services_updated",
    entityType: "staff",
    entityId: staffId,
    metadata: { added: toAdd.length, removed: toRemove.length },
  });

  revalidatePath("/studio/stylists");
  revalidatePath("/book");

  const orphanNames = (orphaned ?? []).map((s) => s.name);
  return {
    message:
      orphanNames.length > 0
        ? `Saved. No stylist now offers: ${orphanNames.slice(0, 5).join(", ")}${orphanNames.length > 5 ? ` and ${orphanNames.length - 5} more` : ""} — those are not bookable.`
        : `Saved. ${after.size} service${after.size === 1 ? "" : "s"} offered.`,
  };
}

/** Service ids with at least one eligible stylist, as a SQL IN list. */
async function eligibleServiceIds(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<string> {
  const { data } = await supabase.from("staff_services").select("service_id");
  const ids = [...new Set((data ?? []).map((r) => r.service_id))];
  // A literal that matches nothing, rather than empty parentheses, which is a
  // syntax error in PostgREST's `not.in` filter.
  return ids.length > 0 ? ids.join(",") : "00000000-0000-0000-0000-000000000000";
}

/**
 * Retire a stylist.
 *
 * A soft delete: their name is on past bookings and those must stay readable,
 * so the row is kept and simply stops being bookable. Refuses while they still
 * have appointments ahead, because those need moving to somebody first.
 */
export async function retireStaffAction(
  _prev: StaffResult | null,
  formData: FormData,
): Promise<StaffResult> {
  const user = await requireManager("/studio/stylists");
  const staffId = String(formData.get("staffId") ?? "");
  if (!staffId) return { error: "Which stylist?" };

  const supabase = createAdminClient();

  const { data: upcoming } = await supabase
    .from("bookings")
    .select("reference")
    .eq("staff_id", staffId)
    .in("status", ["pending_payment", "confirmed"])
    .gte("starts_at", new Date().toISOString())
    .limit(5);

  if (upcoming && upcoming.length > 0) {
    return {
      error:
        `They still have appointments booked (${upcoming.map((b) => b.reference).join(", ")}). ` +
        "Move or cancel those first — retiring would leave customers with an appointment and nobody to keep it.",
    };
  }

  const { error } = await supabase
    .from("staff")
    .update({ is_active: false, is_bookable: false, deleted_at: new Date().toISOString() })
    .eq("id", staffId);

  if (error) return { error: "We could not retire that stylist." };

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "staff.retired",
    entityType: "staff",
    entityId: staffId,
    metadata: {},
  });

  revalidatePath("/studio/stylists");
  revalidatePath("/stylists");
  return { message: "Retired. Their past appointments and notes are untouched." };
}
