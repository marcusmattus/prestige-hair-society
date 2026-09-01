import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { clientEnv, serverEnv } from "@/lib/env";
import type { Database } from "./types";

/**
 * Service-role Supabase client. BYPASSES ROW LEVEL SECURITY.
 *
 * Legitimate uses, and only these:
 *   - the Stripe webhook, which must write payments with no user session
 *   - cron routes (hold sweep, reminders, waiting-list matching)
 *   - guest checkout, where there is no session until the account is created
 *   - the Slick importer
 *
 * Never call this in response to a browser request without first checking, in
 * your own code, that the caller is entitled to what you are about to do. The
 * `server-only` import above means a client component importing this file
 * fails the build rather than shipping the key to the browser.
 */
let cached: ReturnType<typeof createSupabaseClient<Database>> | null = null;

export function createAdminClient() {
  if (cached) return cached;

  const { SUPABASE_SERVICE_ROLE_KEY } = serverEnv();
  const { NEXT_PUBLIC_SUPABASE_URL } = clientEnv();

  cached = createSupabaseClient<Database>(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );

  return cached;
}
