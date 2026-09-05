import type { Metadata } from "next";
import Link from "next/link";
import { requireManager } from "@/lib/auth/roles";
import { formatPence } from "@/lib/money";
import {
  customerSplit,
  percent,
  rosteredMinutes,
  serviceMix,
  staffPerformance,
  totals,
  type ReportBooking,
  type ReportPayment,
} from "@/lib/studio/reports";
import { createAdminClient } from "@/lib/supabase/admin";
import { nowIso, sinceDaysAgo } from "@/lib/time";

export const metadata: Metadata = {
  title: "Reports",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "365", label: "Last year" },
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireManager("/studio/reports");
  const sp = await searchParams;
  const supabase = createAdminClient();

  const days = RANGES.some((r) => r.value === sp.range) ? Number(sp.range) : 30;
  const from = new Date(sinceDaysAgo(days));
  const to = new Date(nowIso());

  const [{ data: bookingRows }, { data: paymentRows }, { data: schedules }, { data: breaks }, { data: firstBookings }] =
    await Promise.all([
      supabase
        .from("bookings")
        .select(
          `id, profile_id, service_id, staff_id, status, starts_at, ends_at, blocked_until,
           total_price_pence, deposit_paid_pence, balance_paid_pence,
           service:service_id(name), staff:staff_id(display_name)`,
        )
        .gte("starts_at", from.toISOString())
        .lte("starts_at", to.toISOString()),
      supabase
        .from("payments")
        .select("kind, status, amount_pence, refunded_pence, paid_at")
        .gte("created_at", from.toISOString()),
      supabase.from("staff_schedules").select("staff_id, day_of_week, starts_at, ends_at"),
      supabase.from("staff_breaks").select("staff_id, day_of_week, starts_at, ends_at"),
      // Each customer's earliest kept appointment ever, so "new" means new to
      // the salon rather than new to this window.
      supabase
        .from("bookings")
        .select("profile_id, starts_at")
        .in("status", ["confirmed", "completed"])
        .order("starts_at"),
    ]);

  const bookings: ReportBooking[] = (bookingRows ?? []).map((b) => ({
    id: b.id,
    profileId: b.profile_id,
    serviceId: b.service_id,
    serviceName: (b.service as { name: string } | null)?.name ?? "Unknown service",
    staffId: b.staff_id,
    staffName: (b.staff as { display_name: string } | null)?.display_name ?? "Unknown",
    status: b.status,
    startsAt: b.starts_at,
    endsAt: b.ends_at,
    blockedUntil: b.blocked_until,
    totalPricePence: b.total_price_pence,
    depositPaidPence: b.deposit_paid_pence,
    balancePaidPence: b.balance_paid_pence,
  }));

  const payments: ReportPayment[] = (paymentRows ?? []).map((p) => ({
    kind: p.kind,
    status: p.status,
    amountPence: p.amount_pence,
    refundedPence: p.refunded_pence,
    paidAt: p.paid_at,
  }));

  const firstByProfile = new Map<string, string>();
  for (const row of firstBookings ?? []) {
    if (!firstByProfile.has(row.profile_id)) {
      firstByProfile.set(row.profile_id, row.starts_at);
    }
  }

  const t = totals(bookings, payments);
  const mix = serviceMix(bookings);
  const staffRows = staffPerformance(
    bookings,
    rosteredMinutes(schedules ?? [], breaks ?? [], from, to),
  );
  const customers = customerSplit(bookings, firstByProfile);

  const maxMixValue = mix[0]?.valuePence ?? 1;

  return (
    <div>
      <h2 className="mb-2 font-serif text-[28px] font-light">Reports</h2>
      <p className="mb-8 max-w-[680px] text-[15px] leading-[1.7] text-muted">
        Counted by appointment date, not booking date, so a month reads as the
        work actually done. Money is net of refunds.
      </p>

      <form className="mb-8 flex flex-wrap items-end gap-3">
        <label className="text-[13px]">
          <span className="mb-1.5 block tracking-[0.06em] text-sage uppercase">Period</span>
          <select
            name="range"
            defaultValue={String(days)}
            className="min-h-[44px] rounded-[4px] border border-line bg-white px-3 py-2 text-[14px]"
          >
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="min-h-[44px] cursor-pointer rounded-[4px] bg-ink px-5 py-2 text-[14px] text-sand"
        >
          Apply
        </button>
      </form>

      {t.booked === 0 ? (
        <p className="rounded-[6px] border border-line bg-sand px-6 py-5 text-[15px] leading-[1.7] text-muted">
          No appointments in this period yet. Once bookings come through, this
          page shows takings, which services earn, how full each stylist&rsquo;s
          week is, and how many customers are new.
        </p>
      ) : (
        <>
          <section className="mb-10">
            <h3 className="mb-4 border-b border-line pb-3 text-[13px] tracking-[0.12em] text-sage uppercase">
              Money
            </h3>
            <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat label="Taken" value={formatPence(t.takingsPence)} tone="good" />
              <Stat label="Of which deposits" value={formatPence(t.depositsPence)} />
              <Stat label="Booked value" value={formatPence(t.bookedValuePence)} />
              <Stat
                label="Still owed in salon"
                value={formatPence(t.outstandingPence)}
                tone={t.outstandingPence > 0 ? "warn" : undefined}
              />
            </dl>
          </section>

          <section className="mb-10">
            <h3 className="mb-4 border-b border-line pb-3 text-[13px] tracking-[0.12em] text-sage uppercase">
              Appointments
            </h3>
            <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Stat label="Kept" value={String(t.kept)} tone="good" />
              <Stat label="Completed" value={String(t.completed)} />
              <Stat
                label="Cancelled"
                value={String(t.cancelled)}
                tone={t.cancelled > 0 ? "warn" : undefined}
              />
              <Stat
                label="No-shows"
                value={`${t.noShows} (${percent(t.noShowRate)})`}
                tone={t.noShows > 0 ? "bad" : undefined}
              />
            </dl>
            <p className="mt-3 text-[13px] leading-[1.6] text-muted">
              {percent(t.lossRate)} of decided appointments were lost to a
              cancellation or a no-show. Appointments still awaiting payment are
              excluded — they were never confirmed.
            </p>
          </section>

          <section className="mb-10">
            <h3 className="mb-4 border-b border-line pb-3 text-[13px] tracking-[0.12em] text-sage uppercase">
              Customers
            </h3>
            <dl className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <Stat label="New to the salon" value={String(customers.newCustomers)} />
              <Stat label="Returning" value={String(customers.returning)} tone="good" />
              <Stat label="Share new" value={percent(customers.newShare)} />
            </dl>
          </section>

          <section className="mb-10">
            <h3 className="mb-4 border-b border-line pb-3 text-[13px] tracking-[0.12em] text-sage uppercase">
              What earns
            </h3>
            <ul className="grid gap-2">
              {mix.slice(0, 12).map((row) => (
                <li key={row.serviceId}>
                  <div className="mb-1 flex justify-between gap-4 text-[14px]">
                    <span>
                      {row.name}
                      <span className="ml-2 text-[13px] text-muted">
                        ×{row.count}
                      </span>
                    </span>
                    <span>{formatPence(row.valuePence)}</span>
                  </div>
                  {/* A bar rather than a pie: comparing lengths is easier than
                      comparing angles, and there are too many services for one. */}
                  <div
                    className="h-1.5 rounded-[2px] bg-sand"
                    role="img"
                    aria-label={`${row.name}: ${formatPence(row.valuePence)}`}
                  >
                    <div
                      className="h-full rounded-[2px] bg-moss"
                      style={{ width: `${Math.round((row.valuePence / maxMixValue) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="mb-4 border-b border-line pb-3 text-[13px] tracking-[0.12em] text-sage uppercase">
              Stylists
            </h3>
            <div className="overflow-x-auto rounded-[6px] border border-line">
              <table className="w-full min-w-[520px] text-left text-[14px]">
                <thead>
                  <tr className="border-b border-line text-[12px] tracking-[0.08em] text-sage uppercase">
                    <th className="px-4 py-3 font-normal">Stylist</th>
                    <th className="px-4 py-3 font-normal">Appointments</th>
                    <th className="px-4 py-3 font-normal">Value</th>
                    <th className="px-4 py-3 font-normal">Chair time booked</th>
                  </tr>
                </thead>
                <tbody>
                  {staffRows.map((row) => (
                    <tr key={row.staffId} className="border-b border-line last:border-0">
                      <td className="px-4 py-3">{row.name}</td>
                      <td className="px-4 py-3">{row.appointments}</td>
                      <td className="px-4 py-3">{formatPence(row.valuePence)}</td>
                      <td className="px-4 py-3">
                        {row.utilisation > 0 ? (
                          <span className="flex items-center gap-2">
                            <span className="h-1.5 w-20 rounded-[2px] bg-sand">
                              <span
                                className="block h-full rounded-[2px] bg-moss"
                                style={{ width: `${Math.round(row.utilisation * 100)}%` }}
                              />
                            </span>
                            <span className="text-muted">{percent(row.utilisation)}</span>
                          </span>
                        ) : (
                          <span className="text-muted">no roster set</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[13px] leading-[1.6] text-muted">
              Chair time is booked minutes including buffers, against rostered
              minutes less breaks — set in{" "}
              <Link href="/studio/availability" className="text-moss underline">
                availability
              </Link>
              . Time off is not deducted, so a holiday reads as quiet rather
              than disappearing.
            </p>
          </section>
        </>
      )}
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
  tone?: "good" | "warn" | "bad";
}) {
  return (
    <div className="rounded-[6px] border border-line px-4 py-3">
      <dt className="text-[12px] tracking-[0.08em] text-sage uppercase">{label}</dt>
      <dd
        className={`mt-1 font-serif text-[26px] ${
          tone === "good"
            ? "text-moss"
            : tone === "warn"
              ? "text-gold"
              : tone === "bad"
                ? "text-[#B4483C]"
                : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
