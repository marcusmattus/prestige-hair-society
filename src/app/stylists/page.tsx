import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/sections/PageHeader";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { SiteHeader } from "@/components/sections/SiteHeader";
import { Button } from "@/components/ui/button";
import { appUrl } from "@/lib/env";
import { getSalon, getStaff } from "@/lib/salon";

export const metadata: Metadata = {
  title: "Stylists",
  description:
    "Meet the stylists at Prestige Hair Society in Battersea — specialists in silk press, colour, protective styling and treatments.",
  alternates: { canonical: `${appUrl}/stylists` },
};

export const revalidate = 300;

export default async function StylistsPage() {
  const [salon, staff] = await Promise.all([getSalon(), getStaff()]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: staff.map((person, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Person",
        name: person.display_name,
        jobTitle: person.title ?? undefined,
        description: person.bio ?? undefined,
        url: `${appUrl}/stylists/${person.slug}`,
        worksFor: { "@type": "HairSalon", name: salon?.name ?? "Prestige Hair Society" },
      },
    })),
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
          eyebrow="The team"
          title="Stylists who specialise."
          lede="Everyone here has a specialism rather than a general list. Book the person whose work matches what you want, or let us match you at your consultation."
        />

        <div className="mx-auto max-w-[1280px] px-5 py-14 md:px-10 lg:py-20">
          <ul className="grid grid-cols-1 gap-x-[26px] gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
            {staff.map((person) => (
              <li key={person.id}>
                <article>
                  <Link
                    href={`/stylists/${person.slug}`}
                    className="group block"
                    aria-label={`${person.display_name}, ${person.title ?? "stylist"}`}
                  >
                    <div className="stripe-deep flex h-[340px] items-end justify-center rounded-t-[180px] rounded-b-[6px] pb-[26px] transition-opacity group-hover:opacity-90 lg:h-[400px]">
                      <span className="font-mono text-[11px] tracking-[0.12em] text-sage uppercase">
                        stylist portrait
                      </span>
                    </div>
                    <h2 className="mt-[22px] mb-1.5 font-serif text-[26px] font-normal group-hover:text-gold">
                      {person.display_name}
                    </h2>
                  </Link>

                  {person.title && (
                    <div className="mb-2.5 text-[13px] tracking-[0.06em] text-gold uppercase">
                      {person.title}
                    </div>
                  )}
                  {person.bio && (
                    <p className="mb-4 text-[14px] leading-[1.65] text-muted">
                      {person.bio}
                    </p>
                  )}

                  {person.specialties.length > 0 && (
                    <ul className="mb-4 flex flex-wrap gap-1.5">
                      {person.specialties.map((specialty) => (
                        <li
                          key={specialty}
                          className="rounded-full border border-line px-3 py-1 text-[12px] text-muted"
                        >
                          {specialty}
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/stylists/${person.slug}`}>Profile</Link>
                    </Button>
                    {person.is_bookable && (
                      <Button asChild size="sm">
                        <Link href={`/book?stylist=${person.slug}`}>Book</Link>
                      </Button>
                    )}
                  </div>
                </article>
              </li>
            ))}
          </ul>

          {staff.length === 0 && (
            <p className="text-[15px] text-muted">
              Stylist profiles are being prepared. Please{" "}
              <Link href="/contact" className="text-moss underline">
                get in touch
              </Link>{" "}
              in the meantime.
            </p>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
