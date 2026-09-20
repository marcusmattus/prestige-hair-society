import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { MembershipBookingForm } from "@/components/memberships/MembershipBookingForm";
import { requireUser } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { TIER_LABEL, type Tier } from "@/lib/memberships";
import { remainingVisits } from "@/lib/memberships/visits";

export const metadata: Metadata = {
  title: "Book a visit · Prestige Hair Society",
  robots: { index: false },
};

export default async function BookVisitPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; reschedule?: string }>;
}) {
  await requireUser("/account/book");
  const { m, reschedule } = await searchParams;
  const isReschedule = reschedule === "1";

  const supabase = await createClient();
  const { data: membership } = m
    ? await supabase.from("memberships").select("*").eq("id", m).maybeSingle()
    : { data: null };

  if (!membership) redirect("/account");
  const remaining = remainingVisits(membership);

  return (
    <>
      <div className="notice">Prestige Hair Society &nbsp; ◆ &nbsp; Membership visit</div>
      <SiteHeader />
      <main className="shell" style={{ padding: "48px 0 110px" }}>
        <Link href="/account" style={{ fontSize: 13, color: "#687067", textDecoration: "none" }}>← Back to my account</Link>
        <span className="eyebrow" style={{ display: "block", marginTop: 18 }}>{isReschedule ? "Reschedule a visit" : "Book your next visit"}</span>
        <h1 style={{ fontSize: "clamp(32px,4.5vw,48px)", lineHeight: 1, margin: "10px 0 6px" }}>{membership.programme_name}</h1>
        <p className="prog-summary" style={{ maxWidth: 560 }}>
          {TIER_LABEL[membership.tier as Tier] || membership.tier} hair · {remaining} of {membership.included_visits || "—"} visits remaining.
          {isReschedule ? " Choose a new time for your booked visit." : " Included visits are prepaid — there’s nothing to pay."}
        </p>
        <div style={{ marginTop: 28 }}>
          <MembershipBookingForm membershipId={membership.id} reschedule={isReschedule} />
        </div>
      </main>
    </>
  );
}
