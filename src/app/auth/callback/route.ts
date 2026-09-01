import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth and email-link callback.
 *
 * Exchanges the one-time code for a session, then sends the user on. The
 * destination is validated as a same-site path: an open redirect here would
 * let a phishing link land a freshly authenticated user on someone else's page.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/account";
  const origin = url.origin;

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=link_expired`);
  }

  const destination = next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  return NextResponse.redirect(`${origin}${destination}`);
}
