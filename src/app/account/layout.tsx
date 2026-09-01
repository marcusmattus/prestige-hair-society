import Link from "next/link";
import { SiteFooter } from "@/components/sections/SiteFooter";
import { SiteHeader } from "@/components/sections/SiteHeader";
import { signOutAction } from "@/lib/auth/actions";
import { requireUser } from "@/lib/auth/roles";

const NAV = [
  { href: "/account", label: "Overview" },
  { href: "/account/bookings", label: "Appointments" },
  { href: "/account/payments", label: "Payments" },
  { href: "/account/profile", label: "Profile" },
  { href: "/account/preferences", label: "Preferences" },
];

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser("/account");
  const name = [user.profile.first_name, user.profile.last_name]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-[1280px] px-5 py-10 md:px-10 lg:py-16">
        <div className="mb-10">
          <div className="mb-3 text-[12px] tracking-[0.22em] text-sage uppercase">
            Your account
          </div>
          <h1 className="font-serif text-[36px] leading-[1.1] font-light md:text-[44px]">
            {name || "Welcome"}
          </h1>
        </div>

        <div className="grid gap-10 lg:grid-cols-[220px_1fr] lg:gap-16">
          <nav aria-label="Account">
            <ul className="grid gap-1 text-[15px]">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block rounded-[4px] px-3 py-2.5 transition-colors hover:bg-sand"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
              <li className="mt-2 border-t border-line pt-2">
                <form action={signOutAction}>
                  <button
                    type="submit"
                    className="w-full cursor-pointer rounded-[4px] px-3 py-2.5 text-left text-[15px] text-muted transition-colors hover:bg-sand hover:text-ink"
                  >
                    Sign out
                  </button>
                </form>
              </li>
            </ul>
          </nav>

          <div>{children}</div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
