const STYLISTS = [
  {
    role: "Senior stylist",
    body: "Silk press, precision cutting and textured hair care.",
  },
  {
    role: "Colour specialist",
    body: "Balayage, grey blending and colour correction.",
  },
  {
    role: "Protective styling",
    body: "Braiding, extensions and long-term scalp health.",
  },
];

export function Stylists() {
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
          <a href="#stylists" className="text-[14px] text-moss">
            All stylists →
          </a>
        </div>

        <div className="grid grid-cols-1 gap-[26px] sm:grid-cols-2 lg:grid-cols-3">
          {STYLISTS.map((s) => (
            <article key={s.role}>
              <div className="stripe-deep flex h-[340px] items-end justify-center rounded-t-[180px] rounded-b-[6px] pb-[26px] lg:h-[400px]">
                <span className="font-mono text-[11px] tracking-[0.12em] text-sage uppercase">
                  stylist portrait
                </span>
              </div>
              <h3 className="mt-[22px] mb-1.5 font-serif text-[26px] font-normal">
                Stylist name
              </h3>
              <div className="mb-2.5 text-[13px] tracking-[0.06em] text-gold uppercase">
                {s.role}
              </div>
              <p className="text-[14px] leading-[1.65] text-muted">{s.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
