const FEATURED = [
  {
    name: "Consultation",
    body: "Personalised advice to understand your hair goals and build a plan.",
    meta: "30 min · from £45",
  },
  {
    name: "Wash, Cut & Finish",
    body: "Expert cutting with a restorative wash and a flawless finish.",
    meta: "90 min · from £75",
  },
  {
    name: "Silk Press",
    body: "Smooth, shining, beautifully polished results without compromise.",
    meta: "90 min · from £85",
  },
  {
    name: "Colour Services",
    body: "Bespoke colour that enhances your style and complements your tone.",
    meta: "Consultation required · from £150",
  },
];

const SECONDARY = [
  { name: "Protective Styling", price: "from £120" },
  { name: "Hair Treatments", price: "from £55" },
  { name: "Extensions", price: "from £220" },
  { name: "Event Styling", price: "from £90" },
];

export function Services() {
  return (
    <section
      id="services"
      className="mx-auto max-w-[1280px] px-5 py-[72px] md:px-10 lg:py-[108px]"
    >
      <div className="mb-15 text-center">
        <div className="mb-4.5 text-[12px] tracking-[0.22em] text-sage uppercase">
          The catalogue
        </div>
        <h2 className="mb-3.5 font-serif text-[36px] font-light md:text-[52px]">
          Made for your hair.
        </h2>
        <p className="text-[15px] text-muted">
          Placeholder pricing until the verified catalogue is imported.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-4">
        {FEATURED.map((s) => (
          <article
            key={s.name}
            className="flex flex-col gap-3 rounded-[6px] border border-line bg-cream px-[26px] pt-[30px] pb-[26px] transition-colors hover:border-gold"
          >
            <div className="mb-1.5 h-2 w-2 rotate-45 bg-gold" />
            <h3 className="font-serif text-[26px] font-normal">{s.name}</h3>
            <p className="flex-1 text-[14px] leading-[1.65] text-muted">
              {s.body}
            </p>
            <div className="text-[13px] tracking-[0.04em] text-moss">
              {s.meta}
            </div>
            <a
              href="#services"
              className="mt-1.5 text-[13px] tracking-[0.04em] text-ink"
            >
              Learn more →
            </a>
          </article>
        ))}
      </div>

      <div className="mt-[22px] grid grid-cols-1 gap-[22px] sm:grid-cols-2 lg:grid-cols-4">
        {SECONDARY.map((s) => (
          <div
            key={s.name}
            className="flex items-center justify-between gap-4 rounded-[6px] border border-line px-[26px] py-[22px] text-[14px]"
          >
            <span>{s.name}</span>
            <span className="text-muted">{s.price}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
