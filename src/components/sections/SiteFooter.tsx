import Image from "next/image";
import Link from "next/link";

const COLUMNS = [
  {
    heading: "Visit",
    links: [
      { href: "/services", label: "Services" },
      { href: "/stylists", label: "Stylists" },
      { href: "/gallery", label: "Gallery" },
      { href: "/about", label: "Our Salon" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    heading: "Account",
    links: [
      { href: "/sign-in", label: "Sign in" },
      { href: "/account/bookings", label: "My bookings" },
      { href: "/account/preferences", label: "Preferences" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/policies", label: "Cancellation policy" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-cream">
      <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-10 px-5 pt-15 pb-10 sm:grid-cols-2 md:px-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Image
            src="/logo.jpg"
            alt="Prestige Hair Society"
            width={96}
            height={96}
            className="h-24 w-24 object-contain mix-blend-multiply"
          />
          <p className="mt-3.5 max-w-[260px] text-[13px] leading-[1.65] text-muted">
            2 Queens Road, Battersea, London
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div
            key={col.heading}
            className="grid content-start gap-3 text-[14px]"
          >
            <div className="mb-1 text-[12px] tracking-[0.16em] text-sage uppercase">
              {col.heading}
            </div>
            {col.links.map((link) => (
              <Link key={link.label} href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div className="mx-auto max-w-[1280px] px-5 pb-10 text-[12px] text-muted md:px-10">
        © 2026 Prestige Hair Society. Prices and hours shown are placeholders.
      </div>
    </footer>
  );
}
