import type { Metadata } from "next";
import { DayCalendar } from "@/components/studio/DayCalendar";
import { requireStaff } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { toSalonDate } from "@/lib/time";

export const metadata: Metadata = {
  title: "Studio — calendar",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Staff calendar.
 *
 * Renders one column per stylist over the salon's opening window, with
 * appointments, breaks and time off drawn to scale. Everything is fetched
 * server-side for the chosen date so the client bundle stays small.
 */
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  await requireStaff("/studio/calendar");
  const params = await searchParams;

  const supabase = await createClient();
  const { data: salon } = await supabase
    .from("salons")
    .select("id, timezone")
    .limit(1)
    .maybeSingle();

  const tz = salon?.timezone ?? "Europe/London";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(params.date ?? "")
    ? params.date!
    : toSalonDate(new Date(), tz);

  const days = params.view === "week" ? 7 : 1;
  const start = new Date(`${date}T00:00:00Z`);
  const rangeStart = new Date(start);
  const rangeEnd = new Date(start);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + days);

  const isoWeekday = ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;

  const [staff, bookings, hours, breaks, timeOff, blocked] = await Promise.all([
    supabase
      .from("staff")
      .select("id, display_name, title")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("display_order"),
    supabase
      .from("bookings")
      .select(
        `id, reference, status, starts_at, ends_at, blocked_until, staff_id,
         internal_notes, total_price_pence, deposit_paid_pence, balance_paid_pence,
         service:service_id(name),
         profile:profile_id(id, first_name, last_name, phone)`,
      )
      // A generous window either side so an appointment that starts before
      // midnight is still drawn on the day it runs into.
      .gte("starts_at", new Date(rangeStart.getTime() - 86_400_000).toISOString())
      .lt("starts_at", new Date(rangeEnd.getTime() + 86_400_000).toISOString())
      .not("status", "in", "(cancelled_by_customer,cancelled_by_salon)"),
    supabase
      .from("opening_hours")
      .select("day_of_week, opens_at, closes_at, is_closed")
      .eq("salon_id", salon?.id ?? ""),
    supabase.from("staff_breaks").select("staff_id, day_of_week, starts_at, ends_at, label"),
    supabase
      .from("staff_time_off")
      .select("staff_id, starts_at, ends_at, reason")
      .eq("is_approved", true)
      .lt("starts_at", rangeEnd.toISOString())
      .gt("ends_at", rangeStart.toISOString()),
    supabase
      .from("blocked_dates")
      .select("date, is_closed, opens_at, closes_at, reason")
      .eq("salon_id", salon?.id ?? "")
      .gte("date", date),
  ]);

  const todayHours = (hours.data ?? []).find((h) => h.day_of_week === isoWeekday);
  const override = (blocked.data ?? []).find((b) => b.date === date);

  return (
    <DayCalendar
      date={date}
      view={days === 7 ? "week" : "day"}
      timezone={tz}
      staff={staff.data ?? []}
      bookings={bookings.data ?? []}
      breaks={breaks.data ?? []}
      timeOff={timeOff.data ?? []}
      opensAt={override?.opens_at ?? todayHours?.opens_at ?? "09:00"}
      closesAt={override?.closes_at ?? todayHours?.closes_at ?? "20:00"}
      isClosed={override?.is_closed ?? todayHours?.is_closed ?? false}
      closureReason={override?.reason ?? null}
    />
  );
}
