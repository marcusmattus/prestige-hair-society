import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { MembershipCard } from "@/components/memberships/MembershipCard";
import { PROGRAMMES, getTier, poundsLabel } from "@/lib/memberships";

export const metadata: Metadata = {
  title: "Memberships & Programmes · Prestige Hair Society",
  description:
    "Structured 4-week, 3-month and 6-month hair and scalp programmes — scalp health, hydration, length retention, texture management and ongoing professional care.",
};

export default function MembershipsPage() {
  const fromPrice = Math.min(...PROGRAMMES.map((p) => getTier(p, "short").upfront));

  return (
    <>
      <div className="notice">Prestige Hair Society &nbsp; ◆ &nbsp; Memberships, subscriptions &amp; treatment programmes</div>
      <SiteHeader />

      <main>
        <section className="shell members-hero">
          <span className="eyebrow">Prestige Memberships &amp; Hair Programmes</span>
          <h1>Consistency creates results.</h1>
          <p>
            Choose a structured programme, pick your hair tier, choose to pay in full or monthly, then
            book your first appointment — all in one journey. Every included visit is prepaid, so you are
            never asked to pay again for a service your programme already covers.
          </p>
        </section>

        <section className="shell" id="choose">
          <div className="prog-grid">
            {PROGRAMMES.map((programme) => (
              <MembershipCard key={programme.id} programme={programme} />
            ))}
          </div>
        </section>

        {/* Full details, deep-linked from the homepage and card badges. */}
        <section className="shell" style={{ paddingBottom: 110 }}>
          <div className="section-head">
            <div>
              <span className="eyebrow">Programme details</span>
              <h2>What each programme includes.</h2>
            </div>
            <p>Prices shown are per hair tier. Payment plans, where offered, are fixed instalments across the programme.</p>
          </div>

          <div style={{ display: "grid", gap: 28 }}>
            {PROGRAMMES.map((programme) => (
              <article key={programme.id} id={programme.slug} style={{ scrollMarginTop: 100, borderTop: "1px solid var(--line)", paddingTop: 28 }}>
                <span className="prog-badge">{programme.badge}</span>
                <h3 style={{ fontSize: 30, margin: "14px 0 4px" }}>
                  {programme.eyebrow} — {programme.name}
                </h3>
                <div className="prog-cat">{programme.category} · {programme.durationLabel}</div>
                <p className="prog-summary" style={{ maxWidth: 720, marginTop: 12 }}>{programme.summary}</p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 20, alignItems: "start" }}>
                  <div>
                    {(programme.includes?.length ?? 0) > 0 && (
                      <>
                        <span className="seg-label">Included</span>
                        <ul className="prog-includes">
                          {programme.includes!.map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </>
                    )}
                    {programme.structure && (
                      <div className="prog-structure">
                        {programme.structure.map((s) => (
                          <div key={s.label}>
                            <strong>{s.label}</strong>
                            <p>{s.detail}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <span className="seg-label">Pricing by tier</span>
                    <dl style={{ margin: "10px 0 0" }}>
                      {programme.tiers.map((t) => (
                        <div key={t.tier} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "11px 0", borderBottom: "1px solid var(--line)", fontSize: 14 }}>
                          <dt style={{ color: "#687067", textTransform: "capitalize" }}>{t.tier}</dt>
                          <dd style={{ margin: 0, textAlign: "right" }}>
                            <strong>{poundsLabel(t.upfront)}</strong>
                            {t.monthly ? <div style={{ fontSize: 12, color: "#687067" }}>or {poundsLabel(t.monthly.amount)}/mo × {t.monthly.months}</div> : null}
                            {t.value ? <div style={{ fontSize: 12, color: "#53664a" }}>value {poundsLabel(t.value)}</div> : null}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <Link className="button" href={`/memberships/join?programme=${programme.slug}&tier=short&payment=full`} style={{ marginTop: 18 }}>
                      {programme.cta} →
                    </Link>
                    {programme.disclaimer ? <p className="prog-detail-note">{programme.disclaimer}</p> : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer" id="visit">
        <div className="shell footer-grid">
          <div>
            <span className="eyebrow">Visit Prestige Hair Society</span>
            <h2>2 Queenstown Road,<br />London SW8 3RX</h2>
            <p>Inside KOOP Studio · By appointment</p>
          </div>
          <Link className="button alt" style={{ color: "#fff", borderColor: "#fff" }} href="/#book">Book your visit</Link>
        </div>
      </footer>

      {/* Mobile sticky CTA */}
      <div className="sticky-cta">
        <span><strong>Join a membership</strong>from {poundsLabel(fromPrice)}</span>
        <a className="button" href="#choose">Choose</a>
      </div>
    </>
  );
}
