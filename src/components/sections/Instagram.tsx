import { getSalon } from "@/lib/salon";

/**
 * Instagram strip (spec §3.10).
 *
 * No Instagram embed or Basic Display API call: an embed ships third-party
 * tracking to every visitor before they have consented to anything, and it
 * would be the slowest thing on the page. This links out instead, and shows
 * placeholder tiles until real imagery is supplied. If a live feed is wanted
 * later, fetch it server-side on a schedule and serve our own images.
 */
export async function Instagram() {
  const salon = await getSalon();
  const handle = salon?.instagram_url
    ? `@${salon.instagram_url.replace(/\/+$/, "").split("/").pop()}`
    : "@prestigehairsociety";

  return (
    <section className="mx-auto max-w-[1280px] px-5 py-[72px] md:px-10 lg:py-[104px]">
      <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-4 text-[12px] tracking-[0.22em] text-sage uppercase">
            Follow along
          </div>
          <h2 className="font-serif text-[34px] font-light md:text-[46px]">
            {handle}
          </h2>
        </div>
        {salon?.instagram_url && (
          <a
            href={salon.instagram_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[14px] text-moss"
          >
            View on Instagram →
          </a>
        )}
      </div>

      <ul className="grid grid-cols-2 gap-[18px] sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <li
            key={i}
            className={`${i % 2 === 0 ? "stripe-warm" : "stripe-deep"} flex aspect-square items-end rounded-[6px] p-3`}
          >
            <span className="font-mono text-[10px] tracking-[0.1em] text-sage uppercase">
              post
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-[13px] leading-[1.6] text-muted">
        Placeholder tiles. Salon photography replaces these once supplied; no
        third-party embed is loaded, so nothing here tracks you.
      </p>
    </section>
  );
}
