import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { clientEnv } from "@/lib/env";

/**
 * Refreshes the Supabase auth session on every request and writes the rotated
 * cookies onto the response, so Server Components always see a valid session.
 * If the public Supabase env isn't configured, it degrades to a plain pass.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  let env: ReturnType<typeof clientEnv>;
  try {
    env = clientEnv();
  } catch {
    return response; // Supabase not configured — don't break the marketing site.
  }

  const supabase = createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Touch the session so an expiring token is refreshed into the cookies.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Run on everything except static assets and image files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)"],
};
