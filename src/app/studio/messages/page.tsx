import type { Metadata } from "next";
import Link from "next/link";
import { MessageLog } from "@/components/studio/MessageLog";
import { MANAGER_ROLES, hasRole, requireStaff } from "@/lib/auth/roles";
import { isConfigured } from "@/lib/env";
import {
  DELIVERY_STATUSES,
  MESSAGE_CHANNELS,
  MESSAGE_KINDS,
  asEnum,
} from "@/lib/studio/filters";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Studio — messages",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

/**
 * The message log.
 *
 * Every email and text the salon has sent, with the exact rendered body that
 * went out -- not a template, the actual text that customer received. When
 * someone says "I never got a confirmation", this is the page that answers it.
 *
 * Delivery rows are written by the dispatch layer before sending, so a message
 * that failed or was skipped is just as visible as one that succeeded. A
 * missing provider key shows as `skipped` with the reason, never as `sent`.
 */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    channel?: string;
    kind?: string;
    q?: string;
    booking?: string;
    page?: string;
  }>;
}) {
  const user = await requireStaff("/studio/messages");
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const supabase = await createClient();

  let query = supabase
    .from("message_deliveries")
    .select(
      `id, kind, channel, status, recipient, subject, body, sent_at, scheduled_for,
       created_at, attempts, error_message, provider, provider_message_id, booking_id,
       booking:booking_id(reference),
       profile:profile_id(id, first_name, last_name)`,
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const status = asEnum(sp.status, DELIVERY_STATUSES);
  const channel = asEnum(sp.channel, MESSAGE_CHANNELS);
  const kind = asEnum(sp.kind, MESSAGE_KINDS);

  if (status) query = query.eq("status", status);
  if (channel) query = query.eq("channel", channel);
  if (kind) query = query.eq("kind", kind);
  if (sp.booking) query = query.eq("booking_id", sp.booking);
  if (sp.q?.trim()) {
    const term = sp.q.trim().replace(/[,()]/g, " ");
    query = query.or(`recipient.ilike.%${term}%,subject.ilike.%${term}%`);
  }

  const [{ data, count }, counts] = await Promise.all([
    query,
    supabase.from("message_deliveries").select("status", { count: "exact", head: false }),
  ]);

  const summary = (counts.data ?? []).reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[32px] font-light">Messages</h1>
          <p className="mt-1 text-[14px] text-muted">
            Everything the salon has emailed or texted, exactly as it was sent.
          </p>
        </div>
        {hasRole(user, MANAGER_ROLES) && (
          <Link
            href="/studio/messages/templates"
            className="rounded-[4px] border border-line px-4 py-2.5 text-[14px] hover:border-gold"
          >
            Edit templates →
          </Link>
        )}
      </div>

      {/* An unconfigured provider is stated plainly rather than left to be
          discovered when a customer complains. */}
      {(!isConfigured.email() || !isConfigured.sms()) && (
        <p className="mb-6 rounded-[6px] border border-gold bg-gold/10 px-5 py-4 text-[14px] leading-[1.6]">
          {!isConfigured.email() && !isConfigured.sms()
            ? "Neither email nor SMS is configured, so messages are being recorded but not sent."
            : !isConfigured.email()
              ? "Email is not configured (RESEND_API_KEY), so emails are recorded but not sent."
              : "SMS is not configured (Twilio), so texts are recorded but not sent."}{" "}
          They appear below as <strong>skipped</strong> with the reason. See
          docs/SETUP.md.
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Sent" value={summary.sent ?? 0} tone="good" />
        <Stat label="Queued" value={summary.queued ?? 0} tone="warn" />
        <Stat label="Delivered" value={summary.delivered ?? 0} tone="good" />
        <Stat label="Failed" value={summary.failed ?? 0} tone="bad" />
        <Stat label="Skipped" value={summary.skipped ?? 0} />
      </div>

      <MessageLog
        messages={(data ?? []).map((m) => ({
          id: m.id,
          kind: m.kind,
          channel: m.channel,
          status: m.status,
          recipient: m.recipient,
          subject: m.subject,
          body: m.body,
          sentAt: m.sent_at,
          scheduledFor: m.scheduled_for,
          createdAt: m.created_at,
          attempts: m.attempts,
          errorMessage: m.error_message,
          provider: m.provider,
          providerMessageId: m.provider_message_id,
          bookingId: m.booking_id,
          bookingReference: m.booking?.reference ?? null,
          clientId: m.profile?.id ?? null,
          clientName: m.profile
            ? `${m.profile.first_name} ${m.profile.last_name}`.trim()
            : null,
        }))}
        total={count ?? 0}
        page={page}
        pageSize={PAGE_SIZE}
        filters={sp}
        canResend={hasRole(user, MANAGER_ROLES)}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "good" | "warn" | "bad";
}) {
  const colour =
    tone === "good"
      ? "text-moss"
      : tone === "warn"
        ? "text-gold"
        : tone === "bad" && value > 0
          ? "text-[#B4483C]"
          : "text-ink";
  return (
    <div className="rounded-[6px] border border-line px-4 py-3">
      <div className="text-[11px] tracking-[0.12em] text-sage uppercase">{label}</div>
      <div className={`mt-1 font-serif text-[24px] ${colour}`}>{value}</div>
    </div>
  );
}
