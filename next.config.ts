import type { NextConfig } from "next";

/**
 * A Content Security Policy tight enough to be worth having.
 *
 * Stripe needs its own script, frame and connect origins -- the Payment
 * Element is a cross-origin iframe, which is exactly why card details never
 * touch this origin. Supabase needs connect-src for its REST and realtime
 * endpoints, and `'unsafe-inline'` is required for styles because Next injects
 * them; scripts do not get the same latitude.
 */
const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWs = supabaseOrigin.replace(/^https/, "wss");
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "";

const csp = [
  `default-src 'self'`,
  // 'unsafe-eval' is only needed in development for React Refresh.
  `script-src 'self' 'unsafe-inline' ${
    process.env.NODE_ENV === "development" ? "'unsafe-eval'" : ""
  } https://js.stripe.com https://www.googletagmanager.com ${posthogHost}`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src 'self' https://fonts.gstatic.com data:`,
  `img-src 'self' data: blob: https://*.supabase.co`,
  `connect-src 'self' ${supabaseOrigin} ${supabaseWs} https://api.stripe.com https://www.google-analytics.com ${posthogHost}`,
  `frame-src https://js.stripe.com https://hooks.stripe.com`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `object-src 'none'`,
  `upgrade-insecure-requests`,
]
  .filter(Boolean)
  .join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,

  images: {
    // Supabase Storage is the only remote image source.
    remotePatterns: supabaseOrigin
      ? [{ protocol: "https", hostname: new URL(supabaseOrigin).hostname }]
      : [],
    formats: ["image/avif", "image/webp"],
  },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
