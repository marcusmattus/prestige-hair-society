import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClientNotes } from "@/components/studio/ClientNotes";
import { requireStaff } from "@/lib/auth/roles";
import { formatPence } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { formatDateShort, formatWhenShort } from "@/lib/time";

export const metadata: Metadata = {
  title: "Studio — client",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Client record.
 *
 * Everything the chair needs in one view: history, spend, preferences and the
 * internal notes. RLS is what keeps the notes staff-only -- there is no
 * customer-facing SELECT policy on client_notes at all, so this page cannot
 * accidentally be made public by a routing mistake.
 */
export default async function ClientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireStaff("/studio/clients");
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: client }, { data: bookings }, { data: payments }, { data: notes }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("*, favourite:favourite_staff_id(display_name)")
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("bookings")
        .select(
          `id, reference, status, starts_at, total_price_pence, deposit_paid_pence,
           balance_paid_pence,
           service:service_id(name), staff:staff_id(display_name),
           salon:salon_id(timezone)`,
        )
        .eq("profile_id", id)
        .order("starts_at", { ascending: false })
        .limit(50),
      supabase
        .from("payments")
        .select("amount_pence, refunded_pence, status, kind, paid_at")
        .eq("profile_id", id)
        .eq("status", "succeeded"),
      supabase
        .from("client_notes")
        .select("id, body, kind, created_at, author:author_id(first_name, last_name)")
        .eq("profile_id", id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
    ]);

  if (!client) notFound();

  const rows = bookings ?? [];
  const completed = rows.filter((b) => b.status === "completed");
  const upcoming = rows.filter(
    (b) => ["pending_payment", "confirmed"].includes(b.status) && Date.parse(b.starts_at) >= Date.now(),
  );
  const totalSpend = (payments ?? []).reduce(
    (sum, p) => sum + p.amount_pence - p.refunded_pence,
    0,
  );
  const outstanding = rows
    .filter((b) => ["confirmed", "completed"].includes(b.status))
    .reduce(
      (sum, b) =>
        sum + Math.max(0, b.total_price_pence - b.deposit_paid_pence - b.balance_paid_pence),
      0,
    );

  const name = `${client.first_name} ${client.last_name}`.trim() || "Unnamed client";

  return (
    <div>
      <Link href="/studio/clients" className="text-[14px] text-muted hover:text-ink">
        ← All clients
      </Link>

      <div className="mt-4 mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[32px] font-light">{name}</h1>
          <p className="mt-1 text-[14px] text-muted">
            {client.email}
            {client.phone && ` · ${client.phone}`} · client since{" "}
            {formatDateShort(client.created_at)}
          </p>
        </div>
        <Link
          href={`/studio/bookings/new?client=${client.id}`}
          className="rounded-[4px] bg-ink px-5 py-2.5 text-[14px] text-sand hover:bg-ink-hover"
        >
          Book for this client
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Visits" value={String(completed.length)} />
        <Stat label="Upcoming" value={String(upcoming.length)} />
        <Stat label="Total spend" value={formatPence(totalSpend)} />
        <Stat label="Outstanding" value={formatPence(outstanding)} />
        <Stat
          label="No-shows"
          value={String(client.no_show_count)}
          tone={client.no_show_count > 0 ? "warn" : undefined}
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          <h2 className="mb-4 font-serif text-[24px] font-light">Appointment history</h2>
          {rows.length === 0 ? (
            <p className="rounded-[6px] border border-line bg-sand px-5 py-5 text-[15px] text-muted">
              No appointments yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-[6px] border border-line">
              <table className="w-full min-w-[560px] text-[14px]">
                <caption className="sr-only">Appointment history for {name}</caption>
                <thead>
                  <tr className="border-b border-line bg-sand text-left">
                    <th className="px-4 py-3 font-medium text-muted">When</th>
                    <th className="px-4 py-3 font-medium text-muted">Service</th>
                    <th className="px-4 py-3 font-medium text-muted">Stylist</th>
                    <th className="px-4 py-3 font-medium text-muted">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((b) => (
                    <tr key={b.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">
                        {formatWhenShort(b.starts_at, b.salon?.timezone ?? "Europe/London")}
                      </td>
                      <td className="px-4 py-3">{b.service?.name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted">{b.staff?.display_name ?? "—"}</td>
                      <td className="px-4 py-3 text-muted capitalize">
                        {b.status.replace(/_/g, " ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="grid gap-6">
          <section className="rounded-[6px] border border-line px-5 py-5">
            <h2 className="mb-3 text-[12px] tracking-[0.16em] text-sage uppercase">
              What the client told us
            </h2>
            <dl className="grid gap-3 text-[14px]">
              <Detail label="Hair goals" value={client.hair_goals} />
              <Detail label="Accessibility" value={client.accessibility_requirements} />
              <Detail label="Allergies / sensitivities" value={client.allergies} sensitive />
              <Detail
                label="Favourite stylist"
                value={client.favourite?.display_name ?? null}
              />
              <Detail
                label="Marketing"
                value={[
                  client.marketing_email ? "email" : null,
                  client.marketing_sms ? "SMS" : null,
                ]
                  .filter(Boolean)
                  .join(", ") || "opted out"}
              />
            </dl>
          </section>

          <ClientNotes
            profileId={client.id}
            notes={(notes ?? []).map((n) => ({
              id: n.id,
              body: n.body,
              kind: n.kind,
              createdAt: n.created_at,
              author: n.author
                ? `${n.author.first_name} ${n.author.last_name}`.trim()
                : "Salon",
            }))}
            currentUserName={user.profile.first_name || "You"}
          />
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="rounded-[6px] border border-line px-4 py-4">
      <div className="text-[11px] tracking-[0.12em] text-sage uppercase">{label}</div>
      <div className={`mt-1.5 font-serif text-[24px] ${tone === "warn" ? "text-gold" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  sensitive,
}: {
  label: string;
  value: string | null;
  sensitive?: boolean;
}) {
  return (
    <div>
      <dt className="text-[13px] text-muted">
        {label}
        {sensitive && value && (
          <span className="ml-2 rounded-[3px] border border-gold px-1.5 py-0.5 text-[11px] text-gold">
            sensitive
          </span>
        )}
      </dt>
      <dd className="mt-0.5 leading-[1.6]">{value || <span className="text-muted">—</span>}</dd>
    </div>
  );
}
