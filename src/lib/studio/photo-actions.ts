"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireManager } from "@/lib/auth/roles";
import { isSafeImageUrl } from "@/lib/images";
import { createAdminClient } from "@/lib/supabase/admin";

export type PhotoResult = { error?: string; message?: string };

/** The Supabase Storage bucket photographs are uploaded to. */
const PHOTO_BUCKET = "site-images";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

const slotSchema = z.string().min(1).max(80).regex(/^[a-z0-9:_-]+$/i, "Bad slot");

const detailsSchema = z.object({
  slot: slotSchema,
  alt: z.string().trim().max(300),
  caption: z.string().trim().max(300).optional(),
  focalX: z.coerce.number().int().min(0).max(100),
  focalY: z.coerce.number().int().min(0).max(100),
});

async function activeSalonId(): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("salons")
    .select("id")
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/**
 * Upload a photograph and fill a slot.
 *
 * Two routes exist deliberately. This one uploads to Supabase Storage and is
 * what the salon uses. The other, `setPhotoUrlAction`, takes a path like
 * `/photos/hero.jpg`, which is how a developer can commit images to the repo
 * without any storage bucket existing — useful before the project is set up,
 * and the only route that works in an environment with no Supabase at all.
 */
export async function uploadPhotoAction(
  _prev: PhotoResult | null,
  formData: FormData,
): Promise<PhotoResult> {
  const user = await requireManager("/studio/photos");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image to upload." };
  }
  if (file.size > MAX_BYTES) {
    return {
      error: `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. Please keep it under 8 MB — resize or export it at a lower quality first.`,
    };
  }
  if (!ALLOWED.includes(file.type)) {
    return { error: "Use a JPEG, PNG, WebP or AVIF image." };
  }

  const parsed = detailsSchema.safeParse({
    slot: formData.get("slot"),
    alt: formData.get("alt") ?? "",
    caption: formData.get("caption") || undefined,
    focalX: formData.get("focalX") || 50,
    focalY: formData.get("focalY") || 50,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details you entered." };
  }

  if (parsed.data.alt.trim() === "") {
    return {
      error:
        "Describe the photograph for people using a screen reader — a sentence is plenty.",
    };
  }

  const salonId = await activeSalonId();
  if (!salonId) return { error: "No active salon is configured." };

  const supabase = createAdminClient();
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  // Slot plus a timestamp: replacing a photograph writes a new object rather
  // than overwriting, so a cached CDN copy of the old one cannot linger.
  const path = `${salonId}/${parsed.data.slot.replace(/:/g, "-")}-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    console.error("[photos] upload failed", uploadError.message);
    if (/bucket/i.test(uploadError.message)) {
      return {
        error:
          `The "${PHOTO_BUCKET}" storage bucket does not exist yet. Create it as a public ` +
          "bucket in Supabase → Storage, or use the link route below instead. See docs/SETUP.md.",
      };
    }
    return { error: "We could not upload that image. Please try again." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);

  const { error } = await supabase.from("site_images").upsert(
    {
      salon_id: salonId,
      slot: parsed.data.slot,
      url: publicUrl,
      alt: parsed.data.alt,
      caption: parsed.data.caption || null,
      focal_x: parsed.data.focalX,
      focal_y: parsed.data.focalY,
      is_active: true,
      uploaded_by: user.id,
    },
    { onConflict: "salon_id,slot" },
  );

  if (error) {
    console.error("[photos] row write failed", error.message);
    return { error: "The image uploaded but we could not attach it. Please try again." };
  }

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "photo.uploaded",
    entityType: "site_image",
    entityId: parsed.data.slot,
    metadata: { bytes: file.size, type: file.type },
  });

  revalidateEverywhere();
  return { message: "Uploaded. It is live on the site now." };
}

/**
 * Point a slot at an image that already exists — a file committed to
 * `public/photos/`, or anything hosted elsewhere over https.
 */
export async function setPhotoUrlAction(
  _prev: PhotoResult | null,
  formData: FormData,
): Promise<PhotoResult> {
  const user = await requireManager("/studio/photos");

  const url = String(formData.get("url") ?? "").trim();
  if (!url) return { error: "Enter a path or address." };
  if (!isSafeImageUrl(url)) {
    return {
      error:
        "Use a path beginning with / (a file in public/) or a full https:// address.",
    };
  }

  const parsed = detailsSchema.safeParse({
    slot: formData.get("slot"),
    alt: formData.get("alt") ?? "",
    caption: formData.get("caption") || undefined,
    focalX: formData.get("focalX") || 50,
    focalY: formData.get("focalY") || 50,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the details you entered." };
  }
  if (parsed.data.alt.trim() === "") {
    return { error: "Describe the photograph for people using a screen reader." };
  }

  const salonId = await activeSalonId();
  if (!salonId) return { error: "No active salon is configured." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("site_images").upsert(
    {
      salon_id: salonId,
      slot: parsed.data.slot,
      url,
      alt: parsed.data.alt,
      caption: parsed.data.caption || null,
      focal_x: parsed.data.focalX,
      focal_y: parsed.data.focalY,
      is_active: true,
      uploaded_by: user.id,
    },
    { onConflict: "salon_id,slot" },
  );

  if (error) {
    console.error("[photos] link failed", error.message);
    return { error: "We could not save that image." };
  }

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "photo.linked",
    entityType: "site_image",
    entityId: parsed.data.slot,
    metadata: { external: !url.startsWith("/") },
  });

  revalidateEverywhere();
  return { message: "Saved. It is live on the site now." };
}

/** Clear a slot, which restores its striped placeholder. */
export async function removePhotoAction(
  _prev: PhotoResult | null,
  formData: FormData,
): Promise<PhotoResult> {
  const user = await requireManager("/studio/photos");

  const parsed = slotSchema.safeParse(formData.get("slot"));
  if (!parsed.success) return { error: "Which image?" };

  const salonId = await activeSalonId();
  if (!salonId) return { error: "No active salon is configured." };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("site_images")
    .delete()
    .eq("salon_id", salonId)
    .eq("slot", parsed.data);

  if (error) return { error: "We could not remove that image." };

  // The stored object is left in place: removing a slot is usually a
  // reshuffle, and an orphaned file costs pennies where a deleted one that
  // was still wanted costs a reshoot.
  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "photo.removed",
    entityType: "site_image",
    entityId: parsed.data,
    metadata: {},
  });

  revalidateEverywhere();
  return { message: "Removed. That slot shows its placeholder again." };
}

/** Every page that renders photography. */
function revalidateEverywhere() {
  for (const path of ["/", "/about", "/gallery", "/stylists", "/studio/photos"]) {
    revalidatePath(path);
  }
  revalidatePath("/stylists/[slug]", "page");
}
