const STEPS = [
  {
    number: "01",
    title: "Choose your service",
    body: "Browse the catalogue with real durations, starting prices and preparation notes before you commit.",
  },
  {
    number: "02",
    title: "Pick a stylist and time",
    body: "Live availability from staff schedules, breaks and buffers. Your slot is held for ten minutes.",
  },
  {
    number: "03",
    title: "Secure with a deposit",
    body: "Pay by card, Apple Pay or Google Pay. Confirmation arrives by email and SMS immediately.",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-[1280px] px-5 py-[72px] md:px-10 lg:py-[104px]">
      <h2 className="mb-13 text-center font-serif text-[34px] font-light md:text-[46px]">
        Booking, in three steps.
      </h2>
      <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
        {STEPS.map((s) => (
          <div key={s.number} className="border-t border-gold pt-[26px]">
            <div className="mb-4 font-serif text-[15px] tracking-[0.2em] text-gold">
              {s.number}
            </div>
            <h3 className="mb-3 font-serif text-[28px] font-normal">
              {s.title}
            </h3>
            <p className="text-[15px] leading-[1.7] text-muted">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
