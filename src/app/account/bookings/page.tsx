import type { Metadata } from "next";
import Link from "next/link";
import { BookingCard } from "@/components/account/BookingCard";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Your appointments",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const ACTIVE = ["pending_payment", "confirmed"];

/**
 * Load and partition in one place, outside the component.
 *
 * "Now" is not a pure value, so reading it during render would make the split
 * depend on when React happened to re-render. Doing it here also means the
 * component receives data it can render idempotently.
 */
async function loadBookings(userId: string) {
  const supabase = await createClient();

  // RLS restricts this to the signed-in customer's own rows; the explicit
  // filter is defence in depth and keeps the query planner honest.
  const { data } = await supabase
    .from("bookings")
    .select(
      `id, reference, status, starts_at, ends_at, total_price_pence, deposit_pence,
       deposit_paid_pence, balance_paid_pence, pricing_mode, customer_notes,
       service:service_id(name, slug, preparation_instructions),
       staff:staff_id(display_name, slug),
       salon:salon_id(timezone, cancellation_window_hours, reschedule_window_hours,
                      address_line1, city, postcode, google_maps_url)`,
    )
    .eq("profile_id", userId)
    .order("starts_at", { ascending: false });

  const rows = data ?? [];
  const now = Date.now();

  return {
    upcoming: rows
      .filter((b) => ACTIVE.includes(b.status) && Date.parse(b.starts_at) >= now)
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
    past: rows.filter((b) => !ACTIVE.includes(b.status) || Date.parse(b.starts_at) < now),
  };
}

export default async function BookingsPage() {
  const user = await requireUser("/account/bookings");
  const { upcoming, past } = await loadBookings(user.id);

  return (
    <div>
      <section aria-labelledby="upcoming">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <h2 id="upcoming" className="font-serif text-[28px] font-light">
            Upcoming
          </h2>
          <Button asChild variant="outline" size="sm">
            <Link href="/book">Book another appointment</Link>
          </Button>
        </div>

        {upcoming.length === 0 ? (
          <p className="rounded-[6px] border border-line bg-sand px-5 py-6 text-[15px] leading-[1.7] text-muted">
            Nothing booked at the moment.{" "}
            <Link href="/book" className="text-moss underline underline-offset-2">
              Book an appointment
            </Link>{" "}
            whenever you are ready.
          </p>
        ) : (
          <ul className="grid gap-4">
            {upcoming.map((booking) => (
              <li key={booking.id}>
                <BookingCard booking={booking} upcoming />
              </li>
            ))}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section aria-labelledby="past" className="mt-14">
          <h2 id="past" className="mb-5 font-serif text-[28px] font-light">
            Past appointments
          </h2>
          <ul className="grid gap-4">
            {past.map((booking) => (
              <li key={booking.id}>
                <BookingCard booking={booking} upcoming={false} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
