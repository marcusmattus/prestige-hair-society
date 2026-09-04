import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Prose } from "@/components/sections/PageHeader";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { SiteHeader } from "@/components/sections/SiteHeader";
import { appUrl } from "@/lib/env";
import { getSalon } from "@/lib/salon";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "Terms of use for the Prestige Hair Society website and booking service.",
  alternates: { canonical: `${appUrl}/terms` },
};

export const revalidate = 300;

export default async function TermsPage() {
  const salon = await getSalon();

  return (
    <>
      <SiteHeader />
      <main>
        <PageHeader
          eyebrow="Terms"
          title="Terms of use."
          lede="The rules that apply when you use this site to book an appointment."
        />

        <Prose>
          <h2>Who you are contracting with</h2>
          <p>
            This site is operated by {salon?.name ?? "Prestige Hair Society"} of{" "}
            {salon
              ? `${salon.address_line1}, ${salon.city} ${salon.postcode}`
              : "2 Queens Road, Battersea, London"}
            . Booking an appointment forms a contract between you and the salon.
          </p>

          <h2>Your account</h2>
          <p>
            You are responsible for what happens under your account and for
            keeping your sign-in details to yourself. Tell us promptly if you
            think someone else has access to it. You must be 16 or over to hold
            an account; under-16s are welcome in the salon but should be booked
            in by a parent or guardian.
          </p>
          <p>
            Give us accurate contact details. If your reminders go to an old
            number and you miss an appointment, our{" "}
            <Link href="/policies">cancellation policy</Link> still applies.
          </p>

          <h2>Bookings</h2>
          <p>
            An appointment is confirmed only when your deposit payment has been
            verified — not when your browser returns from the payment page. You
            will always receive a confirmation by email and, where you have
            given us a number, by SMS. If you do not receive one, treat the
            appointment as unconfirmed and contact us.
          </p>
          <p>
            Deposits, changes and cancellations are covered by our{" "}
            <Link href="/policies">cancellation policy</Link>, which forms part
            of these terms.
          </p>

          <h2>Prices</h2>
          <p>
            Prices shown are the price of the service at the time you book, and
            that is what you pay. Where a price is shown as
            &ldquo;from&rdquo;, the final figure depends on your hair — its
            length, density and condition — and is confirmed by your stylist at
            consultation, before any work begins. You are free to decline at
            that point and pay nothing beyond a consultation fee where one
            applies.
          </p>
          <p>
            The catalogue on this site is being migrated from our previous
            booking system. Where a price is marked as a placeholder it has not
            yet been verified, and the price confirmed in the salon takes
            precedence.
          </p>

          <h2>Services and safety</h2>
          <p>
            We may decline or modify a service where we judge it would damage
            your hair or scalp, where a required patch test has not been done,
            or where the condition of your hair differs materially from what was
            described at booking. Where we decline for safety reasons your
            deposit is refunded.
          </p>
          <p>
            Tell us about allergies, sensitivities, medication and recent
            chemical services. We rely on what you tell us, and we cannot be
            responsible for a reaction arising from information that was not
            disclosed.
          </p>

          <h2>Using this site</h2>
          <p>
            Do not attempt to interfere with the site, access accounts or data
            that are not yours, or use automated tools to hold appointment slots.
            Slot holds exist so real customers can complete a payment; holding
            slots you do not intend to book takes appointments away from people
            who want them.
          </p>
          <p>
            The content of this site — text, photographs and branding — belongs
            to the salon and may not be reproduced without permission.
          </p>

          <h2>Liability</h2>
          <p>
            Nothing in these terms limits our liability for death or personal
            injury caused by negligence, for fraud, or for anything else that
            cannot lawfully be limited. Your statutory rights as a consumer are
            not affected.
          </p>
          <p>
            Subject to that, we are not liable for indirect or consequential
            loss, and our liability in connection with any appointment is
            limited to the amount you paid for it.
          </p>

          <h2>Changes</h2>
          <p>
            We may update these terms. The version that applies to your
            appointment is the one in force when you booked it, and material
            changes will be notified by email before they take effect.
          </p>

          <h2>Governing law</h2>
          <p>
            These terms are governed by the law of England and Wales, and the
            courts of England and Wales have exclusive jurisdiction.
          </p>

          <hr className="my-10 border-line" />
          <p className="text-[14px]">
            <strong>Draft for review.</strong> These terms describe how the
            booking system actually behaves. They have not been reviewed by a
            solicitor, and they should be before launch.
          </p>
        </Prose>
      </main>
      <SiteFooter />
    </>
  );
}
