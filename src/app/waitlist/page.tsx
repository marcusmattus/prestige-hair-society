import type { Metadata } from "next";
import Link from "next/link";
import { WaitlistForm } from "@/components/booking/WaitlistForm";
import { PageHeader } from "@/components/sections/PageHeader";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { SiteHeader } from "@/components/sections/SiteHeader";
import { getSessionUser } from "@/lib/auth/roles";
import { getSalon, getServices, getStaff } from "@/lib/salon";
import { addDaysToSalonDate, toSalonDate } from "@/lib/time";

export const metadata: Metadata = {
  title: "Waiting list",
  description:
    "Nothing free that suits you? Join the waiting list and we will email you when a cancellation matches.",
  robots: { index: false, follow: true },
};

export const dynamic = "force-dynamic";

export default async function WaitlistPage({
  searchParams,
}: {
  searchParams: Promise<{
    service?: string;
    serviceId?: string;
    stylist?: string;
    staffId?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const query = await searchParams;
  const [salon, services, staff, user] = await Promise.all([
    getSalon(),
    getServices(),
    getStaff(),
    getSessionUser(),
  ]);

  const tz = salon?.timezone ?? "Europe/London";
  const today = toSalonDate(new Date(), tz);
  const windowDays = salon?.booking_window_days ?? 60;
  const horizon = addDaysToSalonDate(today, windowDays);

  // Prefill from whatever the customer had already chosen. /book links by id;
  // the public pages link by slug.
  const service =
    services.find((s) => s.id === query.serviceId) ??
    services.find((s) => s.slug === query.service);
  const stylist =
    staff.find((s) => s.id === query.staffId) ??
    staff.find((s) => s.slug === query.stylist);

  return (
    <>
      <SiteHeader signedIn={!!user} />
      <main>
        <PageHeader
          eyebrow="Waiting list"
          title="Tell us when would work."
          lede="Cancellations happen most days. Give us your window and we will email you the moment one matches — first come, first served."
        />

        <div className="mx-auto max-w-[720px] px-5 py-14 md:px-10 lg:py-20">
          {services.length === 0 ? (
            <p className="text-[15px] text-muted">
              The catalogue is not available at the moment. Please{" "}
              <Link href="/contact" className="text-moss underline">
                contact the salon
              </Link>
              .
            </p>
          ) : (
            <WaitlistForm
              signedIn={!!user}
              services={services.map((s) => ({ id: s.id, name: s.name }))}
              stylists={staff
                .filter((s) => s.is_bookable)
                .map((s) => ({ id: s.id, name: s.display_name }))}
              defaults={{
                serviceId: service?.id ?? services[0]?.id,
                staffId: stylist?.id,
                earliestDate: query.from ?? today,
                latestDate: query.to ?? horizon,
                firstName: user?.profile.first_name,
                lastName: user?.profile.last_name,
                email: user?.email,
                phone: user?.profile.phone ?? undefined,
              }}
            />
          )}

          <p className="mt-8 text-[14px] leading-[1.7] text-muted">
            Would you rather look again first?{" "}
            <Link href="/book" className="text-moss underline">
              See current availability
            </Link>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
