import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/sections/PageHeader";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { SiteHeader } from "@/components/sections/SiteHeader";
import { Button } from "@/components/ui/button";
import { appUrl } from "@/lib/env";
import { SlotImage } from "@/components/sections/SlotImage";
import { getSiteImages, SLOTS } from "@/lib/images";
import { getSalon, getStaff } from "@/lib/salon";

export const metadata: Metadata = {
  title: "Our Salon",
  description:
    "Prestige Hair Society in Battersea: an assessment-first salon built around the long-term condition of your hair rather than a trend.",
  alternates: { canonical: `${appUrl}/about` },
};

export const revalidate = 300;

const PRINCIPLES = [
  {
    title: "Assessment before service",
    body: "Every appointment opens with an honest look at the condition of your hair and scalp. If what you have asked for would damage it, we will say so and offer the route that will not.",
  },
  {
    title: "Botanical products",
    body: "We choose products for how they leave the hair over months, not how they make it feel for an afternoon.",
  },
  {
    title: "Unhurried appointments",
    body: "Our columns are built with real durations and proper buffers, so nobody is rushed and nobody is kept waiting for a stylist who is still finishing.",
  },
  {
    title: "Aftercare you can follow",
    body: "You leave with a routine that fits the time you actually have, and product recommendations you are free to ignore.",
  },
];

export default async function AboutPage() {
  const [salon, staff, images] = await Promise.all([
    getSalon(),
    getStaff(),
    getSiteImages(),
  ]);

  return (
    <>
      <SiteHeader />
      <main>
        <PageHeader
          eyebrow="Our philosophy"
          title={<>Healthy hair is the only luxury worth chasing.</>}
          lede={
            salon?.about ??
            "A salon should give more back to your hair than it takes."
          }
        />

        <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-start gap-14 px-5 py-14 md:px-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:py-20">
          <SlotImage
            // Falls back to the homepage interior shot, so one photograph
            // serves both pages until the salon supplies a second.
            image={
              images.get(SLOTS.aboutInterior.key) ??
              images.get(SLOTS.salonInterior.key)
            }
            placeholderLabel="salon interior"
            priority
            sizes="(max-width: 1024px) 100vw, 520px"
            className="h-[420px] rounded-t-[220px] rounded-b-[6px] lg:h-[520px]"
          />

          <div>
            <h2 className="mb-6 font-serif text-[34px] leading-[1.12] font-light md:text-[40px]">
              How we work
            </h2>
            <dl className="grid gap-7">
              {PRINCIPLES.map((principle) => (
                <div key={principle.title} className="border-t border-line pt-5">
                  <dt className="mb-2 text-[15px] font-semibold">
                    {principle.title}
                  </dt>
                  <dd className="text-[15px] leading-[1.75] text-muted">
                    {principle.body}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-10 grid max-w-[560px] grid-cols-3 gap-[30px] border-t border-line pt-7">
              <div>
                <div className="font-serif text-[36px]">12</div>
                <div className="mt-1 text-[13px] text-muted">Years in Battersea</div>
              </div>
              <div>
                <div className="font-serif text-[36px]">{staff.length || 6}</div>
                <div className="mt-1 text-[13px] text-muted">Specialist stylists</div>
              </div>
              <div>
                <div className="font-serif text-[36px]">4.9</div>
                <div className="mt-1 text-[13px] text-muted">Average rating</div>
              </div>
            </div>
            <p className="mt-4 max-w-[560px] text-[13px] leading-[1.6] text-muted">
              Figures shown are placeholders pending verification.
            </p>
          </div>
        </div>

        <section className="bg-sand">
          <div className="mx-auto max-w-[1280px] px-5 py-14 text-center md:px-10 lg:py-20">
            <h2 className="mb-4 font-serif text-[34px] font-light md:text-[46px]">
              Come and see us.
            </h2>
            <p className="mx-auto mb-8 max-w-[520px] text-[16px] leading-[1.7] text-muted">
              {salon
                ? `${salon.address_line1}, ${salon.city}. A short walk from Clapham Junction.`
                : "2 Queens Road, Battersea, London."}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild size="lg">
                <Link href="/book">Book an appointment</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/stylists">Meet the stylists</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
