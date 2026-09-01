import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";

/**
 * Append-only audit trail for sensitive staff actions.
 *
 * Metadata is redacted before it is written: nothing here should ever contain
 * card data, a Stripe secret, a session token or a customer's medical notes.
 * The audit log answers "who changed what, when", not "what did it say".
 */

const REDACTED = "[redacted]";

/** Keys whose values are never stored, at any depth. */
const SENSITIVE_KEYS = [
  "password",
  "token",
  "secret",
  "authorization",
  "cookie",
  "card",
  "cvc",
  "cvv",
  "pan",
  "iban",
  "client_secret",
  "clientsecret",
  "allergies",
  "internal_notes",
  "internalnotes",
  "body", // client_notes bodies are personal; log the id, not the text
];

export function redact(value: unknown, depth = 0): Json {
  if (depth > 6) return REDACTED;
  if (value === null || value === undefined) return null;

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((v) => redact(v, depth + 1));
  }

  if (typeof value === "object") {
    const out: Record<string, Json> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s))
        ? REDACTED
        : redact(val, depth + 1);
    }
    return out;
  }

  if (typeof value === "string") {
    // Truncate long free text rather than storing it wholesale.
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }

  if (typeof value === "number" || typeof value === "boolean") return value;

  return String(value);
}

export type AuditEntry = {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * Record an action. Never throws: a failed audit write must not roll back the
 * operation it describes, but it is logged loudly so the gap is visible.
 */
export async function audit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("audit_logs").insert({
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      metadata: (entry.metadata ? redact(entry.metadata) : {}) as Json,
      ip_address: entry.ipAddress ?? null,
      user_agent: entry.userAgent?.slice(0, 500) ?? null,
    });
    if (error) console.error("[audit] write failed", error.message, entry.action);
  } catch (err) {
    console.error("[audit] write threw", err);
  }
}

/** Pull the client IP and user agent off a request, for audit context. */
export function requestContext(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  return {
    ipAddress: forwarded?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
  };
}
