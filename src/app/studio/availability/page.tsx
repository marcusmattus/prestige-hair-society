import type { Metadata } from "next";
import Link from "next/link";
import { OpeningHoursForm, type DayHours } from "@/components/studio/OpeningHoursForm";
import { RosterForm, type RosterDay } from "@/components/studio/RosterForm";
import {
  ClosuresPanel,
  TimeOffPanel,
  type BlockedDateEntry,
  type TimeOffEntry,
} from "@/components/studio/TimeOffPanel";
import { requireManager } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatWhenShort, toSalonDate } from "@/lib/time";

export const metadata: Metadata = {
  title: "Availability",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const hhmm = (t: string | null | undefined) => (t ?? "09:00").slice(0, 5);

export default async function AvailabilityPage() {
  await requireManager("/studio/availability");
  const supabase = createAdminClient();

  const { data: salon } = await supabase
    .from("salons")
    .select("id, timezone")
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!salon) {
    return <p className="text-[15px] text-muted">No active salon is configured.</p>;
  }

  const [{ data: hours }, { data: staff }, { data: schedules }, { data: breaks }, { data: timeOff }, { data: closures }] =
    await Promise.all([
      supabase.from("opening_hours").select("*").eq("salon_id", salon.id).order("day_of_week"),
      supabase
        .from("staff")
        .select("id, display_name")
        .eq("salon_id", salon.id)
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("display_order"),
      supabase.from("staff_schedules").select("*"),
      supabase.from("staff_breaks").select("*"),
      supabase
        .from("staff_time_off")
        .select("*, staff:staff_id(display_name)")
        .gte("ends_at", new Date().toISOString())
        .order("starts_at"),
      supabase
        .from("blocked_dates")
        .select("*")
        .eq("salon_id", salon.id)
        .gte("date", toSalonDate(new Date(), salon.timezone))
        .order("date"),
    ]);

  const openingDays: DayHours[] = Array.from({ length: 7 }, (_, i) => {
    const day = i + 1;
    const row = hours?.find((h) => h.day_of_week === day);
    return {
      dayOfWeek: day,
      isClosed: row?.is_closed ?? true,
      opensAt: hhmm(row?.opens_at ?? "10:00"),
      closesAt: hhmm(row?.closes_at ?? "18:00"),
    };
  });

  const rosterFor = (staffId: string): RosterDay[] =>
    Array.from({ length: 7 }, (_, i) => {
      const day = i + 1;
      const shift = schedules?.find((s) => s.staff_id === staffId && s.day_of_week === day);
      const brk = breaks?.find((b) => b.staff_id === staffId && b.day_of_week === day);
      return {
        dayOfWeek: day,
        working: !!shift,
        startsAt: hhmm(shift?.starts_at ?? "10:00"),
        endsAt: hhmm(shift?.ends_at ?? "18:00"),
        breakStart: brk ? hhmm(brk.starts_at) : "",
        breakEnd: brk ? hhmm(brk.ends_at) : "",
      };
    });

  const timeOffEntries: TimeOffEntry[] = (timeOff ?? []).map((t) => ({
    id: t.id,
    staffName: (t.staff as { display_name: string } | null)?.display_name ?? "Unknown",
    startsAt: t.starts_at,
    endsAt: t.ends_at,
    reason: t.reason,
    formatted: `${formatWhenShort(t.starts_at, salon.timezone)} → ${formatWhenShort(t.ends_at, salon.timezone)}`,
  }));

  const closureEntries: BlockedDateEntry[] = (closures ?? []).map((c) => ({
    id: c.id,
    date: c.date,
    isClosed: c.is_closed,
    opensAt: c.opens_at,
    closesAt: c.closes_at,
    reason: c.reason,
  }));

  return (
    <div>
      <h2 className="mb-2 font-serif text-[28px] font-light">Availability</h2>
      <p className="mb-10 max-w-[680px] text-[15px] leading-[1.7] text-muted">
        What is bookable, and when. Every change here takes effect immediately —
        the same rules the{" "}
        <Link href="/book" className="text-moss underline">
          booking page
        </Link>{" "}
        and the{" "}
        <Link href="/studio/calendar" className="text-moss underline">
          calendar
        </Link>{" "}
        read. Existing appointments are never cancelled by a change; where one
        would fall outside new hours you are told, and it is yours to move.
      </p>

      <section className="mb-14">
        <h3 className="mb-1 font-serif text-[22px]">Opening hours</h3>
        <p className="mb-5 max-w-[600px] text-[14px] leading-[1.7] text-muted">
          The outer limit. Nothing is bookable outside these, whatever a
          stylist&rsquo;s roster says. These are also the hours published on the{" "}
          <Link href="/contact" className="text-moss underline">
            contact page
          </Link>
          .
        </p>
        <OpeningHoursForm days={openingDays} />
      </section>

      <section className="mb-14">
        <h3 className="mb-1 font-serif text-[22px]">Who works when</h3>
        <p className="mb-5 max-w-[600px] text-[14px] leading-[1.7] text-muted">
          A stylist is bookable only inside both their roster and the
          salon&rsquo;s opening hours.
        </p>

        {(staff ?? []).length === 0 ? (
          <p className="text-[15px] text-muted">
            No stylists yet. Add one in{" "}
            <Link href="/studio/stylists" className="text-moss underline">
              stylists
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-10">
            {(staff ?? []).map((person) => (
              <div key={person.id}>
                <h4 className="mb-3 text-[15px] font-semibold">{person.display_name}</h4>
                <RosterForm
                  staffId={person.id}
                  staffName={person.display_name}
                  days={rosterFor(person.id)}
                />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mb-14">
        <h3 className="mb-1 font-serif text-[22px]">Time off</h3>
        <p className="mb-5 max-w-[600px] text-[14px] leading-[1.7] text-muted">
          Holiday, sickness, training. Only upcoming absences are listed.
        </p>
        <TimeOffPanel
          staff={(staff ?? []).map((s) => ({ id: s.id, name: s.display_name }))}
          entries={timeOffEntries}
        />
      </section>

      <section>
        <h3 className="mb-1 font-serif text-[22px]">Closures and special hours</h3>
        <p className="mb-5 max-w-[600px] text-[14px] leading-[1.7] text-muted">
          Bank holidays, private events, or a day with different hours. These
          override the weekly pattern for that date.
        </p>
        <ClosuresPanel entries={closureEntries} />
      </section>
    </div>
  );
}
