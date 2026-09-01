const HOURS = [
  { days: "Tuesday – Wednesday", time: "10:00 – 18:00" },
  { days: "Thursday – Friday", time: "10:00 – 20:00" },
  { days: "Saturday", time: "09:00 – 18:00" },
  { days: "Sunday – Monday", time: "Closed" },
];

export function Visit() {
  return (
    <section id="contact" className="bg-sand">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-14 px-5 py-[72px] md:px-10 lg:grid-cols-2 lg:gap-20 lg:py-[104px]">
        <div>
          <div className="mb-5 text-[12px] tracking-[0.22em] text-sage uppercase">
            Visit us
          </div>
          <h2 className="mb-[26px] font-serif text-[34px] font-light md:text-[46px]">
            2 Queens Road,
            <br />
            Battersea, London
          </h2>
          <p className="mb-[30px] max-w-[420px] text-[15px] leading-[1.7] text-muted">
            A short walk from Clapham Junction. Please arrive with dry,
            detangled hair unless your service notes say otherwise.
          </p>
          <a
            href="#contact"
            className="inline-block rounded-[4px] border border-line px-7 py-[15px] text-[14px] transition-colors hover:border-gold"
          >
            Get directions →
          </a>
        </div>

        <div className="rounded-[6px] border border-line bg-cream px-6 py-[34px] sm:px-9">
          <div className="mb-[22px] text-[12px] tracking-[0.18em] text-sage uppercase">
            Opening hours
          </div>
          <div className="grid gap-3.5 text-[15px]">
            {HOURS.map((h) => (
              <div key={h.days} className="flex justify-between gap-4">
                <span>{h.days}</span>
                <span className="text-muted">{h.time}</span>
              </div>
            ))}
          </div>
          <p className="mt-6 border-t border-line pt-5 text-[13px] leading-[1.6] text-muted">
            Hours shown are placeholders pending verification against the
            salon&rsquo;s live schedule.
          </p>
        </div>
      </div>
    </section>
  );
}
