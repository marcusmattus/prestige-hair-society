import {
  BookNowButton,
  ViewAvailabilityButton,
} from "@/components/BookNowButton";
import { SlotImage } from "@/components/sections/SlotImage";
import { getSiteImages, SLOTS } from "@/lib/images";

const PROMISES = [
  {
    title: "Personal consultations",
    body: "Every visit begins with a conversation.",
  },
  { title: "Secure deposits", body: "Card, Apple Pay and Google Pay." },
  {
    title: "Instant confirmation",
    body: "Email and SMS, the moment you book.",
  },
];

export async function Hero() {
  const images = await getSiteImages();

  return (
    <section id="top" className="relative overflow-hidden bg-sand">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-16 px-5 pt-16 pb-20 md:px-10 lg:grid-cols-2 lg:gap-[72px] lg:pt-24 lg:pb-[104px]">
        <div className="animate-fade-up">
          <div className="mb-7 text-[12px] tracking-[0.22em] text-sage uppercase">
            Battersea · London
          </div>
          {/* 78px is the design size; it only fits the half-column from 1280px up. */}
          <h1 className="mb-[30px] font-serif text-[44px] leading-[1.02] font-light tracking-[-0.015em] md:text-[60px] lg:text-[60px] xl:text-[78px]">
            Hair care,
            <br />
            elevated to an art.
          </h1>
          <div className="mb-[30px] h-px w-[84px] bg-gold" />
          <p className="mb-[38px] max-w-[430px] text-[17px] leading-[1.7] text-pretty text-muted">
            A calm, considered salon experience designed around your hair, your
            routine and how you want to feel.
          </p>
          <div className="mb-14 flex flex-wrap gap-4">
            <BookNowButton size="md">Book an appointment</BookNowButton>
            <a
              href="#services"
              className="inline-flex min-h-[48px] items-center rounded-[4px] border border-line px-[30px] py-[17px] text-[15px] text-ink transition-colors hover:border-gold hover:text-ink"
            >
              Explore services
            </a>
          </div>
          <div className="grid max-w-[560px] grid-cols-1 gap-[26px] sm:grid-cols-3">
            {PROMISES.map((p) => (
              <div key={p.title}>
                <div className="mb-1.5 text-[14px] font-semibold">{p.title}</div>
                <div className="text-[13px] leading-[1.55] text-muted">
                  {p.body}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative animate-fade-up-slow">
          <div className="rounded-t-[260px] rounded-b-[8px] border border-gold p-2.5">
            <SlotImage
              image={images.get(SLOTS.hero.key)}
              placeholderLabel="editorial salon photograph"
              // The hero is the largest thing above the fold, so it loads
              // eagerly rather than waiting for the lazy-load threshold.
              priority
              sizes="(max-width: 1024px) 100vw, 640px"
              className="h-[400px] rounded-t-[250px] rounded-b-[4px] md:h-[520px] lg:h-[560px]"
            />
          </div>

          <div className="relative mx-auto -mt-10 w-full max-w-[300px] rounded-[6px] border border-line bg-cream px-6 py-[22px] shadow-[0_18px_44px_rgba(33,49,38,0.10)] lg:absolute lg:-left-14 lg:bottom-16 lg:mt-0 lg:w-[300px] lg:max-w-none">
            <div className="mb-2.5 text-[12px] tracking-[0.14em] text-sage uppercase">
              Next available
            </div>
            <div className="font-serif text-[27px] leading-[1.15]">
              Tomorrow at 10:00
            </div>
            <div className="mt-1.5 text-[13px] text-muted">
              with a senior stylist
            </div>
            <ViewAvailabilityButton />
          </div>
        </div>
      </div>
    </section>
  );
}
