import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/sections/PageHeader";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { SiteHeader } from "@/components/sections/SiteHeader";
import { Button } from "@/components/ui/button";
import { appUrl } from "@/lib/env";
import { getOpeningHours, getSalon } from "@/lib/salon";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Prestige Hair Society, 2 Queens Road, Battersea, London. Opening hours, directions and how to reach us.",
  alternates: { canonical: `${appUrl}/contact` },
};

export const revalidate = 300;

const DAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const SCHEMA_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

/** "10:00:00" -> "10:00" */
const hhmm = (time: string) => time.slice(0, 5);

export default async function ContactPage() {
  const [salon, hours] = await Promise.all([getSalon(), getOpeningHours()]);

  const openDays = hours.filter((h) => !h.is_closed);

  const jsonLd = salon
    ? {
        "@context": "https://schema.org",
        "@type": "HairSalon",
        name: salon.name,
        description: salon.tagline ?? undefined,
        url: appUrl,
        telephone: salon.phone ?? undefined,
        email: salon.email ?? undefined,
        address: {
          "@type": "PostalAddress",
          streetAddress: salon.address_line1,
          addressLocality: salon.city,
          postalCode: salon.postcode,
          addressCountry: salon.country_code,
        },
        geo:
          salon.latitude && salon.longitude
            ? {
                "@type": "GeoCoordinates",
                latitude: salon.latitude,
                longitude: salon.longitude,
              }
            : undefined,
        // Only genuinely open days are published; an unverified hour is worse
        // than no hour at all when someone is deciding whether to travel.
        openingHoursSpecification: openDays.map((h) => ({
          "@type": "OpeningHoursSpecification",
          dayOfWeek: `https://schema.org/${SCHEMA_DAYS[h.day_of_week - 1]}`,
          opens: hhmm(h.opens_at),
          closes: hhmm(h.closes_at),
        })),
        sameAs: [salon.instagram_url, salon.facebook_url].filter(Boolean),
      }
    : null;

  return (
    <>
      <SiteHeader />
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}

      <main>
        <PageHeader
          eyebrow="Visit us"
          title={
            salon ? (
              <>
                {salon.address_line1},
                <br />
                {salon.city}
              </>
            ) : (
              <>
                2 Queens Road,
                <br />
                Battersea, London
              </>
            )
          }
          lede="A short walk from Clapham Junction. Please arrive with dry, detangled hair unless your service notes say otherwise."
        />

        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 px-5 py-14 md:px-10 lg:grid-cols-2 lg:gap-20 lg:py-20">
          <div>
            <h2 className="mb-5 font-serif text-[30px] font-light">
              Getting here
            </h2>
            <address className="mb-6 text-[16px] leading-[1.8] text-muted not-italic">
              {salon?.address_line1 ?? "2 Queens Road"}
              <br />
              {salon?.address_line2 && (
                <>
                  {salon.address_line2}
                  <br />
                </>
              )}
              {salon?.city ?? "London"}
              <br />
              {salon?.postcode ?? "SW11"}
            </address>

            {salon?.phone && (
              <p className="mb-2 text-[15px]">
                <span className="text-muted">Telephone: </span>
                <a href={`tel:${salon.phone.replace(/\s/g, "")}`} className="text-moss underline">
                  {salon.phone}
                </a>
              </p>
            )}
            {salon?.email && (
              <p className="mb-6 text-[15px]">
                <span className="text-muted">Email: </span>
                <a href={`mailto:${salon.email}`} className="text-moss underline">
                  {salon.email}
                </a>
              </p>
            )}
            {!salon?.phone && !salon?.email && (
              <p className="mb-6 rounded-[6px] border border-line bg-sand px-5 py-4 text-[14px] leading-[1.7] text-muted">
                Telephone and email are not yet published. The quickest way to
                reach us is to{" "}
                <Link href="/book" className="text-moss underline">
                  book online
                </Link>
                ; your confirmation includes a reply-to address.
              </p>
            )}

            <div className="flex flex-wrap gap-3">
              {salon?.google_maps_url && (
                <Button asChild variant="outline">
                  <a
                    href={salon.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Get directions →
                  </a>
                </Button>
              )}
              <Button asChild>
                <Link href="/book">Book an appointment</Link>
              </Button>
            </div>
          </div>

          <div className="rounded-[6px] border border-line bg-cream px-6 py-8 sm:px-9">
            <h2 className="mb-[22px] text-[12px] tracking-[0.18em] text-sage uppercase">
              Opening hours
            </h2>
            <dl className="grid gap-3.5 text-[15px]">
              {(hours.length > 0
                ? hours
                : DAY_NAMES.map((_, i) => ({
                    id: String(i),
                    day_of_week: i + 1,
                    is_closed: true,
                    opens_at: "00:00:00",
                    closes_at: "00:00:00",
                  }))
              ).map((h) => (
                <div key={h.id} className="flex justify-between gap-4">
                  <dt>{DAY_NAMES[h.day_of_week - 1]}</dt>
                  <dd className="text-muted">
                    {h.is_closed
                      ? "Closed"
                      : `${hhmm(h.opens_at)} – ${hhmm(h.closes_at)}`}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 border-t border-line pt-5 text-[13px] leading-[1.6] text-muted">
              Hours shown are placeholders pending verification against the
              salon&rsquo;s live schedule. Bank holidays and one-off closures
              are applied automatically to online availability.
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
