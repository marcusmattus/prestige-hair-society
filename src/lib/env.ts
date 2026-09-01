import { z } from "zod";

/**
 * Environment variable validation.
 *
 * Validation is lazy and per-group. A missing Twilio key must not stop the
 * marketing site from building, and `next build` runs without production
 * secrets, so nothing here throws at module load. Each accessor validates the
 * variables it needs, the first time something needs them.
 *
 * NEXT_PUBLIC_* variables are read as literal property accesses so that Next's
 * build-time inlining can see them.
 */

const url = z.string().url();
const nonEmpty = z.string().min(1);

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: url,
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: nonEmpty,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: nonEmpty.optional(),
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
  NEXT_PUBLIC_GA_MEASUREMENT_ID: z.string().optional(),
});

const rawClientEnv = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  NEXT_PUBLIC_GA_MEASUREMENT_ID: process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID,
};

let clientCache: z.infer<typeof clientSchema> | null = null;

export function clientEnv() {
  if (clientCache) return clientCache;
  const parsed = clientSchema.safeParse(rawClientEnv);
  if (!parsed.success) {
    throw new Error(
      `Invalid public environment variables:\n${formatIssues(parsed.error)}`,
    );
  }
  clientCache = parsed.data;
  return clientCache;
}

/** The app's own origin, safe to read anywhere. */
export const appUrl = rawClientEnv.NEXT_PUBLIC_APP_URL;

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: nonEmpty,
  CRON_SECRET: nonEmpty,
});

const stripeSchema = z.object({
  STRIPE_SECRET_KEY: nonEmpty,
  STRIPE_WEBHOOK_SECRET: nonEmpty,
});

const emailSchema = z.object({
  RESEND_API_KEY: nonEmpty,
  EMAIL_FROM: z.string().min(3),
});

const smsSchema = z.object({
  TWILIO_ACCOUNT_SID: nonEmpty,
  TWILIO_AUTH_TOKEN: nonEmpty,
  TWILIO_PHONE_NUMBER: nonEmpty,
});

function lazy<T extends z.ZodTypeAny>(schema: T, label: string) {
  let cache: z.infer<T> | null = null;
  return () => {
    if (cache) return cache;
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      throw new Error(
        `${label} is not configured.\n${formatIssues(parsed.error)}\n` +
          `See .env.example and docs/SETUP.md.`,
      );
    }
    cache = parsed.data;
    return cache;
  };
}

export const serverEnv = lazy(serverSchema, "Server environment");
export const stripeEnv = lazy(stripeSchema, "Stripe");
export const emailEnv = lazy(emailSchema, "Resend email");
export const smsEnv = lazy(smsSchema, "Twilio SMS");

/**
 * Whether an integration is configured, without throwing. Used so the app can
 * degrade honestly -- queueing a message it cannot yet send, rather than
 * pretending it went out.
 */
export const isConfigured = {
  stripe: () => stripeSchema.safeParse(process.env).success,
  email: () => emailSchema.safeParse(process.env).success,
  sms: () => smsSchema.safeParse(process.env).success,
  supabaseAdmin: () => serverSchema.safeParse(process.env).success,
};

function formatIssues(error: z.ZodError): string {
  return error.issues
    .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
}
