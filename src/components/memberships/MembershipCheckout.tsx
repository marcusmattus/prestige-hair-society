"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  type PaymentOption,
  type Tier,
  TIER_LABEL,
  findProgramme,
  getTier,
  poundsLabel,
} from "@/lib/memberships";

type Details = { firstName: string; lastName: string; email: string; phone: string; notes: string; updates: boolean; agreed: boolean };

export function MembershipCheckout({ slug, tier, payment }: { slug: string; tier: Tier; payment: PaymentOption }) {
  const programme = findProgramme(slug);
  const [details, setDetails] = useState<Details>({ firstName: "", lastName: "", email: "", phone: "", notes: "", updates: true, agreed: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bookingId = useRef("");
  useEffect(() => {
    if (!bookingId.current) bookingId.current = globalThis.crypto?.randomUUID?.() || `phs-${Date.now()}`;
  }, []);

  if (!programme) {
    return (
      <section className="shell" style={{ padding: "80px 0" }}>
        <h1 style={{ fontSize: 40 }}>Programme not found</h1>
        <p className="prog-summary">That programme link is not valid.</p>
        <Link className="button" href="/memberships" style={{ marginTop: 20 }}>Back to memberships</Link>
      </section>
    );
  }

  const pricing = getTier(programme, tier);
  const activePayment: PaymentOption = payment === "monthly" && pricing.monthly ? "monthly" : "full";
  const amountNow = activePayment === "monthly" && pricing.monthly ? pricing.monthly.amount : pricing.upfront;

  const ready =
    details.firstName.trim() && details.lastName.trim() && /\S+@\S+\.\S+/.test(details.email) && details.phone.trim() && details.agreed;
  const setDetail = <K extends keyof Details>(key: K, value: Details[K]) => setDetails((c) => ({ ...c, [key]: value }));

  async function checkout() {
    if (!ready) return;
    if (!bookingId.current) bookingId.current = globalThis.crypto?.randomUUID?.() ?? "";
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/checkout/membership", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bookingId: bookingId.current, programme: programme!.slug, tier, payment: activePayment, ...details }),
      });
      const data = await response.json();
      if (!response.ok || !data.url) throw new Error(data.error || "Unable to open secure checkout");
      window.location.assign(data.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to continue");
      setLoading(false);
    }
  }

  const payLabel =
    activePayment === "monthly" && pricing.monthly
      ? `Start plan · ${poundsLabel(pricing.monthly.amount)}/mo`
      : `Pay ${poundsLabel(pricing.upfront)} now`;

  return (
    <div className="join-wrap">
      <div className="join-form">
        <span className="eyebrow">Your details</span>
        <h1 style={{ fontSize: 34, margin: "8px 0 4px" }}>Join {programme.eyebrow} — {programme.name}</h1>
        <p className="prog-summary" style={{ marginBottom: 18 }}>
          We use these details for your receipt, confirmation and to schedule your first visit.
        </p>
        <div className="field-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="field"><label htmlFor="first">First name</label><input id="first" autoComplete="given-name" value={details.firstName} onChange={(e) => setDetail("firstName", e.target.value)} /></div>
          <div className="field"><label htmlFor="last">Last name</label><input id="last" autoComplete="family-name" value={details.lastName} onChange={(e) => setDetail("lastName", e.target.value)} /></div>
          <div className="field"><label htmlFor="email">Email address</label><input id="email" type="email" autoComplete="email" value={details.email} onChange={(e) => setDetail("email", e.target.value)} /></div>
          <div className="field"><label htmlFor="phone">Mobile number</label><input id="phone" type="tel" autoComplete="tel" value={details.phone} onChange={(e) => setDetail("phone", e.target.value)} /></div>
        </div>
        <div className="field" style={{ marginTop: 12 }}><label htmlFor="notes">Hair goals or notes</label><textarea id="notes" value={details.notes} onChange={(e) => setDetail("notes", e.target.value)} /></div>
        <label className="check"><input type="checkbox" checked={details.updates} onChange={(e) => setDetail("updates", e.target.checked)} /><span>Email me the confirmation, payment status and appointment updates.</span></label>
        <label className="check"><input type="checkbox" checked={details.agreed} onChange={(e) => setDetail("agreed", e.target.checked)} /><span>I accept the membership terms and cancellation policy and authorise the stated payment.</span></label>
        {error && <p role="alert" className="error">{error}</p>}
      </div>

      <aside className="join-summary">
        <span className="eyebrow">Membership summary</span>
        <h3 style={{ fontSize: 22, margin: "10px 0 0" }}>{programme.eyebrow} — {programme.name}</h3>
        <div className="prog-cat">{programme.category}</div>
        <dl>
          <div><dt>Hair tier</dt><dd>{TIER_LABEL[tier]}</dd></div>
          <div><dt>Duration</dt><dd style={{ maxWidth: 180 }}>{programme.durationLabel}</dd></div>
          {programme.visits ? <div><dt>Included visits</dt><dd>{programme.visits}</dd></div> : null}
          <div><dt>Payment</dt><dd>{activePayment === "monthly" && pricing.monthly ? `${poundsLabel(pricing.monthly.amount)} × ${pricing.monthly.months}` : "Pay in full"}</dd></div>
          <div><dt>Programme total</dt><dd>{poundsLabel(pricing.upfront)}</dd></div>
          <div className="total"><dt>Due today</dt><dd>{poundsLabel(amountNow)}</dd></div>
        </dl>
        <button className="button" disabled={!ready || loading} onClick={checkout} style={{ width: "100%", marginTop: 20 }}>
          {loading ? "Opening secure checkout…" : payLabel}
        </button>
        <p className="secure"><span>◆</span><span>Secure Stripe Checkout — cards, Apple Pay and Google Pay where available. After payment you will book your first appointment.</span></p>
        {programme.disclaimer ? <p className="prog-detail-note">{programme.disclaimer}</p> : null}
      </aside>
    </div>
  );
}
