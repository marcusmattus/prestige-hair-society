import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { SiteHeader } from "@/components/sections/SiteHeader";
import { AddToCalendar } from "@/components/booking/AddToCalendar";
import { balanceDue, formatPence } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatWhenLong } from "@/lib/time";

export const metadata: Metadata = {
  title: "Appointment confirmed",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Confirmation page.
 *
 * Reached by Stripe's redirect, which is NOT proof of payment -- the webhook
 * is. So this page reports the booking's actual status: confirmed once the
 * webhook has landed, "being confirmed" in the seconds before it does.
 *
 * The reference alone is enough to view this page, because a customer who has
 * just paid as a guest has no session yet. It shows nothing beyond the
 * appointment itself, and references are not enumerable in practice.
 */
export default async function ConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  if (!ref) notFound();

  const supabase = createAdminClient();
  const { data: booking } = await supabase
    .from("bookings")
    .select(
      `reference, status, starts_at, ends_at, total_price_pence, deposit_pence,
       deposit_paid_pence, balance_paid_pence, pricing_mode,
       service:service_id(name, preparation_instructions),
       staff:staff_id(display_name),
       salon:salon_id(name, address_line1, address_line2, city, postcode, timezone, google_maps_url)`,
    )
    .eq("reference", ref)
    .maybeSingle();

  if (!booking) notFound();

  const service = booking.service;
  const staff = booking.staff;
  const salon = booking.salon;
  if (!salon) notFound();

  const tz = salon.timezone;
  const confirmed = booking.status === "confirmed";
  const awaiting = booking.status === "pending_payment";
  const address = [salon.address_line1, salon.address_line2, salon.city, salon.postcode]
    .filter(Boolean)
    .join(", ");
  const outstanding = balanceDue(
    booking.total_price_pence,
    booking.deposit_paid_pence,
    booking.balance_paid_pence,
  );

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[720px] px-5 py-16 md:px-10 lg:py-24">
        <div className="text-center">
          <div className="mx-auto mb-7 h-3 w-3 rotate-45 bg-gold" />
          <h1 className="mb-3 font-serif text-[36px] leading-[1.1] font-light md:text-[44px]">
            {confirmed ? "Appointment confirmed" : "Almost there"}
          </h1>
          <p className="text-[15px] leading-[1.7] text-muted">
            {confirmed && (
              <>
                Confirmation {booking.reference} is on its way to you by email
                and text.
              </>
            )}
            {awaiting && (
              <>
                We are waiting for your bank to confirm the payment. This page
                updates as soon as it does — your reference is {booking.reference}.
              </>
            )}
            {!confirmed && !awaiting && (
              <>This appointment is {booking.status.replace(/_/g, " ")}.</>
            )}
          </p>
        </div>

        <dl className="mt-10 grid gap-3 rounded-[6px] border border-line px-6 py-6 text-[15px]">
          <Row label="Service" value={service?.name ?? "—"} />
          <Row label="Stylist" value={staff?.display_name ?? "—"} />
          <Row label="When" value={formatWhenLong(booking.starts_at, tz)} />
          <Row label="Where" value={address} />
          <Row label="Deposit paid" value={formatPence(booking.deposit_paid_pence)} />
          <div className="flex justify-between gap-4 border-t border-line pt-3">
            <dt className="text-muted">Balance in salon</dt>
            <dd className="text-right">
              {formatPence(outstanding)}
              {booking.pricing_mode === "from" && " onwards"}
            </dd>
          </div>
        </dl>

        {service?.preparation_instructions && (
          <div className="mt-6 rounded-[6px] border border-line bg-sand px-6 py-5">
            <h2 className="mb-2 text-[13px] tracking-[0.12em] text-sage uppercase">
              Before you come
            </h2>
            <p className="text-[14px] leading-[1.7] text-muted">
              {service.preparation_instructions}
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <AddToCalendar
            title={`${service?.name ?? "Appointment"} at ${salon.name}`}
            startsAt={booking.starts_at}
            endsAt={booking.ends_at}
            location={address}
            description={`Reference ${booking.reference}. Stylist: ${staff?.display_name ?? "TBC"}.`}
          />
          {salon.google_maps_url && (
            <Button asChild variant="outline" size="sm">
              <a href={salon.google_maps_url} target="_blank" rel="noopener noreferrer">
                Get directions →
              </a>
            </Button>
          )}
          <Button asChild variant="outline" size="sm">
            <Link href="/account/bookings">Manage booking</Link>
          </Button>
        </div>

        <p className="mt-10 text-center text-[13px] leading-[1.7] text-muted">
          Need to change something? You can reschedule or cancel from{" "}
          <Link href="/account/bookings" className="underline underline-offset-2">
            your account
          </Link>
          , or read our{" "}
          <Link href="/policies" className="underline underline-offset-2">
            cancellation policy
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
