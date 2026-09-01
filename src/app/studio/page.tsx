import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/roles";
import { formatPence } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { formatTime, inZone } from "@/lib/time";

export const metadata: Metadata = {
  title: "Studio — today",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Today at a glance.
 *
 * Every figure here is a count over the salon's local day, not the server's,
 * so "today" means the same thing to the person standing at the front desk as
 * it does to the database.
 */
export default async function StudioDashboard() {
  await requireStaff("/studio");
  const supabase = await createClient();

  const { data: salon } = await supabase
    .from("salons")
    .select("id, timezone")
    .limit(1)
    .maybeSingle();

  const tz = salon?.timezone ?? "Europe/London";
  const now = new Date();
  const local = inZone(now, tz);
  const dayStart = new Date(local);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const startIso = dayStart.toISOString();
  const endIso = dayEnd.toISOString();

  const [today, payments, newClients] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        `id, reference, status, starts_at, ends_at, total_price_pence, deposit_paid_pence,
         balance_paid_pence,
         service:service_id(name),
         staff:staff_id(display_name),
         profile:profile_id(first_name, last_name, phone)`,
      )
      .gte("starts_at", startIso)
      .lt("starts_at", endIso)
      .order("starts_at"),
    supabase
      .from("payments")
      .select("amount_pence, status, kind")
      .gte("paid_at", startIso)
      .lt("paid_at", endIso)
      .eq("status", "succeeded"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startIso)
      .lt("created_at", endIso),
  ]);

  const bookings = today.data ?? [];
  const confirmed = bookings.filter((b) => b.status === "confirmed").length;
  const pending = bookings.filter((b) => b.status === "pending_payment").length;
  const cancelled = bookings.filter((b) => b.status.startsWith("cancelled")).length;
  const noShows = bookings.filter((b) => b.status === "no_show").length;
  const depositsToday = (payments.data ?? []).reduce((sum, p) => sum + p.amount_pence, 0);
  const outstanding = bookings
    .filter((b) => !b.status.startsWith("cancelled") && b.status !== "no_show")
    .reduce(
      (sum, b) =>
        sum + Math.max(0, b.total_price_pence - b.deposit_paid_pence - b.balance_paid_pence),
      0,
    );

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[32px] font-light">Today</h1>
          <p className="mt-1 text-[14px] text-muted">
            {local.toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
        </div>
        <Link
          href="/studio/calendar"
          className="rounded-[4px] border border-line px-4 py-2.5 text-[14px] hover:border-gold"
        >
          Open calendar →
        </Link>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <Stat label="Appointments" value={String(bookings.length)} />
        <Stat label="Confirmed" value={String(confirmed)} />
        <Stat label="Awaiting payment" value={String(pending)} tone={pending ? "warn" : undefined} />
        <Stat label="Cancelled" value={String(cancelled)} />
        <Stat label="No-shows" value={String(noShows)} tone={noShows ? "warn" : undefined} />
        <Stat label="Taken today" value={formatPence(depositsToday)} />
        <Stat label="Due in salon" value={formatPence(outstanding)} />
      </div>

      <section aria-labelledby="schedule">
        <h2 id="schedule" className="mb-4 font-serif text-[24px] font-light">
          The day
        </h2>

        {bookings.length === 0 ? (
          <p className="rounded-[6px] border border-line bg-sand px-5 py-6 text-[15px] text-muted">
            Nothing in the book today.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-[6px] border border-line">
            <table className="w-full min-w-[720px] text-[14px]">
              <caption className="sr-only">Today&rsquo;s appointments</caption>
              <thead>
                <tr className="border-b border-line bg-sand text-left">
                  <Th>Time</Th>
                  <Th>Client</Th>
                  <Th>Service</Th>
                  <Th>Stylist</Th>
                  <Th>Status</Th>
                  <Th>Balance</Th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => {
                  const balance = Math.max(
                    0,
                    b.total_price_pence - b.deposit_paid_pence - b.balance_paid_pence,
                  );
                  return (
                    <tr key={b.id} className="border-b border-line last:border-0">
                      <Td>
                        {formatTime(b.starts_at, tz)}–{formatTime(b.ends_at, tz)}
                      </Td>
                      <Td>
                        {b.profile
                          ? `${b.profile.first_name} ${b.profile.last_name}`.trim() || "—"
                          : "—"}
                        {b.profile?.phone && (
                          <span className="block text-[13px] text-muted">
                            {b.profile.phone}
                          </span>
                        )}
                      </Td>
                      <Td>{b.service?.name ?? "—"}</Td>
                      <Td>{b.staff?.display_name ?? "—"}</Td>
                      <Td>
                        <StatusPill status={b.status} />
                      </Td>
                      <Td>{balance > 0 ? formatPence(balance) : "Settled"}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-6 text-[13px] text-muted">
        New clients today: {newClients.count ?? 0}
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <div className="rounded-[6px] border border-line px-4 py-4">
      <div className="text-[11px] tracking-[0.12em] text-sage uppercase">{label}</div>
      <div
        className={`mt-1.5 font-serif text-[26px] ${tone === "warn" ? "text-gold" : "text-ink"}`}
      >
        {value}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const label = status.replace(/_/g, " ");
  const tone =
    status === "confirmed" || status === "completed"
      ? "border-moss text-moss"
      : status === "pending_payment"
        ? "border-gold text-gold"
        : "border-line text-muted";

  return (
    <span className={`rounded-[3px] border px-2 py-0.5 text-[12px] capitalize ${tone}`}>
      {label}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-medium text-muted">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 align-top">{children}</td>;
}
