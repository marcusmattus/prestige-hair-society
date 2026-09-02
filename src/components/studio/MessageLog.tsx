"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { resendMessageAction, type ActionResult } from "@/lib/studio/actions";
import { formatWhenShort } from "@/lib/time";
import { cn } from "@/lib/utils";

export type LogMessage = {
  id: string;
  kind: string;
  channel: string;
  status: string;
  recipient: string;
  subject: string | null;
  body: string;
  sentAt: string | null;
  scheduledFor: string | null;
  createdAt: string;
  attempts: number;
  errorMessage: string | null;
  provider: string | null;
  providerMessageId: string | null;
  bookingId: string | null;
  bookingReference: string | null;
  clientId: string | null;
  clientName: string | null;
};

const STATUSES = ["queued", "sent", "delivered", "failed", "skipped"];
const CHANNELS = ["email", "sms"];
const KINDS = [
  "booking_confirmation",
  "deposit_receipt",
  "appointment_reminder",
  "reschedule_confirmation",
  "cancellation_confirmation",
  "waitlist_availability",
  "payment_failure",
  "refund_confirmation",
  "post_appointment_thanks",
  "review_request",
  "rebooking_reminder",
];

/**
 * List on the left, the actual message on the right.
 *
 * The preview shows the stored body verbatim -- the text the customer
 * received, with the placeholders already filled in -- rather than the
 * template it came from. Those differ, and the difference is usually the bug.
 */
export function MessageLog({
  messages,
  total,
  page,
  pageSize,
  filters,
  canResend,
}: {
  messages: LogMessage[];
  total: number;
  page: number;
  pageSize: number;
  filters: Record<string, string | undefined>;
  canResend: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(messages[0]?.id ?? null);
  const selected = messages.find((m) => m.id === selectedId) ?? null;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <form
        method="get"
        className="mb-5 grid gap-3 rounded-[6px] border border-line bg-sand px-5 py-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {filters.booking && (
          <input type="hidden" name="booking" value={filters.booking} />
        )}
        <Labelled label="Status">
          <select name="status" defaultValue={filters.status ?? ""} className={FIELD}>
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Labelled>
        <Labelled label="Channel">
          <select name="channel" defaultValue={filters.channel ?? ""} className={FIELD}>
            <option value="">Email and SMS</option>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Labelled>
        <Labelled label="Type">
          <select name="kind" defaultValue={filters.kind ?? ""} className={FIELD}>
            <option value="">Any type</option>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </Labelled>
        <Labelled label="Search">
          <div className="flex gap-2">
            <input
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Recipient or subject"
              className={FIELD}
            />
            <button
              type="submit"
              className="min-h-[44px] shrink-0 cursor-pointer rounded-[4px] bg-ink px-4 text-[14px] text-sand hover:bg-ink-hover"
            >
              Go
            </button>
          </div>
        </Labelled>
      </form>

      {filters.booking && (
        <p className="mb-4 text-[14px] text-muted">
          Filtered to one booking.{" "}
          <Link href="/studio/messages" className="underline underline-offset-2">
            Show everything
          </Link>
        </p>
      )}

      {messages.length === 0 ? (
        <p className="rounded-[6px] border border-line bg-sand px-5 py-6 text-[15px] text-muted">
          No messages match those filters.
        </p>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <ul className="max-h-[70vh] overflow-y-auto rounded-[6px] border border-line">
            {messages.map((m) => (
              <li key={m.id} className="border-b border-line last:border-0">
                <button
                  type="button"
                  onClick={() => setSelectedId(m.id)}
                  aria-current={m.id === selectedId ? "true" : undefined}
                  className={cn(
                    "w-full cursor-pointer px-4 py-3 text-left transition-colors",
                    m.id === selectedId ? "bg-sand" : "hover:bg-sand/60",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[14px] capitalize">
                      {m.kind.replace(/_/g, " ")}
                    </span>
                    <StatusPill status={m.status} />
                  </div>
                  <div className="mt-1 truncate text-[13px] text-muted">
                    {m.channel === "email" ? m.subject : m.body}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 text-[12px] text-muted">
                    <span>{m.recipient}</span>
                    <span>·</span>
                    <span>{m.channel}</span>
                    {m.bookingReference && (
                      <>
                        <span>·</span>
                        <span className="font-mono">{m.bookingReference}</span>
                      </>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {selected ? (
            <MessagePreview message={selected} canResend={canResend} />
          ) : (
            <p className="rounded-[6px] border border-line px-5 py-6 text-[15px] text-muted">
              Select a message to read it.
            </p>
          )}
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-5 flex items-center gap-3 text-[14px]">
          {page > 1 && (
            <Link
              href={hrefFor(filters, page - 1)}
              className="rounded-[4px] border border-line px-4 py-2 hover:border-gold"
            >
              ← Newer
            </Link>
          )}
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Link
              href={hrefFor(filters, page + 1)}
              className="rounded-[4px] border border-line px-4 py-2 hover:border-gold"
            >
              Older →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}

function MessagePreview({
  message,
  canResend,
}: {
  message: LogMessage;
  canResend: boolean;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    resendMessageAction,
    null,
  );

  return (
    <div className="rounded-[6px] border border-line">
      <div className="border-b border-line bg-sand px-5 py-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-[20px] capitalize">
            {message.kind.replace(/_/g, " ")}
          </h2>
          <StatusPill status={message.status} />
        </div>

        <dl className="grid gap-1 text-[13px]">
          <Meta label="To">{message.recipient}</Meta>
          {message.channel === "email" && message.subject && (
            <Meta label="Subject">{message.subject}</Meta>
          )}
          <Meta label="Channel">{message.channel}</Meta>
          {message.clientName && message.clientId && (
            <Meta label="Client">
              <Link
                href={`/studio/clients/${message.clientId}`}
                className="underline underline-offset-2"
              >
                {message.clientName}
              </Link>
            </Meta>
          )}
          {message.bookingReference && message.bookingId && (
            <Meta label="Booking">
              <Link
                href={`/studio/bookings/${message.bookingId}`}
                className="font-mono underline underline-offset-2"
              >
                {message.bookingReference}
              </Link>
            </Meta>
          )}
          <Meta label={message.sentAt ? "Sent" : "Scheduled"}>
            {message.sentAt
              ? formatWhenShort(message.sentAt)
              : message.scheduledFor
                ? formatWhenShort(message.scheduledFor)
                : "—"}
          </Meta>
          {message.attempts > 0 && (
            <Meta label="Attempts">{String(message.attempts)}</Meta>
          )}
          {message.providerMessageId && (
            <Meta label={message.provider ?? "Provider"}>
              <span className="font-mono text-[12px]">{message.providerMessageId}</span>
            </Meta>
          )}
        </dl>

        {message.errorMessage && (
          <p
            className={cn(
              "mt-3 rounded-[4px] px-3 py-2 text-[13px] leading-[1.5]",
              message.status === "failed"
                ? "border border-[#B4483C] text-[#B4483C]"
                : "border border-line text-muted",
            )}
          >
            {message.errorMessage}
          </p>
        )}
      </div>

      {/* The message as the customer saw it. Templates are plain text, so
          whitespace is preserved rather than collapsed. */}
      <div className="px-5 py-5">
        <div className="mb-2 text-[12px] tracking-[0.12em] text-sage uppercase">
          As sent
        </div>
        <pre className="max-h-[40vh] overflow-auto rounded-[4px] border border-line bg-white px-4 py-4 font-sans text-[14px] leading-[1.7] whitespace-pre-wrap">
          {message.body}
        </pre>

        {canResend && message.status !== "queued" && (
          <form action={action} className="mt-4">
            <input type="hidden" name="messageId" value={message.id} />
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              {pending ? "Sending…" : "Send again"}
            </Button>
            <p className="mt-2 text-[12px] leading-[1.5] text-muted">
              Queues a fresh copy of this exact text. The original stays in the
              log.
            </p>
            {state?.error && (
              <p role="alert" className="mt-2 text-[13px] text-[#B4483C]">
                {state.error}
              </p>
            )}
            {state?.message && (
              <p role="status" className="mt-2 text-[13px] text-moss">
                {state.message}
              </p>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

const FIELD =
  "min-h-[44px] w-full rounded-[4px] border border-line bg-white px-3 text-[14px]";

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] tracking-[0.1em] text-sage uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "sent" || status === "delivered"
      ? "border-moss text-moss"
      : status === "failed"
        ? "border-[#B4483C] text-[#B4483C]"
        : status === "skipped"
          ? "border-line text-muted"
          : "border-gold text-gold";
  return (
    <span
      className={`shrink-0 rounded-[3px] border px-2 py-0.5 text-[12px] capitalize ${tone}`}
    >
      {status}
    </span>
  );
}

function hrefFor(filters: Record<string, string | undefined>, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value && key !== "page") params.set(key, value);
  }
  params.set("page", String(page));
  return `/studio/messages?${params}`;
}
