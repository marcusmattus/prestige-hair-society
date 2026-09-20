import Link from "next/link";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { SiteHeader } from "@/components/SiteHeader";
import { calendlyConsultationLink } from "@/lib/calendly";
import { poundsLabel, TIER_LABEL, type Tier } from "@/lib/memberships";

export default async function MembershipSuccess({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  let session: Stripe.Checkout.Session | undefined;
  if (session_id) {
    try {
      session = await getStripe().checkout.sessions.retrieve(session_id, { expand: ["payment_intent", "subscription"] });
    } catch {}
  }
  const m = session?.metadata || {};
  const paid = session?.payment_status === "paid" || Boolean(session?.subscription);
  const isMonthly = m.payment === "monthly";
  const visits = Number(m.visits || 0);
  const tier = (m.tier as Tier) || "short";
  const name = `${m.first_name || ""} ${m.last_name || ""}`.trim();
  const consultationHref = calendlyConsultationLink({ name, email: m.email });

  const planLabel = isMonthly && m.months
    ? `${poundsLabel(Number(m.amount_now || 0))}/month × ${m.months}`
    : `${poundsLabel(Number(m.total || m.amount_now || 0))} paid in full`;

  return (
    <>
      <div className="notice">Prestige Hair Society &nbsp; ◆ &nbsp; Membership confirmed</div>
      <SiteHeader />
      <main className="success-card">
        <span className="eyebrow">Prestige Memberships &amp; Hair Programmes</span>
        <h1 style={{ fontSize: 46, lineHeight: 1, margin: "16px 0" }}>
          {paid ? "Welcome to your programme." : "We’re confirming your membership."}
        </h1>
        <p className="muted" style={{ color: "#687067", lineHeight: 1.7 }}>
          {paid
            ? "Your membership is active. Book your first appointment now — included visits are prepaid, so you won’t be charged again for a service your programme covers."
            : "Keep your reference. We’ll email you the moment your payment status updates."}
        </p>

        <div className="status-box">
          <strong>{m.booking_reference || "Membership pending"}</strong><br />
          {m.programme_name}{m.category ? ` · ${m.category}` : ""}<br />
          Hair tier: {TIER_LABEL[tier] || tier}<br />
          Payment: {planLabel}
        </div>

        {/* Membership account snapshot */}
        <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 22, margin: "8px 0 24px" }}>
          <span className="eyebrow">Your membership</span>
          <dl style={{ margin: "12px 0 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 14 }}>
              <dt style={{ color: "#687067" }}>Active programme</dt><dd style={{ margin: 0 }}>{m.programme_name}</dd>
            </div>
            {visits > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 14 }}>
                  <dt style={{ color: "#687067" }}>Appointments</dt><dd style={{ margin: 0 }}>0 / {visits} completed</dd>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid var(--line)", fontSize: 14 }}>
                  <dt style={{ color: "#687067" }}>Remaining visits</dt><dd style={{ margin: 0 }}>{visits}</dd>
                </div>
              </>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", fontSize: 14 }}>
              <dt style={{ color: "#687067" }}>Payment plan</dt><dd style={{ margin: 0 }}>{planLabel}</dd>
            </div>
          </dl>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <Link className="button" href="/#book">Book Visit 1</Link>
          <Link className="button alt" href="/account">My membership</Link>
          <a className="button alt" href={consultationHref} target="_blank" rel="noopener noreferrer">Book a consultation</a>
        </div>
        <p className="secure" style={{ marginTop: 14 }}><span>◆</span><span>Track your programme, appointments and payment plan any time at your membership account — sign in with {session?.customer_details?.email || m.email || "this email"}.</span></p>
        <p className="secure" style={{ marginTop: 18 }}>
          <span>◆</span>
          <span>A confirmation has been sent to {session?.customer_details?.email || m.email || "your email"}. When you book Visit 1, tell us it’s part of {m.programme_name || "your membership"} so the included service isn’t charged again.</span>
        </p>
      </main>
    </>
  );
}
