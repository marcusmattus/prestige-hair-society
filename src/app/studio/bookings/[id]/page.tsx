import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingActions } from "@/components/studio/BookingActions";
import { MANAGER_ROLES, hasRole, requireStaff } from "@/lib/auth/roles";
import { balanceDue, formatPence } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { formatDateShort, formatTime, formatWhenLong } from "@/lib/time";

export const metadata: Metadata = {
  title: "Studio — booking",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * One appointment, everything about it.
 *
 * Includes the messages actually sent for this booking, so when a client says
 * "I never got a confirmation" the front desk can see whether it was sent,
 * skipped or failed, and read the exact text that went out.
 */
export default async function StudioBookingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireStaff("/studio/bookings");
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: booking }, { data: items }, { data: payments }, { data: messages }] =
    await Promise.all([
      supabase
        .from("bookings")
        .select(
          `*,
           service:service_id(name, slug, preparation_instructions, aftercare_instructions),
           staff:staff_id(id, display_name, title),
           profile:profile_id(id, first_name, last_name, email, phone, no_show_count,
                              allergies, accessibility_requirements),
           salon:salon_id(timezone, address_line1, city, postcode)`,
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.from("booking_items").select("*").eq("booking_id", id),
      supabase
        .from("payments")
        .select("id, kind, status, amount_pence, refunded_pence, paid_at, payment_method_brand, payment_method_last4, receipt_url")
        .eq("booking_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("message_deliveries")
        .select("id, kind, channel, status, recipient, subject, sent_at, scheduled_for, error_message")
        .eq("booking_id", id)
        .order("created_at", { ascending: false }),
    ]);

  if (!booking) notFound();

  const tz = booking.salon?.timezone ?? "Europe/London";
  const isManager = hasRole(user, MANAGER_ROLES);
  const balance = balanceDue(
    booking.total_price_pence,
    booking.deposit_paid_pence,
    booking.balance_paid_pence,
  );

  return (
    <div>
      <Link href="/studio/bookings" className="text-[14px] text-muted hover:text-ink">
        ← All bookings
      </Link>

      <div className="mt-4 mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[32px] font-light">
            {booking.service?.name ?? "Appointment"}
          </h1>
          <p className="mt-1 text-[14px] text-muted">
            <span className="font-mono">{booking.reference}</span> ·{" "}
            {formatWhenLong(booking.starts_at, tz)} · until{" "}
            {formatTime(booking.ends_at, tz)}
          </p>
        </div>
        <span className="rounded-[3px] border border-line px-3 py-1 text-[13px] capitalize">
          {booking.status.replace(/_/g, " ")}
        </span>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="grid gap-8">
          <section className="rounded-[6px] border border-line px-6 py-5">
            <h2 className="mb-4 text-[12px] tracking-[0.16em] text-sage uppercase">
              Money
            </h2>
            <dl className="grid gap-2.5 text-[14px]">
              <Row label="Service">{formatPence(booking.service_price_pence)}</Row>
              {booking.addons_price_pence > 0 && (
                <Row label="Add-ons">{formatPence(booking.addons_price_pence)}</Row>
              )}
              {booking.discount_pence > 0 && (
                <Row label="Discount">−{formatPence(booking.discount_pence)}</Row>
              )}
              <Row label="Total">{formatPence(booking.total_price_pence)}</Row>
              <Row label="Deposit paid">{formatPence(booking.deposit_paid_pence)}</Row>
              {booking.balance_paid_pence > 0 && (
                <Row label="Balance paid">{formatPence(booking.balance_paid_pence)}</Row>
              )}
              <div className="flex justify-between gap-4 border-t border-line pt-2.5">
                <dt className="text-muted">Due in salon</dt>
                <dd className={balance > 0 ? "text-gold" : ""}>{formatPence(balance)}</dd>
              </div>
            </dl>

            {(payments ?? []).length > 0 && (
              <div className="mt-5 border-t border-line pt-4">
                <h3 className="mb-3 text-[13px] text-muted">Payments</h3>
                <ul className="grid gap-2 text-[13px]">
                  {(payments ?? []).map((p) => (
                    <li key={p.id} className="flex flex-wrap justify-between gap-3">
                      <span>
                        {formatPence(p.amount_pence)} · {p.kind.replace(/_/g, " ")}
                        {p.payment_method_brand && (
                          <span className="text-muted">
                            {" "}
                            · {p.payment_method_brand} ••••{p.payment_method_last4}
                          </span>
                        )}
                        {p.refunded_pence > 0 && (
                          <span className="text-gold">
                            {" "}
                            · {formatPence(p.refunded_pence)} refunded
                          </span>
                        )}
                      </span>
                      <span className="text-muted">
                        {p.status}
                        {p.paid_at && ` · ${formatDateShort(p.paid_at, tz)}`}
                        {p.receipt_url && (
                          <>
                            {" · "}
                            <a
                              href={p.receipt_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline underline-offset-2"
                            >
                              receipt
                            </a>
                          </>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          {(items ?? []).length > 0 && (
            <section className="rounded-[6px] border border-line px-6 py-5">
              <h2 className="mb-4 text-[12px] tracking-[0.16em] text-sage uppercase">
                What was booked
              </h2>
              <ul className="grid gap-2 text-[14px]">
                {(items ?? []).map((item) => (
                  <li key={item.id} className="flex justify-between gap-4">
                    <span>
                      {item.name}
                      {item.kind === "addon" && (
                        <span className="text-muted"> (add-on)</span>
                      )}
                    </span>
                    <span className="text-muted">
                      {formatPence(item.unit_price_pence)} · {item.duration_minutes} min
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* The point of this section: answering "did they get the email?" */}
          <section className="rounded-[6px] border border-line px-6 py-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="text-[12px] tracking-[0.16em] text-sage uppercase">
                Messages sent
              </h2>
              <Link
                href={`/studio/messages?booking=${booking.id}`}
                className="text-[13px] text-moss underline underline-offset-2"
              >
                Open in the message log →
              </Link>
            </div>

            {(messages ?? []).length === 0 ? (
              <p className="text-[14px] text-muted">
                Nothing sent yet. Confirmations go out when the deposit is
                confirmed by Stripe.
              </p>
            ) : (
              <ul className="grid gap-3 text-[14px]">
                {(messages ?? []).map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0"
                  >
                    <div>
                      <span className="capitalize">{m.kind.replace(/_/g, " ")}</span>
                      <span className="text-muted"> · {m.channel}</span>
                      <span className="block text-[13px] text-muted">{m.recipient}</span>
                      {m.error_message && (
                        <span className="block text-[13px] text-[#B4483C]">
                          {m.error_message}
                        </span>
                      )}
                    </div>
                    <div className="text-right text-[13px]">
                      <DeliveryPill status={m.status} />
                      <span className="mt-0.5 block text-muted">
                        {m.sent_at
                          ? formatDateShort(m.sent_at, tz)
                          : m.scheduled_for
                            ? `due ${formatDateShort(m.scheduled_for, tz)}`
                            : "—"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="grid gap-6">
          <section className="rounded-[6px] border border-line px-5 py-5">
            <h2 className="mb-3 text-[12px] tracking-[0.16em] text-sage uppercase">
              Client
            </h2>
            {booking.profile ? (
              <>
                <Link
                  href={`/studio/clients/${booking.profile.id}`}
                  className="font-serif text-[20px] underline underline-offset-2"
                >
                  {`${booking.profile.first_name} ${booking.profile.last_name}`.trim()}
                </Link>
                <p className="mt-1 text-[14px] text-muted">{booking.profile.email}</p>
                {booking.profile.phone && (
                  <p className="text-[14px] text-muted">{booking.profile.phone}</p>
                )}
                {booking.profile.no_show_count > 0 && (
                  <p className="mt-2 text-[13px] text-gold">
                    {booking.profile.no_show_count} previous no-show
                    {booking.profile.no_show_count === 1 ? "" : "s"}
                  </p>
                )}
                {booking.profile.allergies && (
                  <p className="mt-3 rounded-[4px] border border-gold px-3 py-2 text-[13px] leading-[1.55]">
                    <span className="text-gold">Allergies: </span>
                    {booking.profile.allergies}
                  </p>
                )}
                {booking.accessibility_requirements && (
                  <p className="mt-2 text-[13px] leading-[1.55] text-muted">
                    <span className="text-ink">Accessibility: </span>
                    {booking.accessibility_requirements}
                  </p>
                )}
              </>
            ) : (
              <p className="text-[14px] text-muted">No client attached.</p>
            )}
          </section>

          {booking.customer_notes && (
            <section className="rounded-[6px] border border-line px-5 py-5">
              <h2 className="mb-2 text-[12px] tracking-[0.16em] text-sage uppercase">
                What the client said
              </h2>
              <p className="text-[14px] leading-[1.6] whitespace-pre-wrap">
                {booking.customer_notes}
              </p>
            </section>
          )}

          <BookingActions
            bookingId={booking.id}
            status={booking.status}
            balancePence={balance}
            isManager={isManager}
          />
        </aside>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function DeliveryPill({ status }: { status: string }) {
  const tone =
    status === "sent" || status === "delivered"
      ? "border-moss text-moss"
      : status === "failed"
        ? "border-[#B4483C] text-[#B4483C]"
        : status === "skipped"
          ? "border-line text-muted"
          : "border-gold text-gold";
  return (
    <span className={`rounded-[3px] border px-2 py-0.5 text-[12px] capitalize ${tone}`}>
      {status}
    </span>
  );
}
