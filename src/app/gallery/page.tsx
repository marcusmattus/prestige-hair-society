import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/sections/PageHeader";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { SiteHeader } from "@/components/sections/SiteHeader";
import { appUrl } from "@/lib/env";
import { SlotImage } from "@/components/sections/SlotImage";
import { GALLERY_SLOTS, gallerySlot, getSiteImages } from "@/lib/images";
import { getGallery, getServices } from "@/lib/salon";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "Before-and-after work from Prestige Hair Society, published only with written client consent.",
  alternates: { canonical: `${appUrl}/gallery` },
};

export const revalidate = 300;

/**
 * Only photographs whose `is_published` flag is set appear here, and the
 * database refuses to set that flag without a linked consent record
 * (client_photos_consent_required in migration 0008). The gate is structural,
 * not a convention this page is trusted to follow.
 */
export default async function GalleryPage() {
  const [photos, services, images] = await Promise.all([
    getGallery(24),
    getServices(),
    getSiteImages(),
  ]);

  // Salon photography, separate from the consent-gated before/after set.
  const salonShots = Array.from({ length: GALLERY_SLOTS }, (_, i) =>
    images.get(gallerySlot(i + 1)),
  ).filter((img) => img !== undefined);
  const serviceName = new Map(services.map((s) => [s.id, s.name]));

  return (
    <>
      <SiteHeader />
      <main>
        <PageHeader
          eyebrow="Our work"
          title="Before and after."
          lede="Published only with written client consent, and removed at any time on request."
        />

        <div className="mx-auto max-w-[1280px] px-5 py-14 md:px-10 lg:py-20">
          {salonShots.length > 0 && (
            <section className="mb-14">
              <h2 className="mb-5 text-[13px] tracking-[0.12em] text-sage uppercase">
                The salon
              </h2>
              <ul className="grid grid-cols-2 gap-[18px] lg:grid-cols-4">
                {salonShots.map((image, i) => (
                  <li key={image!.slot}>
                    <SlotImage
                      image={image}
                      placeholderLabel="salon"
                      stripe={i % 2 === 0 ? "stripe-warm" : "stripe-deep"}
                      sizes="(max-width: 640px) 50vw, 25vw"
                      className="aspect-3/4 rounded-[6px]"
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          <h2 className="mb-5 text-[13px] tracking-[0.12em] text-sage uppercase">
            Before and after
          </h2>

          {photos.length === 0 ? (
            // Honest empty state: placeholder tiles matching the design, clearly
            // labelled as such rather than dressed up as real work.
            <>
              <div className="grid grid-cols-2 gap-[18px] lg:grid-cols-4">
                {[
                  "before · silk press",
                  "after · silk press",
                  "before · colour",
                  "after · colour",
                  "before · protective styling",
                  "after · protective styling",
                  "before · treatment",
                  "after · treatment",
                ].map((label, i) => (
                  <div
                    key={label}
                    className={`${i % 2 === 0 ? "stripe-warm" : "stripe-deep"} flex aspect-3/4 items-end rounded-[6px] p-[18px]`}
                  >
                    <span className="font-mono text-[10px] tracking-[0.1em] text-sage uppercase">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-10 rounded-[6px] border border-line bg-sand px-6 py-5 text-[14px] leading-[1.7] text-muted">
                These are placeholders. Real before-and-after photography
                appears here once it has been uploaded in Studio against a
                recorded photo-publication consent.
              </p>
            </>
          ) : (
            <ul className="grid grid-cols-2 gap-[18px] lg:grid-cols-4">
              {photos.map((photo) => (
                <li key={photo.id}>
                  <figure>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.storage_path}
                      alt={
                        photo.caption ??
                        `${photo.kind} — ${
                          (photo.service_id && serviceName.get(photo.service_id)) ??
                          "salon work"
                        }`
                      }
                      loading="lazy"
                      className="aspect-3/4 w-full rounded-[6px] object-cover"
                    />
                    <figcaption className="mt-2 font-mono text-[10px] tracking-[0.1em] text-sage uppercase">
                      {photo.kind}
                      {photo.service_id && serviceName.get(photo.service_id)
                        ? ` · ${serviceName.get(photo.service_id)}`
                        : ""}
                    </figcaption>
                  </figure>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-8 text-[14px] leading-[1.7] text-muted">
            Would you like your results removed?{" "}
            <Link href="/contact" className="text-moss underline">
              Tell us
            </Link>{" "}
            and we will take them down, no reason needed.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
