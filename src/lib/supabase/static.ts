import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { clientEnv } from "@/lib/env";
import type { Database } from "./types";

/**
 * Session-less anon client for build-time data fetching.
 *
 * `generateStaticParams` and other build-time hooks run without an HTTP
 * request, so the cookie-based server client cannot be used there. This one
 * carries the anon key and no session, which is exactly right for reading the
 * public catalogue: RLS still applies, and it sees only what an anonymous
 * visitor would.
 */
let cached: ReturnType<typeof createSupabaseClient<Database>> | null = null;

export function createStaticClient() {
  if (cached) return cached;
  const env = clientEnv();
  cached = createSupabaseClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  return cached;
}

/** Slugs for the routes that are prerendered. Empty if unreachable. */
export async function getPublicSlugs(table: "services" | "staff"): Promise<string[]> {
  try {
    const supabase = createStaticClient();
    const { data } = await supabase
      .from(table)
      .select("slug")
      .eq("is_active", true)
      .is("deleted_at", null);
    return (data ?? []).map((row) => row.slug);
  } catch {
    // A build without database access still succeeds; the pages render on
    // demand instead of being prerendered.
    return [];
  }
}
