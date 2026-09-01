import { BookNowButton } from "@/components/BookNowButton";

export function FinalCta() {
  return (
    <section className="mx-auto max-w-[1280px] px-5 py-20 text-center md:px-10 lg:py-[120px]">
      <h2 className="mb-6 font-serif text-[40px] leading-[1.1] font-light md:text-[62px]">
        Your appointment is
        <br />
        two minutes away.
      </h2>
      <p className="mb-9 text-[16px] text-muted">
        Live availability, a held slot and instant confirmation.
      </p>
      <BookNowButton size="lg">Book an appointment</BookNowButton>
    </section>
  );
}
