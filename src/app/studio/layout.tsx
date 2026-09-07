import Link from "next/link";
import { signOutAction } from "@/lib/auth/actions";
import { MANAGER_ROLES, hasRole, requireStaff } from "@/lib/auth/roles";

/**
 * Studio shell.
 *
 * requireStaff() 404s rather than 403s for a signed-in customer, so /studio
 * does not confirm it exists. The nav is filtered by role as well, so a
 * stylist never sees a link to a page they would be refused.
 */
// Only routes that exist. Stylists, availability, payments, reports and
// settings are still to build; listing them here would hand staff a nav full
// of 404s. See the "Not built yet" section of the README.
const NAV = [
  { href: "/studio", label: "Today", managerOnly: false },
  { href: "/studio/pipeline", label: "Pipeline", managerOnly: false },
  { href: "/studio/calendar", label: "Calendar", managerOnly: false },
  { href: "/studio/calendar/subscribe", label: "On your phone", managerOnly: false },
  { href: "/studio/bookings", label: "Bookings", managerOnly: false },
  { href: "/studio/clients", label: "Clients", managerOnly: false },
  // The message log is readable by any staff member -- a stylist may need to
  // check whether their client was told. Editing templates is manager-only,
  // and that page guards itself.
  { href: "/studio/messages", label: "Messages", managerOnly: false },
  { href: "/studio/services", label: "Services", managerOnly: true },
  { href: "/studio/stylists", label: "Stylists", managerOnly: true },
  { href: "/studio/photos", label: "Photos", managerOnly: true },
  { href: "/studio/availability", label: "Availability", managerOnly: true },
  { href: "/studio/payments", label: "Payments", managerOnly: true },
  { href: "/studio/reports", label: "Reports", managerOnly: true },
  { href: "/studio/settings/import", label: "Import", managerOnly: true },
  { href: "/studio/settings", label: "Settings", managerOnly: true },
];

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireStaff("/studio");
  const isManager = hasRole(user, MANAGER_ROLES);
  const visible = NAV.filter((item) => !item.managerOnly || isManager);

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-40 border-b border-line bg-[rgba(251,250,246,0.94)] backdrop-blur-[8px]">
        <div className="mx-auto flex max-w-[1600px] items-center gap-6 px-5 py-3 md:px-8">
          <Link href="/studio" className="font-serif text-[20px]">
            Studio
          </Link>
          <span className="hidden text-[13px] text-muted sm:inline">
            Prestige Hair Society
          </span>

          <div className="ml-auto flex items-center gap-4 text-[14px]">
            <span className="hidden text-muted md:inline">
              {user.profile.first_name || user.email}
            </span>
            <Link href="/" className="text-muted hover:text-ink">
              View site
            </Link>
            <form action={signOutAction}>
              <button type="submit" className="cursor-pointer text-muted hover:text-ink">
                Sign out
              </button>
            </form>
          </div>
        </div>

        <nav aria-label="Studio" className="border-t border-line">
          <ul className="mx-auto flex max-w-[1600px] gap-1 overflow-x-auto px-3 md:px-6">
            {visible.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block px-3 py-2.5 text-[14px] whitespace-nowrap text-muted transition-colors hover:text-ink"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-[1600px] px-5 py-8 md:px-8">{children}</main>
    </div>
  );
}
