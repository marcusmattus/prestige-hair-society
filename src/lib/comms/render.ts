/**
 * Template rendering.
 *
 * Templates are edited by salon staff in /studio/messages, so the syntax is
 * deliberately tiny: `{{dotted.path}}` and nothing else. There is no
 * expression evaluation, no partials and no includes -- a template is data,
 * and data must not be able to execute.
 *
 * Unknown placeholders render as an empty string rather than leaving
 * `{{booking.reference}}` visible in a customer's inbox.
 */

export type TemplateContext = Record<string, unknown>;

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function render(template: string, context: TemplateContext): string {
  return template.replace(PLACEHOLDER, (_match, path: string) => {
    const value = resolve(context, path);
    if (value === null || value === undefined) return "";
    return String(value);
  });
}

function resolve(context: TemplateContext, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === null || acc === undefined || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, context);
}

/** Placeholders a template references, for the studio editor's live preview. */
export function placeholdersUsed(template: string): string[] {
  return [...new Set([...template.matchAll(PLACEHOLDER)].map((m) => m[1]))];
}

/**
 * Which placeholders are available, shown alongside the editor so staff know
 * what they can use.
 */
export const AVAILABLE_PLACEHOLDERS = [
  "customer.firstName",
  "customer.lastName",
  "customer.email",
  "booking.reference",
  "booking.serviceName",
  "booking.staffName",
  "booking.whenLong",
  "booking.whenShort",
  "booking.duration",
  "booking.total",
  "booking.depositPaid",
  "booking.balance",
  "booking.refundNote",
  "booking.weeksSince",
  "service.preparation",
  "service.aftercare",
  "payment.amount",
  "salon.name",
  "salon.address",
  "salon.phone",
  "waitlist.expiresAt",
  "links.manage",
  "links.book",
  "links.offer",
  "links.retry",
  "links.review",
  "links.preferences",
] as const;
