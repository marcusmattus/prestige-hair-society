import { buildCalendar, type CalendarEvent } from "@/lib/calendar/ics";
import { balanceDue, formatPence } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Subscribable appointment feed.
 *
 * A calendar app cannot present a session cookie, so the token in the URL is
 * the credential — which is why it is a dedicated, rotatable secret rather
 * than a staff id, and why this route reads it with the service role and
 * returns nothing at all for an unknown one.
 *
 * The token matches either a stylist (their own column) or the salon (every
 * appointment). Subscribe once on the owner's phone and the day appears in
 * Apple Calendar or Google Calendar, refreshing on its own.
 *
 * Cancelled appointments are included with STATUS:CANCELLED rather than
 * omitted: a subscriber that simply stops seeing an event often leaves the old
 * one on the phone, and a cancelled appointment still showing at 10am is worse
 * than no feed at all.
 */

/** How far back and forward the feed reaches. */
const PAST_DAYS = 30;
const FUTURE_DAYS = 120;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(token)) {
    return new Response("Not found", { status: 404 });
  }

  const supabase = createAdminClient();

  const [{ data: staff }, { data: salonByToken }] = await Promise.all([
    supabase
      .from("staff")
      .select("id, display_name, salon_id")
      .eq("calendar_token", token)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.from("salons").select("*").eq("calendar_token", token).maybeSingle(),
  ]);

  if (!staff && !salonByToken) {
    return new Response("Not found", { status: 404 });
  }

  const salonId = staff?.salon_id ?? salonByToken!.id;
  const { data: salon } = salonByToken
    ? { data: salonByToken }
    : await supabase.from("salons").select("*").eq("id", salonId).single();

  if (!salon) return new Response("Not found", { status: 404 });

  const from = new Date(Date.now() - PAST_DAYS * 86_400_000).toISOString();
  const to = new Date(Date.now() + FUTURE_DAYS * 86_400_000).toISOString();

  let query = supabase
    .from("bookings")
    .select(
      `id, reference, status, starts_at, ends_at, blocked_until,
       total_price_pence, deposit_pence, deposit_paid_pence, balance_paid_pence,
       customer_notes, updated_at,
       service:service_id(name, preparation_instructions),
       staff:staff_id(display_name),
       customer:profile_id(first_name, last_name, phone, email)`,
    )
    .eq("salon_id", salonId)
    .gte("starts_at", from)
    .lte("starts_at", to)
    .order("starts_at");

  if (staff) query = query.eq("staff_id", staff.id);

  const { data: bookings, error } = await query;

  if (error) {
    console.error("[calendar] query failed", error.message);
    return new Response("Unavailable", { status: 503 });
  }

  const address = [salon.address_line1, salon.address_line2, salon.city, salon.postcode]
    .filter(Boolean)
    .join(", ");

  const events: CalendarEvent[] = (bookings ?? []).map((booking) => {
    const service = booking.service as { name: string; preparation_instructions: string | null } | null;
    const stylist = booking.staff as { display_name: string } | null;
    const customer = booking.customer as {
      first_name: string;
      last_name: string;
      phone: string | null;
      email: string;
    } | null;

    const customerName =
      [customer?.first_name, customer?.last_name].filter(Boolean).join(" ") || "Customer";

    const outstanding = balanceDue(
      booking.total_price_pence,
      booking.deposit_paid_pence,
      booking.balance_paid_pence,
    );
    const depositPaid = booking.deposit_paid_pence >= booking.deposit_pence;

    const cancelled =
      booking.status === "cancelled_by_customer" ||
      booking.status === "cancelled_by_salon";

    // The summary is what shows in a month view on a phone, so the deposit
    // state goes there rather than being buried in the notes.
    const marker = cancelled
      ? "CANCELLED — "
      : booking.status === "no_show"
        ? "NO SHOW — "
        : booking.status === "pending_payment"
          ? "UNPAID — "
          : depositPaid
            ? ""
            : "DEPOSIT DUE — ";

    const description = [
      `${customerName}`,
      customer?.phone ? `Phone: ${customer.phone}` : null,
      customer?.email ? `Email: ${customer.email}` : null,
      "",
      `Service: ${service?.name ?? "Appointment"}`,
      stylist ? `Stylist: ${stylist.display_name}` : null,
      `Price: ${formatPence(booking.total_price_pence)}`,
      `Deposit: ${formatPence(booking.deposit_paid_pence)} of ${formatPence(booking.deposit_pence)}${depositPaid ? " — paid" : " — OUTSTANDING"}`,
      outstanding > 0 ? `Balance in salon: ${formatPence(outstanding)}` : "Paid in full",
      booking.customer_notes ? `\nNotes: ${booking.customer_notes}` : null,
      service?.preparation_instructions ? `\nPreparation: ${service.preparation_instructions}` : null,
      "",
      `Reference ${booking.reference}`,
    ]
      .filter((l) => l !== null)
      .join("\n");

    return {
      // Stable and globally unique, so an edit updates the existing entry.
      uid: `booking-${booking.id}@prestigehairsociety`,
      start: new Date(booking.starts_at),
      // Block the buffer too: the chair is genuinely occupied until then.
      end: new Date(booking.blocked_until),
      summary: `${marker}${service?.name ?? "Appointment"} — ${customerName}`,
      description,
      location: address,
      status: cancelled ? "CANCELLED" : booking.status === "pending_payment" ? "TENTATIVE" : "CONFIRMED",
      sequence: Math.floor(new Date(booking.updated_at).getTime() / 1000),
      lastModified: new Date(booking.updated_at),
      alarmMinutesBefore: cancelled ? undefined : 60,
      organizerName: salon.name,
      organizerEmail: salon.notification_email ?? salon.email ?? undefined,
    };
  });

  const body = buildCalendar({
    name: staff ? `${staff.display_name} — ${salon.name}` : `${salon.name} — all appointments`,
    description: "Appointments, refreshed automatically. Read-only.",
    timezone: salon.timezone,
    events,
    refreshMinutes: 15,
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="prestige-hair-society.ics"',
      // The URL is a credential: never let a shared cache hold the response.
      "Cache-Control": "private, no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
