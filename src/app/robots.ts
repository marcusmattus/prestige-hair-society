import type { MetadataRoute } from "next";
import { appUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private areas, the booking funnel, and anything that would waste
        // crawl budget on pages a search engine cannot use.
        disallow: [
          "/account",
          "/account/",
          "/studio",
          "/studio/",
          "/api/",
          "/book",
          "/booking/",
          "/auth/",
          "/sign-in",
          "/sign-up",
          "/forgot-password",
        ],
      },
    ],
    sitemap: `${appUrl}/sitemap.xml`,
    host: appUrl,
  };
}
