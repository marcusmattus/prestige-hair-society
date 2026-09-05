import type { Metadata } from "next";
import Link from "next/link";
import { RefundForm } from "@/components/studio/RefundForm";
import { requireManager } from "@/lib/auth/roles";
import { balanceDue, formatPence } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateLong, formatWhenShort, sinceDaysAgo } from "@/lib/time";

export const metadata: Metadata = {
  title: "Payments",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  deposit: "Deposit",
  balance: "Balance",
  full: "Full payment",
  in_salon: "In salon",
};

const STATUS_TONE: Record<string, string> = {
  succeeded: "border-moss text-moss",
  processing: "border-gold text-gold",
  requires_payment: "border-line text-muted",
  failed: "border-[#B4483C] text-[#B4483C]",
  refunded: "border-line text-muted",
  partially_refunded: "border-gold text-gold",
  disputed: "border-[#B4483C] text-[#B4483C]",
};

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; kind?: string }>;
}) {
  await requireManager("/studio/payments");
  const sp = await searchParams;
  const supabase = createAdminClient();

  const { data: salon } = await supabase
    .from("salons")
    .select("id, timezone")
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const tz = salon?.timezone ?? "Europe/London";
  const days = sp.range === "7" ? 7 : sp.range === "90" ? 90 : sp.range === "all" ? 3650 : 30;
  const since = sinceDaysAgo(days);

  let query = supabase
    .from("payments")
    .select(
      `id, kind, status, amount_pence, refunded_pence, currency, paid_at, created_at,
       payment_method_brand, payment_method_last4, stripe_payment_intent_id, notes,
       booking:booking_id(id, reference, starts_at, total_price_pence,
                          deposit_paid_pence, balance_paid_pence, status),
       profile:profile_id(id, first_name, last_name, email)`,
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(200);

  if (sp.kind && ["deposit", "balance", "full", "in_salon"].includes(sp.kind)) {
    query = query.eq("kind", sp.kind as "deposit");
  }

  const { data: payments } = await query;

  // Outstanding balances across every confirmed appointment, not just the ones
  // with a payment row — a booking whose deposit cleared but which has not been
  // settled has money owing and no payment to hang it off.
  const { data: openBookings } = await supabase
    .from("bookings")
    .select(
      `id, reference, starts_at, total_price_pence, deposit_paid_pence, balance_paid_pence,
       profile:profile_id(first_name, last_name)`,
    )
    .in("status", ["confirmed", "completed"])
    .order("starts_at", { ascending: false })
    .limit(200);

  const outstanding = (openBookings ?? [])
    .map((b) => ({
      ...b,
      due: balanceDue(b.total_price_pence, b.deposit_paid_pence, b.balance_paid_pence),
    }))
    .filter((b) => b.due > 0);

  const settled = (payments ?? []).filter((p) => p.status === "succeeded" || p.status === "partially_refunded");
  const takings = settled.reduce((sum, p) => sum + p.amount_pence - p.refunded_pence, 0);
  const deposits = settled
    .filter((p) => p.kind === "deposit")
    .reduce((sum, p) => sum + p.amount_pence - p.refunded_pence, 0);
  const refunded = (payments ?? []).reduce((sum, p) => sum + p.refunded_pence, 0);
  const outstandingTotal = outstanding.reduce((sum, b) => sum + b.due, 0);

  const rangeLabel =
    days === 7 ? "last 7 days" : days === 90 ? "last 90 days" : days > 365 ? "all time" : "last 30 days";

  return (
    <div>
      <h2 className="mb-2 font-serif text-[28px] font-light">Payments</h2>
      <p className="mb-8 max-w-[680px] text-[15px] leading-[1.7] text-muted">
        Everything taken, and everything still owed. Deposits arrive through
        Stripe; balances are recorded here when settled in the salon. Card
        numbers are never stored — only what Stripe reports back.
      </p>

      <dl className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label={`Taken (${rangeLabel})`} value={formatPence(takings)} tone="good" />
        <Stat label="Of which deposits" value={formatPence(deposits)} />
        <Stat label="Refunded" value={formatPence(refunded)} tone={refunded > 0 ? "warn" : undefined} />
        <Stat
          label="Outstanding in salon"
          value={formatPence(outstandingTotal)}
          tone={outstandingTotal > 0 ? "warn" : undefined}
        />
      </dl>

      <form className="mb-6 flex flex-wrap items-end gap-3">
        <label className="text-[13px]">
          <span className="mb-1.5 block tracking-[0.06em] text-sage uppercase">Period</span>
          <select
            name="range"
            defaultValue={sp.range ?? "30"}
            className="min-h-[44px] rounded-[4px] border border-line bg-white px-3 py-2 text-[14px]"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </label>

        <label className="text-[13px]">
          <span className="mb-1.5 block tracking-[0.06em] text-sage uppercase">Kind</span>
          <select
            name="kind"
            defaultValue={sp.kind ?? ""}
            className="min-h-[44px] rounded-[4px] border border-line bg-white px-3 py-2 text-[14px]"
          >
            <option value="">Any</option>
            <option value="deposit">Deposit</option>
            <option value="balance">Balance</option>
            <option value="full">Full payment</option>
            <option value="in_salon">In salon</option>
          </select>
        </label>

        <button
          type="submit"
          className="min-h-[44px] cursor-pointer rounded-[4px] bg-ink px-5 py-2 text-[14px] text-sand"
        >
          Apply
        </button>
      </form>

      {outstanding.length > 0 && (
        <section className="mb-10">
          <h3 className="mb-3 border-b border-line pb-3 text-[13px] tracking-[0.12em] text-sage uppercase">
            Balance due in salon ({outstanding.length})
          </h3>
          <ul className="grid gap-2">
            {outstanding.slice(0, 20).map((b) => {
              const customer = b.profile as { first_name: string; last_name: string } | null;
              return (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-line px-5 py-3 text-[14px]"
                >
                  <span>
                    <Link href={`/studio/bookings/${b.id}`} className="underline underline-offset-2">
                      {b.reference}
                    </Link>
                    <span className="ml-2">
                      {`${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim() || "—"}
                    </span>
                    <span className="ml-2 text-[13px] text-muted">
                      {formatWhenShort(b.starts_at, tz)}
                    </span>
                  </span>
                  <span className="font-medium">{formatPence(b.due)}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[13px] text-muted">
            Record a settlement from the appointment page.
          </p>
        </section>
      )}

      <section>
        <h3 className="mb-3 border-b border-line pb-3 text-[13px] tracking-[0.12em] text-sage uppercase">
          Ledger
        </h3>

        {!payments || payments.length === 0 ? (
          <p className="text-[15px] text-muted">No payments in this period.</p>
        ) : (
          <ul className="grid gap-3">
            {payments.map((payment) => {
              const booking = payment.booking as { id: string; reference: string } | null;
              const customer = payment.profile as
                | { first_name: string; last_name: string; email: string }
                | null;
              const refundable = payment.amount_pence - payment.refunded_pence;

              return (
                <li key={payment.id} className="rounded-[6px] border border-line px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-[15px]">
                        {KIND_LABEL[payment.kind] ?? payment.kind}
                        <span
                          className={`ml-2 rounded-[3px] border px-2 py-0.5 text-[12px] ${
                            STATUS_TONE[payment.status] ?? "border-line text-muted"
                          }`}
                        >
                          {payment.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="mt-1 text-[13px] text-muted">
                        {`${customer?.first_name ?? ""} ${customer?.last_name ?? ""}`.trim() || "—"}
                        {booking && (
                          <>
                            {" · "}
                            <Link
                              href={`/studio/bookings/${booking.id}`}
                              className="underline underline-offset-2"
                            >
                              {booking.reference}
                            </Link>
                          </>
                        )}
                        {" · "}
                        {formatDateLong(payment.paid_at ?? payment.created_at, tz)}
                        {payment.payment_method_brand && payment.payment_method_last4 && (
                          <> · {payment.payment_method_brand} ····{payment.payment_method_last4}</>
                        )}
                      </div>
                      {payment.notes && (
                        <div className="mt-1 text-[13px] text-muted">{payment.notes}</div>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-[16px]">{formatPence(payment.amount_pence)}</div>
                      {payment.refunded_pence > 0 && (
                        <div className="text-[13px] text-muted">
                          −{formatPence(payment.refunded_pence)} refunded
                        </div>
                      )}
                    </div>
                  </div>

                  {(payment.status === "succeeded" || payment.status === "partially_refunded") && (
                    <div className="mt-3 border-t border-line pt-3">
                      <RefundForm
                        paymentId={payment.id}
                        refundablePence={refundable}
                        isInSalon={payment.kind === "in_salon"}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
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
  tone?: "good" | "warn";
}) {
  return (
    <div className="rounded-[6px] border border-line px-4 py-3">
      <dt className="text-[12px] tracking-[0.08em] text-sage uppercase">{label}</dt>
      <dd
        className={`mt-1 font-serif text-[26px] ${
          tone === "good" ? "text-moss" : tone === "warn" ? "text-gold" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
