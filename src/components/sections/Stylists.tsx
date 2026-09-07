import Link from "next/link";
import { SlotImage } from "@/components/sections/SlotImage";
import { getSiteImages, stylistSlot } from "@/lib/images";
import { getStaff } from "@/lib/salon";

/**
 * The design's three placeholder cards, shown only while the salon has no
 * stylists in the catalogue. Real stylists replace them entirely.
 */
const FALLBACK = [
  {
    id: "f1",
    name: "Stylist name",
    role: "Senior stylist",
    body: "Silk press, precision cutting and textured hair care.",
    href: null,
    slot: null,
  },
  {
    id: "f2",
    name: "Stylist name",
    role: "Colour specialist",
    body: "Balayage, grey blending and colour correction.",
    href: null,
    slot: null,
  },
  {
    id: "f3",
    name: "Stylist name",
    role: "Protective styling",
    body: "Braiding, extensions and long-term scalp health.",
    href: null,
    slot: null,
  },
];

export async function Stylists() {
  const [staff, images] = await Promise.all([getStaff(), getSiteImages()]);

  // Both shapes normalised to one, so the card below has a single branch.
  const cards =
    staff.length > 0
      ? staff.slice(0, 3).map((person) => ({
          id: person.id,
          name: person.display_name,
          role: person.title ?? "Stylist",
          body: person.bio ?? "",
          href: `/stylists/${person.slug}`,
          slot: stylistSlot(person.slug),
        }))
      : FALLBACK;

  return (
    <section id="stylists" className="bg-sand">
      <div className="mx-auto max-w-[1280px] px-5 py-[72px] md:px-10 lg:py-[104px]">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-4 text-[12px] tracking-[0.22em] text-sage uppercase">
              The team
            </div>
            <h2 className="font-serif text-[34px] font-light md:text-[46px]">
              Stylists who specialise.
            </h2>
          </div>
          <Link href="/stylists" className="text-[14px] text-moss">
            All stylists →
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-[26px] sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => {
            const portrait = (
              <SlotImage
                image={card.slot ? images.get(card.slot) : null}
                placeholderLabel="stylist portrait"
                stripe="stripe-deep"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 400px"
                className="h-[340px] rounded-t-[180px] rounded-b-[6px] lg:h-[400px]"
              />
            );

            return (
              <article key={card.id}>
                {card.href ? (
                  <Link href={card.href} className="group block">
                    {portrait}
                    <h3 className="mt-[22px] mb-1.5 font-serif text-[26px] font-normal group-hover:text-gold">
                      {card.name}
                    </h3>
                  </Link>
                ) : (
                  <>
                    {portrait}
                    <h3 className="mt-[22px] mb-1.5 font-serif text-[26px] font-normal">
                      {card.name}
                    </h3>
                  </>
                )}

                <div className="mb-2.5 text-[13px] tracking-[0.06em] text-gold uppercase">
                  {card.role}
                </div>
                {card.body && (
                  <p className="text-[14px] leading-[1.65] text-muted">{card.body}</p>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
