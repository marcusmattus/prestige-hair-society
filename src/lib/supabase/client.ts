"use client";

import { createBrowserClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env";
import type { Database } from "./types";

/**
 * Browser Supabase client, holding the anon key only.
 *
 * Every query it makes is subject to RLS, so this client can be handed
 * anything -- it cannot read a row the signed-in user is not entitled to.
 */
export function createClient() {
  const env = clientEnv();
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
