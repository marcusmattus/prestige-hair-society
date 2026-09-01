import "server-only";

import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";

/**
 * Shared plumbing for route handlers: typed JSON responses, one place that
 * turns a database exception into an HTTP status, and a rate limiter.
 */

export type ApiError = {
  error: string;
  message: string;
  fields?: Record<string, string[]>;
};

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(
  status: number,
  error: string,
  message: string,
  fields?: Record<string, string[]>,
) {
  return NextResponse.json({ error, message, fields } satisfies ApiError, { status });
}

/** Parse a request body, returning either the value or a 422 response. */
export async function parseBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<{ data: T; response?: never } | { data?: never; response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { response: fail(400, "invalid_json", "The request body was not valid JSON.") };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { response: fail(422, "validation_failed", "Check the highlighted fields.", fieldErrors(parsed.error)) };
  }
  return { data: parsed.data };
}

export function fieldErrors(error: ZodError): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (out[key] ??= []).push(issue.message);
  }
  return out;
}

/**
 * Map the named exceptions raised by the SQL functions in 0009 onto statuses
 * and customer-readable messages. Anything unrecognised becomes a 500 with a
 * generic message -- database text is never echoed to the browser.
 */
const DB_ERRORS: Record<string, { status: number; message: string }> = {
  slot_unavailable: {
    status: 409,
    message: "That time has just been taken. Choose another and we will hold it for you.",
  },
  hold_expired: {
    status: 410,
    message: "Your slot was only held for a few minutes and has now been released. Please pick a time again.",
  },
  hold_already_used: {
    status: 409,
    message: "This booking has already been started. Check your email for the confirmation.",
  },
  hold_not_found: { status: 404, message: "We could not find that held slot." },
  hold_not_owned: { status: 403, message: "That held slot belongs to another account." },
  too_soon: { status: 422, message: "That appointment is too close to now. Please choose a later time." },
  outside_booking_window: { status: 422, message: "That date is further ahead than we currently take bookings." },
  staff_not_found: { status: 404, message: "That stylist is not available." },
  service_not_found: { status: 404, message: "That service is not available." },
  booking_not_found: { status: 404, message: "We could not find that booking." },
  booking_not_reschedulable: {
    status: 409,
    message: "This appointment can no longer be moved. Please call the salon.",
  },
  booking_pricing_is_read_only: { status: 403, message: "That change is not allowed." },
  booking_scheduling_is_read_only: { status: 403, message: "Use the reschedule option to move an appointment." },
  booking_status_transition_not_allowed: { status: 403, message: "That change is not allowed." },
  internal_notes_are_staff_only: { status: 403, message: "That change is not allowed." },
  payments_are_written_by_the_stripe_webhook: { status: 403, message: "That change is not allowed." },
};

/** Turn a PostgREST/pg error into a response. */
export function fromDatabaseError(error: { message?: string; code?: string } | null) {
  const raw = error?.message ?? "";
  for (const [key, mapped] of Object.entries(DB_ERRORS)) {
    if (raw.includes(key)) return fail(mapped.status, key, mapped.message);
  }

  // Exclusion constraint violations mean someone won the race.
  if (error?.code === "23P01" || raw.includes("exclusion constraint")) {
    return fail(409, "slot_unavailable", DB_ERRORS.slot_unavailable.message);
  }

  console.error("[api] unmapped database error", error);
  return fail(500, "server_error", "Something went wrong at our end. Please try again.");
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * Fixed-window rate limiter.
 *
 * In-memory, so the window is PER SERVERLESS INSTANCE. That is enough to blunt
 * a naive script but is not a distributed limit: on Vercel, several instances
 * each allow the quota. For a hard limit put Upstash Redis behind this
 * function -- the call sites do not change. See docs/DEPLOYMENT.md.
 */
export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  const allowed = bucket.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - bucket.count),
    retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
  };
}

/** Opportunistic cleanup so the map cannot grow without bound. */
function sweepBuckets() {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}
setInterval(sweepBuckets, 60_000).unref?.();

/** Best-effort client identity for rate limiting. */
export function clientKey(request: Request, suffix = ""): string {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  return `${ip}:${suffix}`;
}

/** Guard a route, returning a 429 response when the caller is over quota. */
export function enforceRateLimit(
  request: Request,
  name: string,
  options: { limit: number; windowMs: number },
) {
  const result = rateLimit(clientKey(request, name), options);
  if (result.allowed) return null;
  return NextResponse.json(
    {
      error: "rate_limited",
      message: "Too many attempts. Please wait a moment and try again.",
    } satisfies ApiError,
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
  );
}
