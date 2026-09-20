import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { MembershipCheckout } from "@/components/memberships/MembershipCheckout";
import { TIERS, type PaymentOption, type Tier } from "@/lib/memberships";

export const metadata: Metadata = {
  title: "Join a membership · Prestige Hair Society",
};

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ programme?: string; tier?: string; payment?: string }>;
}) {
  const { programme = "", tier: rawTier, payment: rawPayment } = await searchParams;
  const tier: Tier = (TIERS as string[]).includes(rawTier ?? "") ? (rawTier as Tier) : "short";
  const payment: PaymentOption = rawPayment === "monthly" ? "monthly" : "full";

  return (
    <>
      <div className="notice">Prestige Hair Society &nbsp; ◆ &nbsp; Programme → Hair tier → Payment → Appointment → Checkout</div>
      <SiteHeader />
      <main className="shell">
        <MembershipCheckout slug={programme} tier={tier} payment={payment} />
      </main>
    </>
  );
}
