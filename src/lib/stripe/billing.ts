import "server-only";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Billing lifecycle for membership subscriptions.
 *
 * Instalment plans (e.g. £105 × 3) are created as ordinary Checkout
 * subscriptions — Stripe can't cap a subscription's length at creation. We
 * enforce the fixed term here: after the Nth successful payment we cancel the
 * subscription, so the customer is charged exactly N times and never more.
 *
 * These handlers also keep `memberships.status` in step with Stripe
 * (active / past_due / completed / cancelled). Everything is idempotent, so
 * a replayed webhook is safe.
 */

type Ref = string | { id: string } | null | undefined;
const idOf = (v: Ref): string | null => (typeof v === "string" ? v : v?.id ?? null);

/** Recent API versions moved the subscription off the invoice's top level. */
type InvoiceLike = {
  subscription?: Ref;
  parent?: { subscription_details?: { subscription?: Ref } | null } | null;
  lines?: { data?: Array<{ subscription?: Ref }> } | null;
};

export function subscriptionIdFromInvoice(invoice: Stripe.Invoice): string | null {
  const i = invoice as unknown as InvoiceLike;
  const fromLine = i.lines?.data?.map((l) => idOf(l.subscription)).find(Boolean) ?? null;
  return idOf(i.parent?.subscription_details?.subscription) ?? idOf(i.subscription) ?? fromLine;
}

async function setMembershipStatus(
  subscriptionId: string,
  status: "active" | "past_due" | "completed" | "cancelled",
  { unless = [] as string[] } = {},
) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("memberships")
    .select("id, status")
    .eq("stripe_subscription_id", subscriptionId)
    .maybeSingle();
  if (!data || unless.includes(data.status)) return;
  await admin.from("memberships").update({ status }).eq("id", data.id);
}

/** The number of instalments the plan is capped at, from subscription metadata. */
function installmentsOf(subscription: Stripe.Subscription): number {
  const meta = subscription.metadata || {};
  return Number(meta.installments || meta.months || 0);
}

/**
 * On each paid invoice: mark the membership active, and once the agreed number
 * of instalments has been collected, cancel the subscription so no further
 * payments are taken.
 */
export async function onInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = subscriptionIdFromInvoice(invoice);
  if (!subscriptionId) return;

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  if (subscription.metadata?.type !== "membership") return; // not one of ours

  const cap = installmentsOf(subscription);
  await setMembershipStatus(subscriptionId, "active", { unless: ["completed"] });
  if (cap <= 0) return; // open-ended plan; nothing to cap

  // Count what has actually been collected. Counting (rather than a local
  // tally) is naturally idempotent under webhook retries.
  const paid = await stripe.invoices.list({ subscription: subscriptionId, status: "paid", limit: 100 });
  if (paid.data.length < cap) return;

  const alreadyEnded = ["canceled", "incomplete_expired"].includes(subscription.status);
  if (!alreadyEnded) await stripe.subscriptions.cancel(subscriptionId);
  await setMembershipStatus(subscriptionId, "completed");
}

/** A failed instalment payment flags the membership as past due (dunning). */
export async function onInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = subscriptionIdFromInvoice(invoice);
  if (subscriptionId) await setMembershipStatus(subscriptionId, "past_due", { unless: ["completed"] });
}

/** Subscription ended: mark cancelled unless it completed its full term. */
export async function onSubscriptionDeleted(subscription: Stripe.Subscription) {
  await setMembershipStatus(subscription.id, "cancelled", { unless: ["completed"] });
}

/** Keep status in step with mid-life subscription changes. */
export async function onSubscriptionUpdated(subscription: Stripe.Subscription) {
  const map: Record<string, "active" | "past_due" | "cancelled"> = {
    active: "active",
    trialing: "active",
    past_due: "past_due",
    unpaid: "past_due",
    canceled: "cancelled",
  };
  const status = map[subscription.status];
  if (status) await setMembershipStatus(subscription.id, status, { unless: ["completed"] });
}
