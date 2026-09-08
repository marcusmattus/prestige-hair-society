"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BookNowButton } from "@/components/BookNowButton";

const NAV = [
  { href: "/services", label: "Services" },
  { href: "/about", label: "Our Salon" },
  { href: "/stylists", label: "Stylists" },
  { href: "/gallery", label: "Gallery" },
  { href: "/contact", label: "Contact" },
];

export function SiteHeader({ signedIn = false }: { signedIn?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const isCurrent = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-[rgba(251,250,246,0.92)] backdrop-blur-[8px]">
      <div className="mx-auto flex max-w-[1280px] items-center gap-6 px-5 py-3.5 md:px-10 lg:gap-10">
        <Link
          href="/"
          className="flex items-center gap-3"
          aria-label="Prestige Hair Society — home"
        >
          <Image
            src="/logo.png"
            alt="Prestige Hair Society"
            width={267}
            height={261}
            priority
            className="h-14 w-14 object-contain lg:h-[76px] lg:w-[76px]"
          />
        </Link>

        <nav
          aria-label="Main"
          className="ml-auto hidden items-center gap-[34px] text-[14px] tracking-[0.02em] text-ink lg:flex"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isCurrent(item.href) ? "page" : undefined}
              className={
                isCurrent(item.href) ? "text-gold" : undefined
              }
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-5 lg:ml-0">
          <Link
            href={signedIn ? "/account" : "/sign-in"}
            className="hidden text-[14px] text-muted sm:inline"
          >
            {signedIn ? "My account" : "Sign in"}
          </Link>
          <BookNowButton size="sm">Book now</BookNowButton>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="-mr-2 flex h-11 w-11 cursor-pointer flex-col items-center justify-center gap-[5px] lg:hidden"
          >
            <span className="block h-px w-5 bg-ink" />
            <span className="block h-px w-5 bg-ink" />
            <span className="block h-px w-5 bg-ink" />
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="border-t border-line bg-cream px-5 py-4 md:px-10 lg:hidden"
        >
          <div className="grid gap-4 text-[15px]">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isCurrent(item.href) ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href={signedIn ? "/account" : "/sign-in"}
              onClick={() => setMenuOpen(false)}
              className="text-muted"
            >
              {signedIn ? "My account" : "Sign in"}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
