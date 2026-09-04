import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/sections/PageHeader";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { SiteHeader } from "@/components/sections/SiteHeader";
import { Button } from "@/components/ui/button";
import { appUrl } from "@/lib/env";
import { formatPrice } from "@/lib/money";
import {
  getNextAvailableSlot,
  getSalon,
  getStaffBySlug,
  getStaffServices,
} from "@/lib/salon";
import { getPublicSlugs } from "@/lib/supabase/static";
import { formatDurationShort, formatWhenLong } from "@/lib/time";

export const revalidate = 300;

export async function generateStaticParams() {
  // Build time has no request, so this uses the session-less anon client.
  const slugs = await getPublicSlugs("staff");
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const person = await getStaffBySlug(slug);
  if (!person) return { title: "Stylist not found" };

  return {
    title: `${person.display_name}${person.title ? ` — ${person.title}` : ""}`,
    description:
      person.bio ??
      `Book ${person.display_name} at Prestige Hair Society in Battersea, London.`,
    alternates: { canonical: `${appUrl}/stylists/${person.slug}` },
    openGraph: {
      title: person.display_name,
      description: person.bio ?? undefined,
      url: `${appUrl}/stylists/${person.slug}`,
      type: "profile",
    },
  };
}

export default async function StylistPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const person = await getStaffBySlug(slug);
  if (!person) notFound();

  const [salon, services] = await Promise.all([
    getSalon(),
    getStaffServices(person.id),
  ]);

  // Next availability for this stylist's first bookable service, so the page
  // answers "when could I actually see them?" rather than only "who are they?".
  const nextSlot = services[0]
    ? await getNextAvailableSlot(services[0].id, person.id)
    : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: person.display_name,
    jobTitle: person.title ?? undefined,
    description: person.bio ?? undefined,
    knowsAbout: person.specialties,
    url: `${appUrl}/stylists/${person.slug}`,
    worksFor: {
      "@type": "HairSalon",
      name: salon?.name ?? "Prestige Hair Society",
      address: salon
        ? {
            "@type": "PostalAddress",
            streetAddress: salon.address_line1,
            addressLocality: salon.city,
            postalCode: salon.postcode,
            addressCountry: salon.country_code,
          }
        : undefined,
    },
  };

  return (
    <>
      <SiteHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main>
        <PageHeader
          eyebrow={person.title ?? "Stylist"}
          title={person.display_name}
          lede={person.bio}
        >
          <nav aria-label="Breadcrumb" className="mt-6 text-[13px] text-muted">
            <Link href="/stylists" className="hover:text-gold">
              ← All stylists
            </Link>
          </nav>
        </PageHeader>

        <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 px-5 py-14 md:px-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:py-20">
          <div>
            <div className="stripe-deep flex h-[380px] items-end justify-center rounded-t-[180px] rounded-b-[6px] pb-[26px] lg:h-[460px]">
              <span className="font-mono text-[11px] tracking-[0.12em] text-sage uppercase">
                stylist portrait
              </span>
            </div>

            {person.specialties.length > 0 && (
              <>
                <h2 className="mt-8 mb-3 text-[12px] tracking-[0.18em] text-sage uppercase">
                  Specialisms
                </h2>
                <ul className="flex flex-wrap gap-1.5">
                  {person.specialties.map((specialty) => (
                    <li
                      key={specialty}
                      className="rounded-full border border-line px-3 py-1 text-[13px] text-muted"
                    >
                      {specialty}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          <div>
            {person.is_bookable ? (
              <div className="mb-10 rounded-[6px] border border-line bg-sand px-6 py-6">
                <div className="mb-2 text-[12px] tracking-[0.14em] text-sage uppercase">
                  Next available
                </div>
                <div className="font-serif text-[27px] leading-[1.15]">
                  {nextSlot
                    ? formatWhenLong(nextSlot.slot_start, salon?.timezone)
                    : "By arrangement"}
                </div>
                <p className="mt-1.5 mb-5 text-[13px] text-muted">
                  {nextSlot
                    ? `for ${services[0]?.name}`
                    : "No online availability in the current booking window."}
                </p>
                <Button asChild>
                  <Link href={`/book?stylist=${person.slug}`}>
                    Book with {person.display_name.split(" ")[0]}
                  </Link>
                </Button>
              </div>
            ) : (
              <p className="mb-10 rounded-[6px] border border-line bg-sand px-6 py-5 text-[14px] leading-[1.7] text-muted">
                {person.display_name} is not taking online bookings at the
                moment.{" "}
                <Link href="/contact" className="text-moss underline">
                  Contact the salon
                </Link>{" "}
                to enquire.
              </p>
            )}

            <h2 className="mb-5 font-serif text-[30px] font-light">
              Services {person.display_name.split(" ")[0]} offers
            </h2>

            {services.length === 0 ? (
              <p className="text-[15px] text-muted">
                No services are currently assigned to this stylist.
              </p>
            ) : (
              <ul className="grid gap-3">
                {services.map((service) => (
                  <li key={service.id}>
                    <Link
                      href={`/book?service=${service.slug}&stylist=${person.slug}`}
                      className="flex items-center justify-between gap-4 rounded-[6px] border border-line px-6 py-5 transition-colors hover:border-gold"
                    >
                      <span>
                        <span className="block font-serif text-[21px]">
                          {service.name}
                        </span>
                        <span className="mt-1 block text-[13px] text-muted">
                          {formatDurationShort(service.duration_minutes)}
                          {service.requires_consultation && " · consultation first"}
                        </span>
                      </span>
                      <span className="shrink-0 text-[14px] text-moss">
                        {formatPrice(service.base_price_pence, service.pricing_mode)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
