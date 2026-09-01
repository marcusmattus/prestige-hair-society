import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { SiteHeader } from "@/components/sections/SiteHeader";
import { Button } from "@/components/ui/button";
import { appUrl } from "@/lib/env";
import { formatPrice } from "@/lib/money";
import { getCategories, getSalon, getServices } from "@/lib/salon";
import { formatDurationShort } from "@/lib/time";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Consultations, cutting, silk press, colour, protective styling, treatments and extensions at Prestige Hair Society in Battersea.",
  alternates: { canonical: `${appUrl}/services` },
};

export const revalidate = 300;

export default async function ServicesPage() {
  const [salon, categories, services] = await Promise.all([
    getSalon(),
    getCategories(),
    getServices(),
  ]);

  const byCategory = categories
    .map((category) => ({
      category,
      services: services.filter((s) => s.category_id === category.id),
    }))
    .filter((group) => group.services.length > 0);

  const uncategorised = services.filter((s) => !s.category_id);

  // Service schema for each offering, so search engines can surface the
  // catalogue. Prices are deliberately omitted: they are placeholders until
  // the verified Slick catalogue is imported, and publishing an unverified
  // price would be worse than publishing none.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: services.map((service, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Service",
        name: service.name,
        description: service.short_description ?? service.description,
        url: `${appUrl}/services/${service.slug}`,
        provider: { "@type": "HairSalon", name: salon?.name ?? "Prestige Hair Society" },
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
        <div className="border-b border-line bg-sand">
          <div className="mx-auto max-w-[1280px] px-5 py-14 md:px-10 lg:py-20">
            <div className="mb-4 text-[12px] tracking-[0.22em] text-sage uppercase">
              The catalogue
            </div>
            <h1 className="mb-5 font-serif text-[40px] leading-[1.05] font-light md:text-[56px]">
              Made for your hair.
            </h1>
            <p className="max-w-[560px] text-[16px] leading-[1.7] text-muted">
              Every service begins with an honest assessment. Where a price is
              shown as &ldquo;from&rdquo;, your stylist confirms the final
              figure at your consultation, before any work starts.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-[1280px] px-5 py-14 md:px-10 lg:py-20">
          {[...byCategory, ...(uncategorised.length ? [{ category: null, services: uncategorised }] : [])].map(
            (group) => (
              <section
                key={group.category?.id ?? "other"}
                className="mb-16 last:mb-0"
                aria-labelledby={`cat-${group.category?.slug ?? "other"}`}
              >
                <div className="mb-6 border-b border-line pb-4">
                  <h2
                    id={`cat-${group.category?.slug ?? "other"}`}
                    className="font-serif text-[30px] font-light"
                  >
                    {group.category?.name ?? "More services"}
                  </h2>
                  {group.category?.description && (
                    <p className="mt-1.5 text-[15px] text-muted">
                      {group.category.description}
                    </p>
                  )}
                </div>

                <ul className="grid gap-4 md:grid-cols-2">
                  {group.services.map((service) => (
                    <li key={service.id}>
                      <article className="flex h-full flex-col rounded-[6px] border border-line px-6 py-6 transition-colors hover:border-gold">
                        <div className="mb-2 flex items-baseline justify-between gap-4">
                          <h3 className="font-serif text-[24px]">
                            <Link
                              href={`/services/${service.slug}`}
                              className="hover:text-gold"
                            >
                              {service.name}
                            </Link>
                          </h3>
                          <span className="shrink-0 text-[14px] text-moss">
                            {formatPrice(service.base_price_pence, service.pricing_mode)}
                          </span>
                        </div>

                        <p className="mb-4 flex-1 text-[15px] leading-[1.65] text-muted">
                          {service.short_description ?? service.description}
                        </p>

                        <div className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
                          <span>{formatDurationShort(service.duration_minutes)}</span>
                          {service.deposit_pence > 0 && (
                            <span>{formatPrice(service.deposit_pence)} deposit</span>
                          )}
                          {service.requires_consultation && (
                            <span className="text-gold">Consultation first</span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Button asChild size="sm">
                            <Link href={`/book?service=${service.slug}`}>Book</Link>
                          </Button>
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/services/${service.slug}`}>Details</Link>
                          </Button>
                        </div>
                      </article>
                    </li>
                  ))}
                </ul>
              </section>
            ),
          )}

          <p className="mt-12 rounded-[6px] border border-line bg-sand px-6 py-5 text-[14px] leading-[1.7] text-muted">
            Prices and durations shown are placeholders pending verification
            against the salon&rsquo;s live catalogue.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
