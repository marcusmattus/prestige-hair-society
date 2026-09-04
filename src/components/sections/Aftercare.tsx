import Link from "next/link";

/**
 * Hair-care and aftercare section (spec §3.9).
 *
 * Deliberately non-commercial: advice that stands on its own, with the product
 * conversation left for the chair. A salon that gives useful advice for free
 * is more persuasive than one that gates it.
 */
const ADVICE = [
  {
    title: "Wash less, cleanse better",
    body: "Most hair does not need washing as often as people think. When you do, cleanse the scalp rather than the lengths and let the run-off do the rest.",
  },
  {
    title: "Condition from the ends up",
    body: "The oldest hair needs the most help. Work conditioner from the ends towards the mid-lengths, and leave the roots to your scalp's own oils.",
  },
  {
    title: "Heat is a tool, not a habit",
    body: "Always use a heat protectant, and use the lowest temperature that does the job. Most styling irons run far hotter than anyone needs.",
  },
  {
    title: "Protect it overnight",
    body: "A silk or satin pillowcase, or a wrap, costs little and prevents a surprising amount of breakage and frizz.",
  },
  {
    title: "Trim on a schedule, not a whim",
    body: "Regular small trims keep length. Waiting until the ends are visibly damaged means losing more than you wanted to.",
  },
  {
    title: "Ask us before you experiment",
    body: "Box colour, relaxers and bond-builders all interact. A two-minute message beforehand can save a very long corrective appointment.",
  },
];

export function Aftercare() {
  return (
    <section id="aftercare" className="bg-sand">
      <div className="mx-auto max-w-[1280px] px-5 py-[72px] md:px-10 lg:py-[104px]">
        <div className="mb-12 max-w-[620px]">
          <div className="mb-4 text-[12px] tracking-[0.22em] text-sage uppercase">
            Between appointments
          </div>
          <h2 className="mb-5 font-serif text-[34px] leading-[1.12] font-light md:text-[46px]">
            Aftercare you can actually follow.
          </h2>
          <p className="text-[16px] leading-[1.75] text-muted">
            What happens in the six weeks between visits matters more than what
            happens in the chair. None of this requires buying anything from us.
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {ADVICE.map((item) => (
            <li key={item.title} className="border-t border-line pt-5">
              <h3 className="mb-2 text-[15px] font-semibold">{item.title}</h3>
              <p className="text-[15px] leading-[1.7] text-muted">{item.body}</p>
            </li>
          ))}
        </ul>

        <p className="mt-10 text-[15px] text-muted">
          Your stylist writes aftercare specific to your hair into every
          appointment — it arrives with your confirmation and stays in{" "}
          <Link href="/account/bookings" className="text-moss underline">
            your account
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
