import type { Metadata } from "next";
import { Pipeline, type PipelineCard } from "@/components/studio/Pipeline";
import { requireStaff } from "@/lib/auth/roles";
import { balanceDue } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { pipelineStage, type PipelineStage } from "@/lib/studio/pipeline";
import { toSalonDate } from "@/lib/time";

export const metadata: Metadata = {
  title: "Studio — pipeline",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The pipeline board.
 *
 * Answers two questions the salon asks constantly: who has booked, and who has
 * actually paid. Each card carries its own email history, so "have we chased
 * them?" is answered on the same screen rather than in a separate tab.
 *
 * Stage is derived per booking rather than stored, so a card cannot drift out
 * of step with its own money.
 */
async function loadPipeline(days: number) {
  const supabase = await createClient();

  const { data: salon } = await supabase
    .from("salons")
    .select("timezone")
    .limit(1)
    .maybeSingle();

  const tz = salon?.timezone ?? "Europe/London";
  const now = new Date();

  // Look back far enough to still see unpaid balances, forward across the
  // booking window.
  const from = new Date(now);
  from.setDate(from.getDate() - 45);
  const to = new Date(now);
  to.setDate(to.getDate() + days);

  const { data: bookings } = await supabase
    .from("bookings")
    .select(
      `id, reference, status, starts_at, total_price_pence, deposit_pence,
       deposit_paid_pence, balance_paid_pence, created_at, source,
       service:service_id(name),
       staff:staff_id(display_name),
       profile:profile_id(id, first_name, last_name, email, phone)`,
    )
    .gte("starts_at", from.toISOString())
    .lte("starts_at", to.toISOString())
    .order("starts_at", { ascending: true })
    .limit(400);

  const rows = bookings ?? [];

  // One query for every booking's messages rather than one per card.
  const ids = rows.map((b) => b.id);
  const { data: messages } = ids.length
    ? await supabase
        .from("message_deliveries")
        .select("id, booking_id, kind, channel, status, subject, sent_at, recipient")
        .in("booking_id", ids)
        .order("created_at", { ascending: false })
    : { data: [] };

  const byBooking = new Map<string, typeof messages>();
  for (const m of messages ?? []) {
    if (!m.booking_id) continue;
    const list = byBooking.get(m.booking_id) ?? [];
    list.push(m);
    byBooking.set(m.booking_id, list);
  }

  const cards: PipelineCard[] = rows.map((b) => {
    const sent = (byBooking.get(b.id) ?? []).filter(
      (m) => m.status === "sent" || m.status === "delivered",
    );
    const failed = (byBooking.get(b.id) ?? []).filter((m) => m.status === "failed");
    const all = byBooking.get(b.id) ?? [];

    return {
      id: b.id,
      reference: b.reference,
      status: b.status,
      stage: pipelineStage(
        {
          status: b.status,
          startsAt: b.starts_at,
          totalPricePence: b.total_price_pence,
          depositPaidPence: b.deposit_paid_pence,
          balancePaidPence: b.balance_paid_pence,
        },
        now,
        tz,
      ),
      startsAt: b.starts_at,
      createdAt: b.created_at,
      serviceName: b.service?.name ?? "Appointment",
      staffName: b.staff?.display_name ?? null,
      clientId: b.profile?.id ?? null,
      clientName: b.profile
        ? `${b.profile.first_name} ${b.profile.last_name}`.trim() || "Unnamed"
        : "Unknown",
      clientEmail: b.profile?.email ?? null,
      clientPhone: b.profile?.phone ?? null,
      totalPricePence: b.total_price_pence,
      depositPence: b.deposit_pence,
      depositPaidPence: b.deposit_paid_pence,
      balancePaidPence: b.balance_paid_pence,
      outstandingPence: balanceDue(
        b.total_price_pence,
        b.deposit_paid_pence,
        b.balance_paid_pence,
      ),
      source: b.source,
      emails: {
        total: all.length,
        sent: sent.length,
        failed: failed.length,
        // Did the confirmation itself actually go out? That is the one that
        // matters when a client says they heard nothing.
        confirmationSent: sent.some((m) => m.kind === "booking_confirmation"),
        recent: all.slice(0, 4).map((m) => ({
          id: m.id,
          kind: m.kind,
          channel: m.channel,
          status: m.status,
          subject: m.subject,
          sentAt: m.sent_at,
          recipient: m.recipient,
        })),
      },
    };
  });

  return { cards, timezone: tz, today: toSalonDate(now, tz) };
}

export default async function PipelinePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; stage?: string; q?: string }>;
}) {
  await requireStaff("/studio/pipeline");
  const sp = await searchParams;
  const days = Math.min(120, Math.max(7, Number.parseInt(sp.days ?? "60", 10) || 60));

  const { cards, timezone } = await loadPipeline(days);

  return (
    <Pipeline
      cards={cards}
      timezone={timezone}
      days={days}
      focusStage={(sp.stage as PipelineStage | undefined) ?? null}
      query={sp.q ?? ""}
    />
  );
}
