import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader, Prose } from "@/components/sections/PageHeader";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { SiteHeader } from "@/components/sections/SiteHeader";
import { appUrl } from "@/lib/env";
import { getSalon } from "@/lib/salon";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Prestige Hair Society collects, why, how long it is kept and how to get it removed.",
  alternates: { canonical: `${appUrl}/privacy` },
};

export const revalidate = 300;

export default async function PrivacyPage() {
  const salon = await getSalon();

  return (
    <>
      <SiteHeader />
      <main>
        <PageHeader
          eyebrow="Privacy"
          title="What we hold, and why."
          lede="We collect what is needed to give you an appointment and look after your hair properly. Nothing here is sold, and nothing is shared for advertising."
        />

        <Prose>
          <h2>Who is responsible</h2>
          <p>
            {salon?.name ?? "Prestige Hair Society"} of{" "}
            {salon
              ? `${salon.address_line1}, ${salon.city} ${salon.postcode}`
              : "2 Queens Road, Battersea, London"}{" "}
            is the data controller for the information described here.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Contact details</strong> — name, email address and mobile
              number, so we can confirm and remind you about appointments.
            </li>
            <li>
              <strong>Appointment history</strong> — what you booked, with whom,
              when, and what it cost.
            </li>
            <li>
              <strong>Hair information</strong> — your goals, and the notes and
              formulas your stylist records so your next visit picks up where
              the last one left off.
            </li>
            <li>
              <strong>Health information you choose to give us</strong> —
              allergies, sensitivities and accessibility requirements. This is
              special-category data under UK GDPR. You never have to provide it;
              we ask because a scalp reaction is worse than an awkward question.
              We rely on your explicit consent, and you can remove it at any
              time from{" "}
              <Link href="/account/profile">your profile</Link>.
            </li>
            <li>
              <strong>Payment records</strong> — the amount, the date and the
              last four digits of the card. We never see or store full card
              numbers; those go directly to Stripe, our payment processor.
            </li>
            <li>
              <strong>Photographs</strong> — only where you have given written
              consent, and only published where you have agreed to that
              separately.
            </li>
          </ul>

          <h2>Why we are allowed to hold it</h2>
          <ul>
            <li>
              <strong>Performing our contract with you</strong> — your booking,
              your deposit, your appointment reminders.
            </li>
            <li>
              <strong>Legitimate interests</strong> — running the salon, keeping
              records of what was done to your hair, preventing repeated
              no-shows.
            </li>
            <li>
              <strong>Legal obligation</strong> — keeping financial records for
              HMRC.
            </li>
            <li>
              <strong>Consent</strong> — marketing messages, health information
              and photography. Each is asked for separately and each can be
              withdrawn on its own.
            </li>
          </ul>

          <h2>Marketing</h2>
          <p>
            Appointment confirmations and reminders are part of the service and
            are sent whether or not you opt into marketing. Marketing email and
            SMS are opt-in, separately, and every marketing message carries an
            unsubscribe link. You can change either at any time in{" "}
            <Link href="/account/preferences">your preferences</Link>.
          </p>

          <h2>Who else sees it</h2>
          <p>
            Our processors, and no one else: Supabase (database and
            authentication, EU region), Stripe (payments), Resend (email),
            Twilio (SMS) and Vercel (hosting). Each is bound by a data
            processing agreement. We do not sell data, and we do not share it
            with advertisers.
          </p>

          <h2>How long we keep it</h2>
          <ul>
            <li>
              <strong>Appointment and treatment records</strong> — six years
              after your last visit. Colour and chemical service history matters
              years later, and financial records must be kept for six years.
            </li>
            <li>
              <strong>Health information</strong> — deleted as soon as you
              withdraw consent, or with your account.
            </li>
            <li>
              <strong>Photographs</strong> — until you ask us to remove them.
            </li>
            <li>
              <strong>Marketing consent records</strong> — kept for as long as
              you are subscribed, plus two years, so we can prove consent was
              given.
            </li>
            <li>
              <strong>Abandoned bookings</strong> — slot holds are deleted
              automatically within the hour.
            </li>
          </ul>

          <h2>Your rights</h2>
          <p>
            You can ask us for a copy of everything we hold about you, to
            correct it, to delete it, to restrict what we do with it, or to
            object to it. Most of it you can see and change yourself in{" "}
            <Link href="/account">your account</Link>. For anything else, ask
            us and we will respond within one month.
          </p>
          <p>
            Deleting your account removes your personal details. Financial
            records of completed transactions are retained where the law
            requires, with your identifying details removed.
          </p>
          <p>
            If we get it wrong, you can complain to the Information
            Commissioner&rsquo;s Office at{" "}
            <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer">
              ico.org.uk
            </a>
            .
          </p>

          <h2>Cookies and analytics</h2>
          <p>
            We set a cookie to keep you signed in, and one to remember an
            in-progress booking. Both are necessary for the site to work.
            Analytics, where enabled, is loaded only after you accept it, and
            declining changes nothing about your ability to book.
          </p>

          <hr className="my-10 border-line" />
          <p className="text-[14px]">
            <strong>Draft for review.</strong> This notice describes what the
            system actually does — the retention periods match{" "}
            <code>docs/PRIVACY.md</code> and the deletion routines in the
            codebase. It has not been reviewed by a solicitor or a data
            protection adviser, and it should be before launch.
          </p>
        </Prose>
      </main>
      <SiteFooter />
    </>
  );
}
