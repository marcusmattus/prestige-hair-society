"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireManager } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";

export type AvailabilityResult = { error?: string; message?: string };

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Everything the availability engine reads: opening hours, staff rosters,
 * breaks, time off and one-off closures.
 *
 * Every write here changes what customers can book, immediately. Shrinking a
 * day does NOT cancel appointments already inside the part being removed —
 * the booking stays and shows on the calendar — so each action reports how
 * many existing appointments now fall outside the hours, rather than silently
 * leaving the salon to discover them.
 */

const openingHoursSchema = z.object({
  rows: z
    .array(
      z.object({
        dayOfWeek: z.coerce.number().int().min(1).max(7),
        isClosed: z.boolean(),
        opensAt: z.string().regex(TIME, "Use HH:MM"),
        closesAt: z.string().regex(TIME, "Use HH:MM"),
      }),
    )
    .length(7),
});

export async function saveOpeningHoursAction(
  _prev: AvailabilityResult | null,
  formData: FormData,
): Promise<AvailabilityResult> {
  const user = await requireManager("/studio/availability");

  const rows = Array.from({ length: 7 }, (_, i) => {
    const day = i + 1;
    return {
      dayOfWeek: day,
      isClosed: formData.get(`closed.${day}`) === "on",
      opensAt: String(formData.get(`opens.${day}`) ?? ""),
      closesAt: String(formData.get(`closes.${day}`) ?? ""),
    };
  });

  const parsed = openingHoursSchema.safeParse({ rows });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the times you entered." };
  }

  for (const row of parsed.data.rows) {
    if (!row.isClosed && row.closesAt <= row.opensAt) {
      return { error: `Closing time must be after opening time on day ${row.dayOfWeek}.` };
    }
  }

  const supabase = createAdminClient();
  const { data: salon } = await supabase
    .from("salons")
    .select("id")
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!salon) return { error: "No active salon is configured." };

  const { error } = await supabase.from("opening_hours").upsert(
    parsed.data.rows.map((row) => ({
      salon_id: salon.id,
      day_of_week: row.dayOfWeek,
      opens_at: row.opensAt,
      closes_at: row.closesAt,
      is_closed: row.isClosed,
    })),
    { onConflict: "salon_id,day_of_week" },
  );

  if (error) {
    console.error("[availability] opening hours failed", error.message);
    return { error: "We could not save those hours." };
  }

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "availability.opening_hours_updated",
    entityType: "salon",
    entityId: salon.id,
    metadata: { openDays: parsed.data.rows.filter((r) => !r.isClosed).length },
  });

  revalidatePath("/studio/availability");
  revalidatePath("/contact");

  const stranded = await countStrandedBookings(salon.id);
  return {
    message: stranded
      ? `Saved. ${stranded} existing appointment${stranded === 1 ? "" : "s"} now fall outside opening hours — they are still booked, check the calendar.`
      : "Saved. Availability updates immediately.",
  };
}

/**
 * Appointments sitting outside the hours just saved.
 *
 * Not a failure — a customer booked in good faith and the salon may well
 * honour it — but the salon must be told rather than finding out on the day.
 */
async function countStrandedBookings(salonId: string): Promise<number> {
  const supabase = createAdminClient();

  const [{ data: hours }, { data: bookings }] = await Promise.all([
    supabase.from("opening_hours").select("*").eq("salon_id", salonId),
    supabase
      .from("bookings")
      .select("starts_at, blocked_until, salon:salon_id(timezone)")
      .eq("salon_id", salonId)
      .in("status", ["pending_payment", "confirmed"])
      .gte("starts_at", new Date().toISOString()),
  ]);

  if (!hours || !bookings) return 0;

  const byDay = new Map(hours.map((h) => [h.day_of_week, h]));
  let stranded = 0;

  for (const booking of bookings) {
    const tz = (booking.salon as { timezone: string } | null)?.timezone ?? "Europe/London";
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(booking.starts_at));

    const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
    const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00";

    const isoDay = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(weekday) + 1;
    const day = byDay.get(isoDay);
    const startTime = `${hour}:${minute}`;

    if (!day || day.is_closed || startTime < day.opens_at.slice(0, 5)) {
      stranded += 1;
    }
  }

  return stranded;
}

// ---------------------------------------------------------------------------
// Staff rosters and breaks
// ---------------------------------------------------------------------------

const scheduleSchema = z.object({
  staffId: z.string().uuid(),
  rows: z.array(
    z.object({
      dayOfWeek: z.coerce.number().int().min(1).max(7),
      working: z.boolean(),
      startsAt: z.string().regex(TIME, "Use HH:MM"),
      endsAt: z.string().regex(TIME, "Use HH:MM"),
      breakStart: z.string().regex(TIME).or(z.literal("")),
      breakEnd: z.string().regex(TIME).or(z.literal("")),
    }),
  ),
});

export async function saveStaffScheduleAction(
  _prev: AvailabilityResult | null,
  formData: FormData,
): Promise<AvailabilityResult> {
  const user = await requireManager("/studio/availability");

  const staffId = String(formData.get("staffId") ?? "");
  const rows = Array.from({ length: 7 }, (_, i) => {
    const day = i + 1;
    return {
      dayOfWeek: day,
      working: formData.get(`working.${day}`) === "on",
      startsAt: String(formData.get(`start.${day}`) ?? ""),
      endsAt: String(formData.get(`end.${day}`) ?? ""),
      breakStart: String(formData.get(`breakStart.${day}`) ?? ""),
      breakEnd: String(formData.get(`breakEnd.${day}`) ?? ""),
    };
  });

  const parsed = scheduleSchema.safeParse({ staffId, rows });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the times you entered." };
  }

  for (const row of parsed.data.rows) {
    if (!row.working) continue;
    if (row.endsAt <= row.startsAt) {
      return { error: `Finish time must be after start time on day ${row.dayOfWeek}.` };
    }
    const hasBreak = row.breakStart !== "" || row.breakEnd !== "";
    if (hasBreak) {
      if (row.breakStart === "" || row.breakEnd === "") {
        return { error: `A break needs both a start and an end on day ${row.dayOfWeek}.` };
      }
      if (row.breakEnd <= row.breakStart) {
        return { error: `Break end must be after break start on day ${row.dayOfWeek}.` };
      }
      if (row.breakStart < row.startsAt || row.breakEnd > row.endsAt) {
        return { error: `The break must sit inside the shift on day ${row.dayOfWeek}.` };
      }
    }
  }

  const supabase = createAdminClient();

  // Replace rather than merge: a roster is a whole week, and a day removed
  // from the form must disappear rather than linger.
  await supabase.from("staff_schedules").delete().eq("staff_id", parsed.data.staffId);
  await supabase.from("staff_breaks").delete().eq("staff_id", parsed.data.staffId);

  const working = parsed.data.rows.filter((r) => r.working);

  if (working.length > 0) {
    const { error } = await supabase.from("staff_schedules").insert(
      working.map((row) => ({
        staff_id: parsed.data.staffId,
        day_of_week: row.dayOfWeek,
        starts_at: row.startsAt,
        ends_at: row.endsAt,
      })),
    );
    if (error) {
      console.error("[availability] roster failed", error.message);
      return { error: "We could not save that roster." };
    }
  }

  const breaks = working.filter((r) => r.breakStart && r.breakEnd);
  if (breaks.length > 0) {
    await supabase.from("staff_breaks").insert(
      breaks.map((row) => ({
        staff_id: parsed.data.staffId,
        day_of_week: row.dayOfWeek,
        starts_at: row.breakStart,
        ends_at: row.breakEnd,
        label: "Break",
      })),
    );
  }

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "availability.roster_updated",
    entityType: "staff",
    entityId: parsed.data.staffId,
    metadata: { workingDays: working.length },
  });

  revalidatePath("/studio/availability");
  return { message: `Saved. ${working.length} working day${working.length === 1 ? "" : "s"} a week.` };
}

// ---------------------------------------------------------------------------
// Time off
// ---------------------------------------------------------------------------

const timeOffSchema = z
  .object({
    staffId: z.string().uuid(),
    startsAt: z.string().min(1, "Choose a start"),
    endsAt: z.string().min(1, "Choose an end"),
    reason: z.string().max(200).optional(),
  })
  .refine((v) => Date.parse(v.endsAt) > Date.parse(v.startsAt), {
    message: "The end must be after the start",
    path: ["endsAt"],
  });

export async function addTimeOffAction(
  _prev: AvailabilityResult | null,
  formData: FormData,
): Promise<AvailabilityResult> {
  const user = await requireManager("/studio/availability");

  const parsed = timeOffSchema.safeParse({
    staffId: formData.get("staffId"),
    startsAt: formData.get("startsAt"),
    endsAt: formData.get("endsAt"),
    reason: formData.get("reason") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the dates you entered." };
  }

  const supabase = createAdminClient();

  // Appointments already inside the absence. Booking over time off is
  // impossible, but marking time off over existing bookings is not — the
  // stylist has to know what to move.
  const { data: clashes } = await supabase
    .from("bookings")
    .select("reference")
    .eq("staff_id", parsed.data.staffId)
    .in("status", ["pending_payment", "confirmed"])
    .lt("starts_at", new Date(parsed.data.endsAt).toISOString())
    .gt("blocked_until", new Date(parsed.data.startsAt).toISOString());

  const { error } = await supabase.from("staff_time_off").insert({
    staff_id: parsed.data.staffId,
    starts_at: new Date(parsed.data.startsAt).toISOString(),
    ends_at: new Date(parsed.data.endsAt).toISOString(),
    reason: parsed.data.reason || null,
    is_approved: true,
    created_by: user.id,
  });

  if (error) {
    // The exclusion constraint in 0005 refuses overlapping approved absences.
    if (error.message.includes("staff_time_off_no_overlap")) {
      return { error: "That overlaps time off already recorded for this stylist." };
    }
    console.error("[availability] time off failed", error.message);
    return { error: "We could not record that time off." };
  }

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "availability.time_off_added",
    entityType: "staff",
    entityId: parsed.data.staffId,
    metadata: { clashes: clashes?.length ?? 0 },
  });

  revalidatePath("/studio/availability");
  revalidatePath("/studio/calendar");

  return {
    message: clashes?.length
      ? `Recorded. ${clashes.length} appointment${clashes.length === 1 ? "" : "s"} already sit inside it (${clashes
          .map((c) => c.reference)
          .join(", ")}) — those need moving.`
      : "Time off recorded. Those hours are no longer bookable.",
  };
}

export async function deleteTimeOffAction(
  _prev: AvailabilityResult | null,
  formData: FormData,
): Promise<AvailabilityResult> {
  const user = await requireManager("/studio/availability");
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Which time off?" };

  const supabase = createAdminClient();
  const { error } = await supabase.from("staff_time_off").delete().eq("id", id);

  if (error) return { error: "We could not remove that." };

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "availability.time_off_removed",
    entityType: "staff_time_off",
    entityId: id,
    metadata: {},
  });

  revalidatePath("/studio/availability");
  return { message: "Removed. Those hours are bookable again." };
}

// ---------------------------------------------------------------------------
// One-off closures and special hours
// ---------------------------------------------------------------------------

const blockedDateSchema = z
  .object({
    date: z.string().regex(DATE, "Choose a date"),
    isClosed: z.boolean(),
    opensAt: z.string().regex(TIME).or(z.literal("")),
    closesAt: z.string().regex(TIME).or(z.literal("")),
    reason: z.string().max(200).optional(),
  })
  .refine((v) => v.isClosed || (v.opensAt !== "" && v.closesAt !== "" && v.closesAt > v.opensAt), {
    message: "Special hours need an opening and a later closing time",
    path: ["closesAt"],
  });

export async function saveBlockedDateAction(
  _prev: AvailabilityResult | null,
  formData: FormData,
): Promise<AvailabilityResult> {
  const user = await requireManager("/studio/availability");

  const parsed = blockedDateSchema.safeParse({
    date: formData.get("date"),
    isClosed: formData.get("isClosed") === "on",
    opensAt: String(formData.get("opensAt") ?? ""),
    closesAt: String(formData.get("closesAt") ?? ""),
    reason: formData.get("reason") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check what you entered." };
  }

  const supabase = createAdminClient();
  const { data: salon } = await supabase
    .from("salons")
    .select("id")
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!salon) return { error: "No active salon is configured." };

  const { error } = await supabase.from("blocked_dates").upsert(
    {
      salon_id: salon.id,
      date: parsed.data.date,
      is_closed: parsed.data.isClosed,
      opens_at: parsed.data.isClosed ? null : parsed.data.opensAt,
      closes_at: parsed.data.isClosed ? null : parsed.data.closesAt,
      reason: parsed.data.reason || null,
      created_by: user.id,
    },
    { onConflict: "salon_id,date" },
  );

  if (error) {
    console.error("[availability] blocked date failed", error.message);
    return { error: "We could not save that date." };
  }

  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("salon_id", salon.id)
    .in("status", ["pending_payment", "confirmed"])
    .gte("starts_at", `${parsed.data.date}T00:00:00Z`)
    .lt("starts_at", `${parsed.data.date}T23:59:59Z`);

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "availability.blocked_date_saved",
    entityType: "salon",
    entityId: salon.id,
    metadata: { date: parsed.data.date, isClosed: parsed.data.isClosed },
  });

  revalidatePath("/studio/availability");
  revalidatePath("/studio/calendar");

  return {
    message: count
      ? `Saved. ${count} appointment${count === 1 ? " is" : "s are"} already booked that day — they are not cancelled automatically.`
      : "Saved.",
  };
}

export async function deleteBlockedDateAction(
  _prev: AvailabilityResult | null,
  formData: FormData,
): Promise<AvailabilityResult> {
  await requireManager("/studio/availability");
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Which date?" };

  const supabase = createAdminClient();
  const { error } = await supabase.from("blocked_dates").delete().eq("id", id);
  if (error) return { error: "We could not remove that." };

  revalidatePath("/studio/availability");
  return { message: "Removed. Normal hours apply to that day again." };
}
