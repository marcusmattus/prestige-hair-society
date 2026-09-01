import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";
import { getServices, getStaff } from "@/lib/salon";

export const revalidate = 3600;

/**
 * Public pages only.
 *
 * /book, /account and /studio are deliberately absent: a booking funnel has
 * nothing to offer a search engine, and the other two are private.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [services, staff] = await Promise.all([getServices(), getStaff()]);
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: appUrl, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${appUrl}/services`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${appUrl}/stylists`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${appUrl}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${appUrl}/gallery`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
    { url: `${appUrl}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${appUrl}/policies`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${appUrl}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${appUrl}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  return [
    ...staticRoutes,
    ...services.map((service) => ({
      url: `${appUrl}/services/${service.slug}`,
      lastModified: new Date(service.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...staff.map((person) => ({
      url: `${appUrl}/stylists/${person.slug}`,
      lastModified: new Date(person.updated_at),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
