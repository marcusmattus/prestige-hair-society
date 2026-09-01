import "server-only";

import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

/**
 * Shared guard for /api/cron/*.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. The comparison is
 * constant-time so the endpoint does not leak the secret a byte at a time to
 * anyone willing to measure.
 */
export function authorizeCron(request: Request): Response | null {
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";

  let expected: string;
  try {
    expected = serverEnv().CRON_SECRET;
  } catch {
    // Refuse rather than run unauthenticated when the secret is unset.
    return new Response("Cron is not configured", { status: 503 });
  }

  if (!constantTimeEquals(provided, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }

  return null;
}

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // timingSafeEqual throws on a length mismatch, which is itself a leak, so
  // compare a fixed-width digest of the two instead.
  if (bufA.length !== bufB.length) {
    // Still do the work, to keep the timing flat.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}
