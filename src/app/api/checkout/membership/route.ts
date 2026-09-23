import { NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { getStripe } from "@/lib/stripe";
import {
  findProgramme,
  getTier,
  chargeableAmount,
  pence,
  poundsLabel,
  TIERS,
} from "@/lib/memberships";

export const runtime = "nodejs";

const schema = z.object({
  bookingId: z.string().min(8).max(100),
  programme: z.string().min(2),
  tier: z.enum(TIERS as [string, ...string[]]),
  payment: z.enum(["full", "monthly"]).default("full"),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.email(),
  phone: z.string().trim().min(7).max(30),
  notes: z.string().max(1000).default(""),
  updates: z.boolean().default(true),
  agreed: z.literal(true),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const programme = findProgramme(input.programme);
    if (!programme) return NextResponse.json({ error: "Please choose a valid programme" }, { status: 400 });

    const tier = input.tier as (typeof TIERS)[number];
    const pricing = getTier(programme, tier);
    // Guard: monthly only where the tier actually offers a plan.
    const payment = input.payment === "monthly" && pricing.monthly ? "monthly" : "full";
    const amountNow = chargeableAmount(pricing, payment);
    const reference = `PHS-M-${input.bookingId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
    const origin = new URL(request.url).origin;
    const stripe = getStripe();

    const label = `${programme.eyebrow} — ${programme.name}`;
    const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
    const metadata: Record<string, string> = {
      type: "membership",
      booking_reference: reference,
      booking_id: input.bookingId,
      programme_id: programme.id,
      programme_slug: programme.slug,
      programme_name: label,
      category: programme.category,
      tier,
      payment,
      amount_now: String(amountNow),
      total: String(pricing.upfront),
      months: pricing.monthly ? String(pricing.monthly.months) : "",
      visits: programme.visits ? String(programme.visits) : "",
      duration: programme.durationLabel,
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      phone: input.phone,
      notes: input.notes,
      email_updates: String(input.updates),
    };

    const base = {
      customer_email: input.email,
      success_url: `${origin}/memberships/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/memberships#choose`,
      metadata,
    };

    let session: Stripe.Checkout.Session;
    if (payment === "monthly" && pricing.monthly) {
      session = await stripe.checkout.sessions.create(
        {
          ...base,
          mode: "subscription",
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "gbp",
                unit_amount: pence(pricing.monthly.amount),
                recurring: { interval: "month" },
                product_data: {
                  name: `${label} · ${tierLabel} hair`,
                  description: `${programme.durationLabel} · ${pricing.monthly.months} monthly payments of ${poundsLabel(pricing.monthly.amount)}`,
                },
              },
            },
          ],
          // Stripe can't cap a subscription's length at creation. The instalment
          // count travels in metadata; the billing webhook (src/lib/stripe/billing.ts)
          // cancels the subscription after the Nth paid invoice, so the customer
          // is charged exactly this many times.
          subscription_data: {
            description: `${reference} · ${label} (${tierLabel})`,
            metadata: { ...metadata, installments: String(pricing.monthly.months) },
          },
        },
        { idempotencyKey: `membership-${input.bookingId}-monthly` },
      );
    } else {
      session = await stripe.checkout.sessions.create(
        {
          ...base,
          mode: "payment",
          payment_method_types: ["card"],
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "gbp",
                unit_amount: pence(pricing.upfront),
                product_data: {
                  name: `${label} · ${tierLabel} hair`,
                  description: `${programme.durationLabel}${programme.visits ? ` · ${programme.visits} appointments` : ""} · paid in full`,
                },
              },
            },
          ],
          payment_intent_data: {
            description: `${reference} · ${label} (${tierLabel})`,
            metadata,
          },
          expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
        },
        { idempotencyKey: `membership-${input.bookingId}-full` },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (cause) {
    console.error("membership_checkout_error", cause);
    const message =
      cause instanceof z.ZodError
        ? "Please check all details"
        : cause instanceof Error && cause.message.includes("configured")
          ? "Secure payments are being connected. Please try again shortly."
          : "Unable to start secure checkout";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
