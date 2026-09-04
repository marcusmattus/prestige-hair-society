import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Prose } from "@/components/sections/PageHeader";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { SiteHeader } from "@/components/sections/SiteHeader";
import { appUrl } from "@/lib/env";
import { formatPrice } from "@/lib/money";
import { getSalon, getServices } from "@/lib/salon";

export const metadata: Metadata = {
  title: "Cancellation policy",
  description:
    "Deposits, cancellations, rescheduling and lateness at Prestige Hair Society.",
  alternates: { canonical: `${appUrl}/policies` },
};

export const revalidate = 300;

/**
 * The policy page reads its numbers from the salon record, so changing the
 * cancellation window in Studio changes what customers are told here and what
 * the booking flow enforces. The two can never drift apart.
 */
export default async function PoliciesPage() {
  const [salon, services] = await Promise.all([getSalon(), getServices()]);

  const cancellationHours = salon?.cancellation_window_hours ?? 24;
  const rescheduleHours = salon?.reschedule_window_hours ?? 24;
  const holdMinutes = salon?.hold_duration_minutes ?? 10;
  const noticeMinutes = salon?.min_notice_minutes ?? 120;
  const windowDays = salon?.booking_window_days ?? 60;

  const deposits = services
    .filter((s) => s.deposit_pence > 0)
    .map((s) => s.deposit_pence);
  const minDeposit = deposits.length ? Math.min(...deposits) : 0;
  const maxDeposit = deposits.length ? Math.max(...deposits) : 0;

  return (
    <>
      <SiteHeader />
      <main>
        <PageHeader
          eyebrow="Policies"
          title="Deposits and cancellations."
          lede="The short version: we hold your slot when you pay a deposit, and we ask for a day's notice if you need to change it."
        />

        <Prose>
          <h2>Booking and deposits</h2>
          <p>
            Appointments can be booked up to {windowDays} days ahead, and up to{" "}
            {noticeMinutes >= 60
              ? `${Math.round(noticeMinutes / 60)} hour${noticeMinutes >= 120 ? "s" : ""}`
              : `${noticeMinutes} minutes`}{" "}
            before the start time.
          </p>
          <p>
            Most services require a deposit
            {deposits.length > 0 && (
              <>
                {" "}
                of between {formatPrice(minDeposit)} and {formatPrice(maxDeposit)},
                depending on the service
              </>
            )}
            . The deposit comes off your final bill; the balance is settled in
            the salon.
          </p>
          <p>
            When you reach the payment step we hold your slot for{" "}
            {holdMinutes} minutes. If payment is not completed in that time the
            slot is released so somebody else can take it. Nothing is confirmed
            until your payment has been verified by our payment provider — a
            failed payment never produces a confirmed appointment.
          </p>

          <h2>Changing your appointment</h2>
          <p>
            You can reschedule free of charge up to {rescheduleHours} hours
            before your appointment, from{" "}
            <Link href="/account/bookings">your account</Link> or by contacting
            the salon. Your deposit moves with the booking.
          </p>
          <p>
            Inside {rescheduleHours} hours we will do our best to move you, but
            the slot may not be recoverable and the deposit may be retained.
          </p>

          <h2>Cancelling</h2>
          <p>
            Cancel more than {cancellationHours} hours before your appointment
            and your deposit is refunded in full, to the card you paid with,
            usually within five working days.
          </p>
          <p>
            Cancel within {cancellationHours} hours and the deposit is retained.
            It covers the stylist&rsquo;s time, which at that notice we cannot
            usually fill. You will always be told which applies{" "}
            <em>before</em> you confirm a cancellation.
          </p>

          <h2>Lateness and missed appointments</h2>
          <p>
            If you are running late, tell us — we will fit in what we can in the
            time remaining. More than 15 minutes late and we may need to
            shorten or rebook the service, because the columns behind you belong
            to other people.
          </p>
          <p>
            An appointment missed without notice is recorded as a no-show and
            the deposit is retained. Repeated no-shows may mean we ask for full
            payment up front in future.
          </p>

          <h2>Consultations and patch tests</h2>
          <p>
            Some services — colour in particular — require a patch test at least
            48 hours beforehand, and some require a consultation before they can
            be booked at all. Where that applies it is stated on the service
            page and in your confirmation. We cannot proceed without it, and an
            appointment lost for a missing patch test is treated as a
            late cancellation.
          </p>

          <h2>Refunds on services</h2>
          <p>
            If you are unhappy with your hair, tell us within seven days. We
            will book you back in with the stylist who did the work, or a senior
            colleague if you would prefer, and put it right at no charge.
          </p>

          <h2>Photography</h2>
          <p>
            We only publish before-and-after photographs where written consent
            has been given, and we remove them on request without asking why.
            See our <Link href="/privacy">privacy notice</Link>.
          </p>

          <hr className="my-10 border-line" />
          <p className="text-[14px]">
            <strong>Draft for review.</strong> This policy reflects how the
            booking system actually behaves, and its figures are read live from
            the salon&rsquo;s configuration. It has not been reviewed by a
            solicitor, and it should be before launch.
          </p>
        </Prose>
      </main>
      <SiteFooter />
    </>
  );
}
