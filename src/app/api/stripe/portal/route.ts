import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSessionUser } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Open the Stripe billing portal for a membership the signed-in user owns
 * (subscriptions only — pay-in-full purchases have no portal).
 */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/sign-in?next=/account", request.url), { status: 303 });

  const id = new URL(request.url).searchParams.get("m");
  if (!id) return NextResponse.redirect(new URL("/account", request.url), { status: 303 });

  const supabase = await createClient();
  // RLS restricts this to the user's own memberships.
  const { data: membership } = await supabase
    .from("memberships")
    .select("stripe_customer_id")
    .eq("id", id)
    .maybeSingle();

  if (!membership?.stripe_customer_id) {
    return NextResponse.redirect(new URL("/account", request.url), { status: 303 });
  }

  try {
    const portal = await getStripe().billingPortal.sessions.create({
      customer: membership.stripe_customer_id,
      return_url: new URL("/account", request.url).toString(),
    });
    return NextResponse.redirect(portal.url, { status: 303 });
  } catch (cause) {
    console.error("portal_error", cause);
    return NextResponse.redirect(new URL("/account", request.url), { status: 303 });
  }
}
