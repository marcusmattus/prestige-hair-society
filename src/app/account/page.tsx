import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { requireUser } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { claimMemberships } from "@/lib/memberships/store";
import { findProgramme, poundsLabel, TIER_LABEL, type Tier } from "@/lib/memberships";

export const metadata: Metadata = {
  title: "My membership · Prestige Hair Society",
  robots: { index: false },
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  past_due: "Payment due",
  cancelled: "Cancelled",
  completed: "Completed",
};

function whenLabel(iso: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (!Number.isFinite(date.valueOf())) return null;
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(date);
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ booked?: string }>;
}) {
  const { booked } = await searchParams;
  const user = await requireUser("/account");
  // Link any guest purchases made with this email, then read via RLS.
  await claimMemberships(user.id, user.email);
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from("memberships")
    .select("*")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false });

  const rows = memberships ?? [];
  const greetingName = user.profile.first_name?.trim() || user.email;

  return (
    <>
      <div className="notice">Prestige Hair Society &nbsp; ◆ &nbsp; Membership account</div>
      <SiteHeader />
      <main className="shell" style={{ padding: "48px 0 110px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 20, flexWrap: "wrap" }}>
          <div>
            <span className="eyebrow">Membership account</span>
            <h1 style={{ fontSize: "clamp(36px,5vw,56px)", lineHeight: 1, margin: "10px 0 0" }}>Hi {greetingName}.</h1>
          </div>
          <form action="/auth/sign-out" method="post">
            <button className="button alt" type="submit">Sign out</button>
          </form>
        </div>

        {booked ? (
          <div className="status-box" style={{ marginTop: 24 }}>
            <strong>Visit requested.</strong> Your prepaid visit is booked and Nekeia will confirm the time. It appears below as your next appointment.
          </div>
        ) : null}

        {rows.length === 0 ? (
          <div className="join-form" style={{ marginTop: 34, maxWidth: 560 }}>
            <h2 style={{ fontSize: 26, marginTop: 0 }}>No active memberships yet</h2>
            <p className="prog-summary">
              When you join a programme it will appear here with your appointments, remaining visits and payment plan.
              If you already purchased with a different email, sign in with that address.
            </p>
            <Link className="button" href="/memberships" style={{ marginTop: 18 }}>Explore memberships →</Link>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 22, marginTop: 34 }}>
            {rows.map((mb) => {
              const programme = findProgramme(mb.programme_id);
              const remaining = Math.max(0, mb.included_visits - mb.completed_visits);
              const next = whenLabel(mb.next_visit_at);
              const plan = mb.payment === "monthly" && mb.months
                ? `${poundsLabel(mb.amount_now_pence / 100)}/month × ${mb.months}`
                : `${poundsLabel(mb.total_pence / 100)} paid in full`;
              const viewHref = mb.stripe_customer_id
                ? `/api/stripe/portal?m=${mb.id}`
                : `/memberships${programme ? `#${programme.slug}` : ""}`;
              return (
                <article key={mb.id} className="join-form" style={{ padding: 26 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div>
                      <span className="prog-badge">{STATUS_LABEL[mb.status] || mb.status}</span>
                      <h2 style={{ fontSize: 26, margin: "12px 0 2px" }}>{mb.programme_name}</h2>
                      <div className="prog-cat">{mb.category}{mb.category ? " · " : ""}{TIER_LABEL[mb.tier as Tier] || mb.tier} hair</div>
                    </div>
                  </div>

                  <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 0, margin: "20px 0 0" }}>
                    <div style={{ padding: "14px 16px", border: "1px solid var(--line)", borderRadius: 6 }}>
                      <dt style={{ fontSize: 12, color: "#687067" }}>Appointments</dt>
                      <dd style={{ margin: "6px 0 0", fontFamily: "var(--font-serif)", fontSize: 26 }}>{mb.completed_visits} / {mb.included_visits || "—"}</dd>
                    </div>
                    <div style={{ padding: "14px 16px", border: "1px solid var(--line)", borderRadius: 6 }}>
                      <dt style={{ fontSize: 12, color: "#687067" }}>Remaining visits</dt>
                      <dd style={{ margin: "6px 0 0", fontFamily: "var(--font-serif)", fontSize: 26 }}>{mb.included_visits ? remaining : "—"}</dd>
                    </div>
                    <div style={{ padding: "14px 16px", border: "1px solid var(--line)", borderRadius: 6 }}>
                      <dt style={{ fontSize: 12, color: "#687067" }}>Next appointment</dt>
                      <dd style={{ margin: "6px 0 0", fontSize: 15 }}>{next || "Not booked yet"}</dd>
                    </div>
                    <div style={{ padding: "14px 16px", border: "1px solid var(--line)", borderRadius: 6 }}>
                      <dt style={{ fontSize: 12, color: "#687067" }}>Payment plan</dt>
                      <dd style={{ margin: "6px 0 0", fontSize: 15 }}>{plan}</dd>
                    </div>
                  </dl>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 20 }}>
                    <Link className="button" href={`/account/book?m=${mb.id}`}>Book Next Visit</Link>
                    <Link className="button alt" href={`/account/book?m=${mb.id}&reschedule=1`}>Reschedule</Link>
                    <a className="button alt" href={viewHref}>View membership</a>
                  </div>
                  {mb.booking_reference ? <p className="prog-detail-note">Reference {mb.booking_reference}. Included visits are prepaid — mention your membership when booking so a covered service isn’t charged again.</p> : null}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
