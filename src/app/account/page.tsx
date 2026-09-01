import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/roles";
import { formatPence } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { formatWhenLong } from "@/lib/time";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser("/account");
  const supabase = await createClient();

  const [{ data: next }, { count: visits }, { data: favourite }] = await Promise.all([
    supabase
      .from("bookings")
      .select(
        `id, reference, starts_at, service:service_id(name), staff:staff_id(display_name),
         salon:salon_id(timezone)`,
      )
      .eq("profile_id", user.id)
      .in("status", ["pending_payment", "confirmed"])
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(1)
      .maybeSingle(),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .eq("status", "completed"),
    user.profile.favourite_staff_id
      ? supabase
          .from("staff")
          .select("display_name, slug")
          .eq("id", user.profile.favourite_staff_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="grid gap-8">
      <section className="rounded-[6px] border border-line bg-sand px-6 py-6">
        <h2 className="mb-3 text-[12px] tracking-[0.18em] text-sage uppercase">
          Next appointment
        </h2>
        {next ? (
          <>
            <p className="font-serif text-[26px] leading-[1.2]">
              {next.service?.name ?? "Appointment"}
            </p>
            <p className="mt-1.5 text-[15px] text-muted">
              {formatWhenLong(next.starts_at, next.salon?.timezone ?? "Europe/London")} with{" "}
              {next.staff?.display_name ?? "one of our stylists"}
            </p>
            <Button asChild variant="outline" size="sm" className="mt-5">
              <Link href="/account/bookings">Manage appointments</Link>
            </Button>
          </>
        ) : (
          <>
            <p className="text-[15px] leading-[1.7] text-muted">
              Nothing booked at the moment.
            </p>
            <Button asChild size="sm" className="mt-5">
              <Link href="/book">Book an appointment</Link>
            </Button>
          </>
        )}
      </section>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Visits with us" value={String(visits ?? 0)} />
        <Stat
          label="Favourite stylist"
          value={favourite?.display_name ?? "Not set"}
        />
        <Stat
          label="Deposits held"
          value={formatPence(0)}
          hint="Deposits are applied to your bill on the day."
        />
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        <QuickLink href="/account/bookings" title="Appointments">
          Reschedule, cancel or rebook.
        </QuickLink>
        <QuickLink href="/account/payments" title="Payments">
          Receipts and outstanding balances.
        </QuickLink>
        <QuickLink href="/account/profile" title="Profile">
          Contact details and hair goals.
        </QuickLink>
        <QuickLink href="/account/preferences" title="Preferences">
          How and when we contact you.
        </QuickLink>
      </section>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[6px] border border-line px-5 py-5">
      <div className="text-[12px] tracking-[0.14em] text-sage uppercase">{label}</div>
      <div className="mt-2 font-serif text-[28px]">{value}</div>
      {hint && <p className="mt-1 text-[13px] leading-[1.5] text-muted">{hint}</p>}
    </div>
  );
}

function QuickLink({
  href,
  title,
  children,
}: {
  href: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-[6px] border border-line px-5 py-5 transition-colors hover:border-gold"
    >
      <div className="font-serif text-[20px]">{title}</div>
      <p className="mt-1 text-[14px] text-muted">{children}</p>
    </Link>
  );
}
