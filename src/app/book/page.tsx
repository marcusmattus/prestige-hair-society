import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { SiteHeader } from "@/components/sections/SiteHeader";
import { getSessionUser } from "@/lib/auth/roles";
import { getBookingCatalogue } from "@/lib/salon";

export const metadata: Metadata = {
  title: "Book an appointment",
  description:
    "Choose your service, stylist and time, and secure your appointment with a deposit.",
  // A booking funnel has nothing to offer a search engine and should not
  // compete with /services for the same queries.
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string; stylist?: string }>;
}) {
  const params = await searchParams;
  const [catalogue, user] = await Promise.all([getBookingCatalogue(), getSessionUser()]);

  if (!catalogue) notFound();

  // Deep links from /services/[slug] and /stylists/[slug] arrive as slugs.
  const service = params.service
    ? catalogue.services.find((s) => s.slug === params.service)
    : undefined;
  const stylist = params.stylist
    ? catalogue.staff.find((s) => s.slug === params.stylist)
    : undefined;

  return (
    <>
      <SiteHeader />
      <main>
        <div className="border-b border-line bg-sand">
          <div className="mx-auto max-w-[1280px] px-5 py-10 md:px-10 lg:py-14">
            <div className="mb-4 text-[12px] tracking-[0.22em] text-sage uppercase">
              Book an appointment
            </div>
            <h1 className="font-serif text-[36px] leading-[1.1] font-light md:text-[48px]">
              Two minutes, and it is yours.
            </h1>
          </div>
        </div>

        <BookingFlow
          catalogue={catalogue}
          signedIn={!!user}
          stripePublishableKey={process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? null}
          initialServiceId={service?.id}
          initialStaffId={stylist?.id}
          customerDefaults={
            user
              ? {
                  firstName: user.profile.first_name,
                  lastName: user.profile.last_name,
                  email: user.email,
                  phone: user.profile.phone ?? "",
                  hairGoals: user.profile.hair_goals ?? "",
                  accessibilityRequirements:
                    user.profile.accessibility_requirements ?? "",
                  marketingEmail: user.profile.marketing_email,
                  marketingSms: user.profile.marketing_sms,
                }
              : undefined
          }
        />
      </main>
      <SiteFooter />
    </>
  );
}
