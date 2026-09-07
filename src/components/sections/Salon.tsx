import { SlotImage } from "@/components/sections/SlotImage";
import { getSiteImages, SLOTS } from "@/lib/images";

const STATS = [
  { value: "12", label: "Years in Battersea" },
  { value: "6", label: "Specialist stylists" },
  { value: "4.9", label: "Average rating" },
];

export async function Salon() {
  const images = await getSiteImages();

  return (
    <section id="salon" className="bg-sand">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 items-center gap-14 px-5 py-[72px] md:px-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:py-[104px]">
        <SlotImage
          image={images.get(SLOTS.salonInterior.key)}
          placeholderLabel="salon interior"
          sizes="(max-width: 1024px) 100vw, 520px"
          className="h-[420px] rounded-t-[220px] rounded-b-[6px] lg:h-[520px]"
        />

        <div>
          <div className="mb-5 text-[12px] tracking-[0.22em] text-sage uppercase">
            Our philosophy
          </div>
          <h2 className="mb-6 font-serif text-[34px] leading-[1.12] font-light md:text-[46px]">
            Healthy hair is the only luxury worth chasing.
          </h2>
          <p className="mb-5 max-w-[520px] text-[16px] leading-[1.75] text-muted">
            Prestige Hair Society was built around a simple idea: a salon should
            give more back to your hair than it takes. Every appointment starts
            with an honest assessment, and every service is chosen for the
            condition of your hair rather than a trend.
          </p>
          <p className="mb-[34px] max-w-[520px] text-[16px] leading-[1.75] text-muted">
            Botanical products, unhurried appointments and aftercare you can
            actually follow at home.
          </p>
          <div className="grid max-w-[560px] grid-cols-3 gap-[30px] border-t border-line pt-7">
            {STATS.map((s) => (
              <div key={s.label}>
                <div className="font-serif text-[36px]">{s.value}</div>
                <div className="mt-1 text-[13px] text-muted">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
