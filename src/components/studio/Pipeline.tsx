"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatPence } from "@/lib/money";
import {
  PIPELINE_STAGES,
  STAGE_META,
  depositState,
  totalsFor,
  type PipelineStage,
} from "@/lib/studio/pipeline";
import { formatWhenShort } from "@/lib/time";
import { cn } from "@/lib/utils";

export type PipelineEmail = {
  id: string;
  kind: string;
  channel: string;
  status: string;
  subject: string | null;
  sentAt: string | null;
  recipient: string;
};

export type PipelineCard = {
  id: string;
  reference: string;
  status: string;
  stage: PipelineStage;
  startsAt: string;
  createdAt: string;
  serviceName: string;
  staffName: string | null;
  clientId: string | null;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  totalPricePence: number;
  depositPence: number;
  depositPaidPence: number;
  balancePaidPence: number;
  outstandingPence: number;
  source: string;
  emails: {
    total: number;
    sent: number;
    failed: number;
    confirmationSent: boolean;
    recent: PipelineEmail[];
  };
};

const TONE_BAR: Record<string, string> = {
  warn: "bg-gold",
  active: "bg-ink",
  good: "bg-moss",
  muted: "bg-line",
};

export function Pipeline({
  cards,
  timezone,
  days,
  focusStage,
  query,
}: {
  cards: PipelineCard[];
  timezone: string;
  days: number;
  focusStage: PipelineStage | null;
  query: string;
}) {
  const [search, setSearch] = useState(query);
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return cards;
    return cards.filter(
      (c) =>
        c.clientName.toLowerCase().includes(term) ||
        c.clientEmail?.toLowerCase().includes(term) ||
        c.reference.toLowerCase().includes(term) ||
        c.serviceName.toLowerCase().includes(term),
    );
  }, [cards, search]);

  const columns = useMemo(
    () =>
      PIPELINE_STAGES.map((stage) => ({
        stage,
        cards: filtered.filter((c) => c.stage === stage),
      })).filter((col) => !focusStage || col.stage === focusStage),
    [filtered, focusStage],
  );

  // Headline numbers: the two questions this page exists to answer.
  const booked = filtered.filter((c) => c.stage !== "lost");
  const depositsIn = booked.reduce((sum, c) => sum + c.depositPaidPence, 0);
  const awaiting = filtered.filter((c) => c.stage === "awaiting_deposit");
  const owed = booked.reduce((sum, c) => sum + c.outstandingPence, 0);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[32px] font-light">Pipeline</h1>
          <p className="mt-1 text-[14px] text-muted">
            Every booking by what it needs next. Last 45 days and the next{" "}
            {days}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="pipeline-search" className="sr-only">
            Search the pipeline
          </label>
          <input
            id="pipeline-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name, email, reference"
            className="min-h-[44px] w-[240px] rounded-[4px] border border-line bg-white px-3 text-[14px]"
          />
          {focusStage && (
            <Link
              href="/studio/pipeline"
              className="rounded-[4px] border border-line px-4 py-2.5 text-[14px] hover:border-gold"
            >
              Show all stages
            </Link>
          )}
        </div>
      </div>

      <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Headline label="Booked" value={String(booked.length)} hint="Live appointments" />
        <Headline
          label="Deposits received"
          value={formatPence(depositsIn)}
          hint="Confirmed by Stripe"
          tone="good"
        />
        <Headline
          label="Awaiting deposit"
          value={String(awaiting.length)}
          hint={awaiting.length ? "Not yet paid" : "Nothing outstanding"}
          tone={awaiting.length ? "warn" : undefined}
        />
        <Headline
          label="Due in salon"
          value={formatPence(owed)}
          hint="Balances still to collect"
        />
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map(({ stage, cards: columnCards }) => {
          const meta = STAGE_META[stage];
          const totals = totalsFor(
            columnCards.map((c) => ({
              status: c.status,
              startsAt: c.startsAt,
              totalPricePence: c.totalPricePence,
              depositPaidPence: c.depositPaidPence,
              balancePaidPence: c.balancePaidPence,
              depositPence: c.depositPence,
            })),
          );

          return (
            <section
              key={stage}
              aria-labelledby={`stage-${stage}`}
              className="flex w-[320px] shrink-0 flex-col rounded-[6px] border border-line bg-cream"
            >
              <header className="border-b border-line px-4 py-3">
                <div className={cn("mb-2.5 h-[3px] rounded-full", TONE_BAR[meta.tone])} />
                <div className="flex items-baseline justify-between gap-3">
                  <h2 id={`stage-${stage}`} className="text-[15px]">
                    {meta.label}
                  </h2>
                  <span className="text-[14px] text-muted">{totals.count}</span>
                </div>
                <p className="mt-1 text-[12px] leading-[1.45] text-muted">{meta.hint}</p>

                {(totals.depositsPaidPence > 0 || totals.outstandingPence > 0) && (
                  <p className="mt-2 flex flex-wrap gap-x-3 text-[12px]">
                    {totals.depositsPaidPence > 0 && (
                      <span className="text-moss">
                        {formatPence(totals.depositsPaidPence)} in
                      </span>
                    )}
                    {totals.outstandingPence > 0 && (
                      <span className="text-gold">
                        {formatPence(totals.outstandingPence)} due
                      </span>
                    )}
                  </p>
                )}
              </header>

              <ul className="max-h-[62vh] overflow-y-auto p-2">
                {columnCards.length === 0 ? (
                  <li className="px-2 py-6 text-center text-[13px] text-muted">
                    Nothing here.
                  </li>
                ) : (
                  columnCards.map((card) => (
                    <li key={card.id} className="mb-2 last:mb-0">
                      <Card
                        card={card}
                        timezone={timezone}
                        expanded={openCardId === card.id}
                        onToggle={() =>
                          setOpenCardId(openCardId === card.id ? null : card.id)
                        }
                      />
                    </li>
                  ))
                )}
              </ul>
            </section>
          );
        })}
      </div>

      <p className="mt-4 text-[13px] text-muted">
        Stages are worked out from each booking&rsquo;s status and its payments,
        so a card cannot disagree with its own money. Cards do not drag between
        columns — a booking moves when its state actually changes.
      </p>
    </div>
  );
}

function Card({
  card,
  timezone,
  expanded,
  onToggle,
}: {
  card: PipelineCard;
  timezone: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  const deposit = depositState(card);

  return (
    <article className="rounded-[5px] border border-line bg-white px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {card.clientId ? (
            <Link
              href={`/studio/clients/${card.clientId}`}
              className="block truncate text-[14px] underline underline-offset-2"
            >
              {card.clientName}
            </Link>
          ) : (
            <span className="block truncate text-[14px]">{card.clientName}</span>
          )}
          <span className="mt-0.5 block truncate text-[12px] text-muted">
            {card.serviceName}
          </span>
        </div>
        <Link
          href={`/studio/bookings/${card.id}`}
          className="shrink-0 font-mono text-[11px] text-muted hover:text-ink"
        >
          {card.reference}
        </Link>
      </div>

      <div className="mt-2 text-[12px] text-muted">
        {formatWhenShort(card.startsAt, timezone)}
        {card.staffName && ` · ${card.staffName}`}
      </div>

      {/* Deposit state, stated rather than implied. */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
        {deposit === "paid" && (
          <span className="rounded-[3px] border border-moss px-1.5 py-0.5 text-moss">
            {formatPence(card.depositPaidPence)} deposit paid
          </span>
        )}
        {deposit === "outstanding" && (
          <span className="rounded-[3px] border border-gold px-1.5 py-0.5 text-gold">
            {formatPence(card.depositPence)} deposit due
          </span>
        )}
        {deposit === "none_required" && (
          <span className="rounded-[3px] border border-line px-1.5 py-0.5 text-muted">
            No deposit
          </span>
        )}
        {card.outstandingPence > 0 && card.stage !== "awaiting_deposit" && (
          <span className="text-muted">{formatPence(card.outstandingPence)} in salon</span>
        )}
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={cn(
          "mt-2.5 flex w-full cursor-pointer items-center justify-between gap-2 rounded-[3px] border px-2 py-1.5 text-[12px] transition-colors",
          card.emails.failed > 0
            ? "border-[#B4483C] text-[#B4483C]"
            : card.emails.confirmationSent
              ? "border-line text-muted hover:border-gold"
              : "border-gold text-gold",
        )}
      >
        <span>
          {card.emails.failed > 0
            ? `${card.emails.failed} failed to send`
            : card.emails.confirmationSent
              ? `${card.emails.sent} message${card.emails.sent === 1 ? "" : "s"} sent`
              : card.emails.total > 0
                ? "No confirmation sent yet"
                : "Nothing sent yet"}
        </span>
        <span aria-hidden="true">{expanded ? "−" : "+"}</span>
      </button>

      {expanded && (
        <div className="mt-2 border-t border-line pt-2">
          {card.clientEmail && (
            <p className="mb-2 truncate text-[12px] text-muted">{card.clientEmail}</p>
          )}

          {card.emails.recent.length === 0 ? (
            <p className="text-[12px] text-muted">
              No messages yet. Confirmations go out when Stripe confirms the
              deposit.
            </p>
          ) : (
            <ul className="grid gap-1.5">
              {card.emails.recent.map((m) => (
                <li key={m.id} className="text-[12px]">
                  <span className="flex items-start justify-between gap-2">
                    <span className="min-w-0 truncate capitalize">
                      {m.kind.replace(/_/g, " ")}
                      <span className="text-muted"> · {m.channel}</span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0",
                        m.status === "sent" || m.status === "delivered"
                          ? "text-moss"
                          : m.status === "failed"
                            ? "text-[#B4483C]"
                            : "text-muted",
                      )}
                    >
                      {m.status}
                    </span>
                  </span>
                  {m.subject && (
                    <span className="block truncate text-muted">{m.subject}</span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <Link
            href={`/studio/messages?booking=${card.id}`}
            className="mt-2 inline-block text-[12px] text-moss underline underline-offset-2"
          >
            Read the full messages →
          </Link>
        </div>
      )}
    </article>
  );
}

function Headline({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  tone?: "good" | "warn";
}) {
  return (
    <div className="rounded-[6px] border border-line px-5 py-4">
      <div className="text-[11px] tracking-[0.12em] text-sage uppercase">{label}</div>
      <div
        className={cn(
          "mt-1.5 font-serif text-[28px]",
          tone === "good" ? "text-moss" : tone === "warn" ? "text-gold" : "text-ink",
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-[12px] text-muted">{hint}</div>
    </div>
  );
}
