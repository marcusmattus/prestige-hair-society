import Image from "next/image";
import Link from "next/link";

/** Shared site header + primary navigation, used on every page. */
export function SiteHeader() {
  return (
    <header className="header shell">
      <Link className="brand" href="/#top">
        <Image src="/prestige-logo.jpg" width={54} height={54} alt="Prestige Hair Society" />
        <span>Prestige Hair Society</span>
      </Link>
      <nav>
        <Link href="/#book">Book</Link>
        <Link href="/memberships">Memberships &amp; Programmes</Link>
        <Link href="/#studio">Studio</Link>
        <Link href="/account">My account</Link>
      </nav>
      <Link className="button" href="/memberships">
        Explore memberships
      </Link>
    </header>
  );
}
