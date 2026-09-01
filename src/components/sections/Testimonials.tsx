const QUOTES = [
  "The first salon that told me what my hair actually needed rather than what they wanted to sell me.",
  "Booking took under a minute and the confirmation arrived before I had put my phone down.",
  "Six months of consistent treatments and my hair has never been in better condition.",
];

export function Testimonials() {
  return (
    <section className="bg-ink text-sand">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-12 px-5 py-[72px] md:px-10 lg:grid-cols-3 lg:py-[104px]">
        {QUOTES.map((quote) => (
          <blockquote key={quote}>
            <div className="mb-[22px] font-serif text-[25px] leading-[1.45] italic">
              “{quote}”
            </div>
            <div className="text-[13px] tracking-[0.1em] text-gold uppercase">
              Client testimonial
            </div>
          </blockquote>
        ))}
      </div>
    </section>
  );
}
