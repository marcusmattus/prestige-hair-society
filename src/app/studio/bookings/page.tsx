import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth/roles";
import { balanceDue, formatPence } from "@/lib/money";
import { BOOKING_STATUSES, asEnum } from "@/lib/studio/filters";
import { depositState } from "@/lib/studio/pipeline";
import { createClient } from "@/lib/supabase/server";
import { formatTime, formatWhenShort, toSalonDate } from "@/lib/time";

export const metadata: Metadata = {
  title: "Studio — bookings",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;

const STATUSES = BOOKING_STATUSES;

/**
 * Every booking, searchable.
 *
 * The calendar answers "what does Tuesday look like"; this answers "where is
 * that appointment for Mrs Okafor" and "what is still unpaid this month".
 * Both read the same rows.
 */
async function loadBookings(params: {
  from?: string;
  to?: string;
  status?: string;
  staffId?: string;
  q?: string;
  page: number;
}) {
  const supabase = await createClient();

  // Default window: a week back, a month forward. Most front-desk questions
  // are about the near future, and an unbounded scan gets slow.
  const today = toSalonDate(new Date());
  const from = params.from || shift(today, -7);
  const to = params.to || shift(today, 30);

  let query = supabase
    .from("bookings")
    .select(
      `id, reference, status, starts_at, ends_at, total_price_pence,
       deposit_pence, deposit_paid_pence, balance_paid_pence, source, is_walk_in,
       service:service_id(name),
       staff:staff_id(id, display_name),
       profile:profile_id(id, first_name, last_name, email, phone),
       salon:salon_id(timezone)`,
      { count: "exact" },
    )
    .gte("starts_at", `${from}T00:00:00Z`)
    .lte("starts_at", `${to}T23:59:59Z`)
    .order("starts_at", { ascending: true })
    .range((params.page - 1) * PAGE_SIZE, params.page * PAGE_SIZE - 1);

  const status = asEnum(params.status, BOOKING_STATUSES);
  if (status) query = query.eq("status", status);
  if (params.staffId) query = query.eq("staff_id", params.staffId);

  // A reference is exact; anything else is a name or email search, which has
  // to go through the joined profile.
  if (params.q?.trim()) {
    const term = params.q.trim();
    if (/^PHS-\d+$/i.test(term)) {
      query = query.eq("reference", term.toUpperCase());
    } else {
      const safe = term.replace(/[,()]/g, " ");
      query = query.or(
        `first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%`,
        { referencedTable: "profile" },
      );
    }
  }

  const { data, count } = await query;
  return { rows: data ?? [], total: count ?? 0, from, to };
}

export default async function StudioBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    status?: string;
    staff?: string;
    q?: string;
    page?: string;
  }>;
}) {
  await requireStaff("/studio/bookings");
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const supabase = await createClient();
  const [{ rows, total, from, to }, { data: staff }] = await Promise.all([
    loadBookings({
      from: sp.from,
      to: sp.to,
      status: sp.status,
      staffId: sp.staff,
      q: sp.q,
      page,
    }),
    supabase
      .from("staff")
      .select("id, display_name")
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("display_order"),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const unpaid = rows.reduce(
    (sum, b) =>
      ["confirmed", "completed"].includes(b.status)
        ? sum +
          balanceDue(b.total_price_pence, b.deposit_paid_pence, b.balance_paid_pence)
        : sum,
    0,
  );

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-[32px] font-light">Bookings</h1>
          <p className="mt-1 text-[14px] text-muted">
            {total} in this range · {formatPence(unpaid)} still due in salon
          </p>
        </div>
        <Link
          href="/studio/calendar"
          className="rounded-[4px] border border-line px-4 py-2.5 text-[14px] hover:border-gold"
        >
          Calendar view →
        </Link>
      </div>

      <form
        method="get"
        className="mb-6 grid gap-3 rounded-[6px] border border-line bg-sand px-5 py-4 sm:grid-cols-2 lg:grid-cols-5"
      >
        <Labelled label="From">
          <input type="date" name="from" defaultValue={from} className={FIELD} />
        </Labelled>
        <Labelled label="To">
          <input type="date" name="to" defaultValue={to} className={FIELD} />
        </Labelled>
        <Labelled label="Status">
          <select name="status" defaultValue={sp.status ?? ""} className={FIELD}>
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </Labelled>
        <Labelled label="Stylist">
          <select name="staff" defaultValue={sp.staff ?? ""} className={FIELD}>
            <option value="">Any stylist</option>
            {(staff ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.display_name}
              </option>
            ))}
          </select>
        </Labelled>
        <Labelled label="Search">
          <div className="flex gap-2">
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Name, email or PHS-1042"
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

      {rows.length === 0 ? (
        <p className="rounded-[6px] border border-line bg-sand px-5 py-6 text-[15px] text-muted">
          Nothing matches those filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-[6px] border border-line">
          <table className="w-full min-w-[900px] text-[14px]">
            <caption className="sr-only">Bookings</caption>
            <thead>
              <tr className="border-b border-line bg-sand text-left">
                <Th>When</Th>
                <Th>Reference</Th>
                <Th>Client</Th>
                <Th>Service</Th>
                <Th>Stylist</Th>
                <Th>Status</Th>
                <Th>Deposit</Th>
                <Th>Balance</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => {
                const tz = b.salon?.timezone ?? "Europe/London";
                const balance = balanceDue(
                  b.total_price_pence,
                  b.deposit_paid_pence,
                  b.balance_paid_pence,
                );
                return (
                  <tr key={b.id} className="border-b border-line last:border-0">
                    <Td>
                      <Link
                        href={`/studio/bookings/${b.id}`}
                        className="underline underline-offset-2"
                      >
                        {formatWhenShort(b.starts_at, tz)}
                      </Link>
                      <span className="block text-[13px] text-muted">
                        to {formatTime(b.ends_at, tz)}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-mono text-[13px]">{b.reference}</span>
                      {b.is_walk_in && (
                        <span className="block text-[12px] text-gold">walk-in</span>
                      )}
                    </Td>
                    <Td>
                      {b.profile ? (
                        <Link
                          href={`/studio/clients/${b.profile.id}`}
                          className="underline underline-offset-2"
                        >
                          {`${b.profile.first_name} ${b.profile.last_name}`.trim() || "—"}
                        </Link>
                      ) : (
                        "—"
                      )}
                      {b.profile?.phone && (
                        <span className="block text-[13px] text-muted">
                          {b.profile.phone}
                        </span>
                      )}
                    </Td>
                    <Td>{b.service?.name ?? "—"}</Td>
                    <Td className="text-muted">{b.staff?.display_name ?? "—"}</Td>
                    <Td>
                      <StatusPill status={b.status} />
                    </Td>
                    <Td>
                      <DepositPill
                        state={depositState({
                          depositPence: b.deposit_pence,
                          depositPaidPence: b.deposit_paid_pence,
                        })}
                        paidPence={b.deposit_paid_pence}
                        duePence={b.deposit_pence}
                      />
                    </Td>
                    <Td>
                      {balance > 0 ? (
                        formatPence(balance)
                      ) : (
                        <span className="text-muted">settled</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-5 flex items-center gap-3 text-[14px]">
          {page > 1 && (
            <Link
              href={pageHref(sp, page - 1)}
              className="rounded-[4px] border border-line px-4 py-2 hover:border-gold"
            >
              ← Previous
            </Link>
          )}
          <span className="text-muted">
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Link
              href={pageHref(sp, page + 1)}
              className="rounded-[4px] border border-line px-4 py-2 hover:border-gold"
            >
              Next →
            </Link>
          )}
        </nav>
      )}
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

/**
 * Deposit state, spelled out rather than inferred.
 *
 * "Outstanding" is the one that costs the salon money, so it is the one that
 * is coloured; a service with no deposit required reads as quiet text rather
 * than a green tick it has not earned.
 */
function DepositPill({
  state,
  paidPence,
  duePence,
}: {
  state: "paid" | "outstanding" | "none_required";
  paidPence: number;
  duePence: number;
}) {
  if (state === "none_required") {
    return <span className="text-[13px] text-muted">none required</span>;
  }

  if (state === "paid") {
    return (
      <span className="rounded-[3px] border border-moss px-2 py-0.5 text-[12px] text-moss">
        paid {formatPence(paidPence)}
      </span>
    );
  }

  return (
    <span className="rounded-[3px] border border-[#B4483C] px-2 py-0.5 text-[12px] text-[#B4483C]">
      {paidPence > 0
        ? `${formatPence(paidPence)} of ${formatPence(duePence)}`
        : `${formatPence(duePence)} due`}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "confirmed" || status === "completed"
      ? "border-moss text-moss"
      : status === "pending_payment"
        ? "border-gold text-gold"
        : "border-line text-muted";
  return (
    <span className={`rounded-[3px] border px-2 py-0.5 text-[12px] capitalize ${tone}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 font-medium text-muted">{children}</th>;
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

function pageHref(sp: Record<string, string | undefined>, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(sp)) {
    if (value && key !== "page") params.set(key, value);
  }
  params.set("page", String(page));
  return `/studio/bookings?${params}`;
}

function shift(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
