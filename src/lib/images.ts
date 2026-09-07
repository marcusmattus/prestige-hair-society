import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Photography for the public site.
 *
 * Every image slot has a stable key. A slot with no row keeps the striped
 * placeholder it has today, so the salon can add photographs one at a time and
 * the site is never half-broken while they do.
 */

export type SiteImage = {
  slot: string;
  url: string;
  alt: string;
  focalX: number;
  focalY: number;
  caption: string | null;
};

/**
 * The fixed slots. Two more are parameterised:
 *   `stylist:<slug>`  a stylist's portrait
 *   `gallery:<n>`     salon photography on /gallery, n from 1
 */
export const SLOTS = {
  hero: {
    key: "hero",
    label: "Homepage hero",
    hint: "The arched portrait beside the headline. Portrait orientation, at least 900×1200.",
  },
  salonInterior: {
    key: "salon-interior",
    label: "Salon interior",
    hint: "Shown on the homepage and on Our Salon. Portrait or square, at least 900×1100.",
  },
  aboutInterior: {
    key: "about-interior",
    label: "Our Salon page",
    hint: "Falls back to the salon interior image when unset.",
  },
} as const;

export const stylistSlot = (slug: string) => `stylist:${slug}`;
export const gallerySlot = (index: number) => `gallery:${index}`;

/** How many gallery slots the Studio page offers. */
export const GALLERY_SLOTS = 8;

const EMPTY = new Map<string, SiteImage>();

/**
 * Every active image, keyed by slot.
 *
 * One query per render pass rather than one per slot: a page shows up to a
 * dozen, and `cache()` dedupes across the layout and the page. Failures return
 * an empty map, so a database problem degrades to placeholders rather than to
 * an error page.
 */
export const getSiteImages = cache(async (): Promise<Map<string, SiteImage>> => {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("site_images")
      .select("slot, url, alt, focal_x, focal_y, caption")
      .eq("is_active", true)
      .order("display_order");

    if (error || !data) return EMPTY;

    return new Map(
      data.map((row) => [
        row.slot,
        {
          slot: row.slot,
          url: row.url,
          alt: row.alt,
          focalX: row.focal_x,
          focalY: row.focal_y,
          caption: row.caption,
        },
      ]),
    );
  } catch {
    return EMPTY;
  }
});

/** One slot, or null when it has no photograph yet. */
export async function getSiteImage(slot: string): Promise<SiteImage | null> {
  return (await getSiteImages()).get(slot) ?? null;
}

/**
 * `object-position` for a focal point.
 *
 * A hero crop that cuts off someone's head is the usual failure of a fixed
 * centre crop, so each image carries its own.
 */
export function focalPosition(image: Pick<SiteImage, "focalX" | "focalY">): string {
  return `${image.focalX}% ${image.focalY}%`;
}

/**
 * Whether a URL is safe to render.
 *
 * Site-relative paths and https are allowed; anything else — javascript:,
 * data:, a protocol-relative URL — is refused. The field is manager-only, but
 * a stored value that ends up in `src` deserves a check regardless.
 */
export function isSafeImageUrl(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed.startsWith("//")) return false;
  if (trimmed.startsWith("/")) return true;
  try {
    return new URL(trimmed).protocol === "https:";
  } catch {
    return false;
  }
}
