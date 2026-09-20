"use client";

import { useState } from "react";
import Link from "next/link";
import {
  type Programme,
  type Tier,
  type PaymentOption,
  TIERS,
  getTier,
  hasMonthly,
  poundsLabel,
  paymentSummary,
} from "@/lib/memberships";

const TIER_SHORT: Record<Tier, string> = { short: "SHORT", medium: "MEDIUM", long: "LONG" };

export function MembershipCard({ programme }: { programme: Programme }) {
  const monthlyAvailable = hasMonthly(programme);
  const [tier, setTier] = useState<Tier>("short");
  const [payment, setPayment] = useState<PaymentOption>("full");

  const pricing = getTier(programme, tier);
  const canMonthly = Boolean(pricing.monthly);
  const activePayment: PaymentOption = payment === "monthly" && canMonthly ? "monthly" : "full";

  const includes = pricing.includes ?? programme.includes ?? [];
  const joinHref = `/memberships/join?programme=${programme.slug}&tier=${tier}&payment=${activePayment}`;

  return (
    <article className="prog-card">
      <span className="prog-badge">{programme.badge}</span>
      <div className="prog-cat">{programme.category}</div>
      <h3>
        {programme.eyebrow} — {programme.name}
      </h3>
      <div className="prog-dur">{programme.durationLabel}</div>
      <p className="prog-summary">{programme.summary}</p>

      <span className="seg-label">Hair tier</span>
      <div className="seg" role="group" aria-label="Hair tier">
        {TIERS.map((t) => (
          <button key={t} type="button" aria-pressed={t === tier} onClick={() => setTier(t)}>
            {TIER_SHORT[t]}
          </button>
        ))}
      </div>

      {monthlyAvailable && (
        <>
          <span className="seg-label">Payment</span>
          <div className="seg" role="group" aria-label="Payment option">
            <button type="button" aria-pressed={activePayment === "full"} onClick={() => setPayment("full")}>
              PAY IN FULL
            </button>
            <button
              type="button"
              aria-pressed={activePayment === "monthly"}
              onClick={() => setPayment("monthly")}
              disabled={!canMonthly}
              title={canMonthly ? undefined : "Pay in full for this tier"}
            >
              MONTHLY
            </button>
          </div>
        </>
      )}

      <div className="prog-price">
        {activePayment === "monthly" && pricing.monthly
          ? poundsLabel(pricing.monthly.amount)
          : poundsLabel(pricing.upfront)}
      </div>
      <div className="prog-price-sub">
        {activePayment === "monthly" && pricing.monthly
          ? `per month × ${pricing.monthly.months} · ${poundsLabel(pricing.upfront)} total`
          : canMonthly && pricing.monthly
            ? `or ${paymentSummary(pricing, "monthly")}`
            : "one-time payment"}
      </div>
      {pricing.value ? (
        <div className="prog-save">
          Value {poundsLabel(pricing.value)}
          {pricing.saving ? ` · save up to ${poundsLabel(pricing.saving)}` : ` · save ${poundsLabel(pricing.value - pricing.upfront)}`}
        </div>
      ) : null}

      {includes.length > 0 && (
        <ul className="prog-includes">
          {includes.slice(0, 4).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}

      <Link className="button" href={joinHref}>
        {programme.cta} →
      </Link>
      {programme.disclaimer ? <p className="prog-detail-note">{programme.disclaimer}</p> : null}
    </article>
  );
}
