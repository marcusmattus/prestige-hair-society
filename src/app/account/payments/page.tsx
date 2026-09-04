import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/roles";
import { balanceDue, formatPence } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { formatDateLong, formatWhenLong } from "@/lib/time";

export const metadata: Metadata = {
  title: "Payments and receipts",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  succeeded: "Paid",
  processing: "Processing",
  requires_payment: "Not paid",
  failed: "Failed",
  refunded: "Refunded",
  partially_refunded: "Partly refunded",
  disputed: "Disputed",
};

const KIND_LABEL: Record<string, string> = {
  deposit: "Deposit",
  balance: "Balance",
  full: "Full payment",
  in_salon: "Paid in salon",
};

export default async function PaymentsPage() {
  await requireUser("/account/payments");
  const supabase = await createClient();

  // RLS confines both queries to this customer's own rows.
  const [{ data: payments }, { data: bookings }] = await Promise.all([
    supabase
      .from("payments")
      .select("*, booking:booking_id(reference, starts_at, service_id)")
      .order("created_at", { ascending: false }),
    supabase
      .from("bookings")
      .select("id, reference, starts_at, total_price_pence, deposit_paid_pence, balance_paid_pence, status")
      .in("status", ["confirmed", "completed"])
      .order("starts_at", { ascending: false }),
  ]);

  const outstanding = (bookings ?? []).filter(
    (b) =>
      b.status === "confirmed" &&
      balanceDue(b.total_price_pence, b.deposit_paid_pence, b.balance_paid_pence) > 0,
  );

  const totalPaid = (payments ?? [])
    .filter((p) => p.status === "succeeded")
    .reduce((sum, p) => sum + p.amount_pence - p.refunded_pence, 0);

  return (
    <div>
      <h2 className="mb-2 font-serif text-[28px] font-light">Payments</h2>
      <p className="mb-8 max-w-[560px] text-[15px] leading-[1.7] text-muted">
        Deposits taken online, and the balance settled in the salon. Card
        details are never stored here — payments are handled by Stripe.
      </p>

      {outstanding.length > 0 && (
        <section className="mb-10 rounded-[6px] border border-line bg-sand px-6 py-5">
          <h3 className="mb-3 text-[13px] tracking-[0.12em] text-sage uppercase">
            Balance due in salon
          </h3>
          <ul className="grid gap-2.5">
            {outstanding.map((b) => (
              <li key={b.id} className="flex justify-between gap-4 text-[15px]">
                <span>
                  <Link href="/account/bookings" className="hover:text-gold">
                    {b.reference}
                  </Link>
                  <span className="ml-2 text-[13px] text-muted">
                    {formatWhenLong(b.starts_at)}
                  </span>
                </span>
                <span>
                  {formatPence(
                    balanceDue(b.total_price_pence, b.deposit_paid_pence, b.balance_paid_pence),
                  )}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[13px] leading-[1.6] text-muted">
            Payable at your appointment. There is nothing to do now.
          </p>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-baseline justify-between gap-4 border-b border-line pb-3">
          <h3 className="text-[13px] tracking-[0.12em] text-sage uppercase">
            History
          </h3>
          {totalPaid > 0 && (
            <span className="text-[13px] text-muted">
              {formatPence(totalPaid)} paid in total
            </span>
          )}
        </div>

        {!payments || payments.length === 0 ? (
          <p className="text-[15px] text-muted">
            No payments yet.{" "}
            <Link href="/book" className="text-moss underline">
              Book an appointment
            </Link>{" "}
            and your receipts will appear here.
          </p>
        ) : (
          <ul className="grid gap-3">
            {payments.map((payment) => {
              const booking = payment.booking as { reference: string } | null;
              return (
                <li
                  key={payment.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-[6px] border border-line px-5 py-4"
                >
                  <div>
                    <div className="text-[15px]">
                      {KIND_LABEL[payment.kind] ?? payment.kind}
                      {booking?.reference && (
                        <span className="ml-2 text-[13px] text-muted">
                          {booking.reference}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[13px] text-muted">
                      {formatDateLong(payment.paid_at ?? payment.created_at)}
                      {payment.payment_method_brand && payment.payment_method_last4 && (
                        <> · {payment.payment_method_brand} ····{payment.payment_method_last4}</>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-[15px]">
                      {formatPence(payment.amount_pence)}
                      {payment.refunded_pence > 0 && (
                        <span className="ml-2 text-[13px] text-muted">
                          −{formatPence(payment.refunded_pence)} refunded
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[13px] text-muted">
                      {STATUS_LABEL[payment.status] ?? payment.status}
                      {payment.receipt_url && (
                        <>
                          {" · "}
                          <a
                            href={payment.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-moss underline"
                          >
                            Receipt
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
