const LINE =
  "We are moving beyond the standard salon visit to truly nurture and transform your hair.";

export function Marquee() {
  return (
    <div className="overflow-hidden bg-ink py-5 text-sand">
      {/* Four copies so the -50% translate loops seamlessly. */}
      <div className="flex w-max animate-marquee font-serif text-[24px] tracking-[0.01em] whitespace-nowrap italic">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="flex" aria-hidden={i > 0}>
            <span className="pr-16">{LINE}</span>
            <span className="pr-16 text-gold">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}
