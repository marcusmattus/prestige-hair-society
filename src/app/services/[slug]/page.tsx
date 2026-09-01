import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { SiteHeader } from "@/components/sections/SiteHeader";
import { Button } from "@/components/ui/button";
import { appUrl } from "@/lib/env";
import { formatPrice } from "@/lib/money";
import {
  getEligibleStaff,
  getSalon,
  getServiceAddons,
  getServiceBySlug,
} from "@/lib/salon";
import { getPublicSlugs } from "@/lib/supabase/static";
import { formatDuration } from "@/lib/time";

export const revalidate = 300;

export async function generateStaticParams() {
  // Build time has no request, so this uses the session-less anon client.
  const slugs = await getPublicSlugs("services");
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);
  if (!service) return { title: "Service not found" };

  return {
    title: service.name,
    description: service.short_description ?? service.description.slice(0, 160),
    alternates: { canonical: `${appUrl}/services/${service.slug}` },
    openGraph: {
      title: `${service.name} — Prestige Hair Society`,
      description: service.short_description ?? undefined,
      url: `${appUrl}/services/${service.slug}`,
      type: "website",
    },
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);
  if (!service) notFound();

  const [salon, stylists, addons] = await Promise.all([
    getSalon(),
    getEligibleStaff(service.id),
    getServiceAddons(service.id),
  ]);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.name,
    description: service.description,
    url: `${appUrl}/services/${service.slug}`,
    provider: {
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

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: appUrl },
      { "@type": "ListItem", position: 2, name: "Services", item: `${appUrl}/services` },
      {
        "@type": "ListItem",
        position: 3,
        name: service.name,
        item: `${appUrl}/services/${service.slug}`,
      },
    ],
  };

  return (
    <>
      <SiteHeader />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />

      <main>
        <div className="border-b border-line bg-sand">
          <div className="mx-auto max-w-[860px] px-5 py-14 md:px-10 lg:py-20">
            <nav aria-label="Breadcrumb" className="mb-6 text-[13px] text-muted">
              <Link href="/services" className="hover:text-ink">
                Services
              </Link>
              <span aria-hidden="true"> / </span>
              <span aria-current="page">{service.name}</span>
            </nav>

            <h1 className="mb-5 font-serif text-[40px] leading-[1.05] font-light md:text-[52px]">
              {service.name}
            </h1>

            <div className="mb-7 flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-muted">
              <span>{formatDuration(service.duration_minutes)}</span>
              <span className="text-moss">
                {formatPrice(service.base_price_pence, service.pricing_mode)}
              </span>
              {service.deposit_pence > 0 && (
                <span>{formatPrice(service.deposit_pence)} deposit</span>
              )}
            </div>

            <Button asChild size="md">
              <Link href={`/book?service=${service.slug}`}>Book this service</Link>
            </Button>
          </div>
        </div>

        <div className="mx-auto max-w-[860px] px-5 py-14 md:px-10 lg:py-20">
          <p className="mb-10 text-[17px] leading-[1.75] text-muted">
            {service.description}
          </p>

          {service.requires_consultation && (
            <div className="mb-10 rounded-[6px] border border-gold px-6 py-5">
              <h2 className="mb-1.5 font-serif text-[20px]">Consultation first</h2>
              <p className="text-[15px] leading-[1.7] text-muted">
                This service needs a consultation before it can be booked, so we
                can assess your hair and agree a plan and a price.
              </p>
            </div>
          )}

          <div className="grid gap-8 md:grid-cols-2">
            {service.preparation_instructions && (
              <section>
                <h2 className="mb-3 text-[12px] tracking-[0.18em] text-sage uppercase">
                  Before you come
                </h2>
                <p className="text-[15px] leading-[1.75] text-muted">
                  {service.preparation_instructions}
                </p>
              </section>
            )}

            {service.aftercare_instructions && (
              <section>
                <h2 className="mb-3 text-[12px] tracking-[0.18em] text-sage uppercase">
                  Aftercare
                </h2>
                <p className="text-[15px] leading-[1.75] text-muted">
                  {service.aftercare_instructions}
                </p>
              </section>
            )}
          </div>

          {addons.length > 0 && (
            <section className="mt-12">
              <h2 className="mb-4 font-serif text-[26px] font-light">Add to it</h2>
              <ul className="grid gap-3">
                {addons.map((addon) => (
                  <li
                    key={addon.id}
                    className="flex items-start justify-between gap-4 rounded-[6px] border border-line px-5 py-4"
                  >
                    <div>
                      <div className="text-[15px]">{addon.name}</div>
                      {addon.description && (
                        <p className="mt-0.5 text-[14px] text-muted">{addon.description}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right text-[14px] text-moss">
                      {formatPrice(addon.price_pence)}
                      {addon.duration_minutes > 0 && (
                        <span className="block text-muted">+{addon.duration_minutes} min</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {stylists.length > 0 && (
            <section className="mt-12">
              <h2 className="mb-4 font-serif text-[26px] font-light">Who does this</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {stylists.map((person) => (
                  <li key={person.id}>
                    <Link
                      href={`/stylists/${person.slug}`}
                      className="block rounded-[6px] border border-line px-5 py-4 transition-colors hover:border-gold"
                    >
                      <div className="font-serif text-[20px]">{person.display_name}</div>
                      {person.title && (
                        <div className="mt-0.5 text-[12px] tracking-[0.06em] text-gold uppercase">
                          {person.title}
                        </div>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-14 border-t border-line pt-8">
            <Button asChild size="md">
              <Link href={`/book?service=${service.slug}`}>Book {service.name}</Link>
            </Button>
            <p className="mt-4 text-[13px] leading-[1.7] text-muted">
              Prices and durations are placeholders pending verification against
              the salon&rsquo;s live catalogue. See our{" "}
              <Link href="/policies" className="underline underline-offset-2">
                cancellation policy
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
