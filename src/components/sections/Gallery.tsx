const SHOTS = [
  { label: "before · silk press", stripe: "stripe-warm" },
  { label: "after · silk press", stripe: "stripe-deep" },
  { label: "before · colour", stripe: "stripe-warm" },
  { label: "after · colour", stripe: "stripe-deep" },
];

export function Gallery() {
  return (
    <section
      id="gallery"
      className="mx-auto max-w-[1280px] px-5 py-[72px] md:px-10 lg:py-[104px]"
    >
      <h2 className="mb-3 text-center font-serif text-[34px] font-light md:text-[46px]">
        Before and after.
      </h2>
      <p className="mb-12 text-center text-[15px] text-muted">
        Published only with written client consent.
      </p>
      <div className="grid grid-cols-2 gap-[18px] lg:grid-cols-4">
        {SHOTS.map((shot) => (
          <div
            key={shot.label}
            className={`${shot.stripe} flex aspect-3/4 items-end rounded-[6px] p-[18px]`}
          >
            <span className="font-mono text-[10px] tracking-[0.1em] text-sage uppercase">
              {shot.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
