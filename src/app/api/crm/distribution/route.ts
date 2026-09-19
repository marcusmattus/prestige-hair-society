import { NextResponse } from "next/server";
import { z } from "zod";
import { serverEnv } from "@/lib/env";
import { sendCampaign } from "@/lib/crm/distribution";

export const runtime = "nodejs";

/**
 * Send a CRM email distribution (marketing broadcast).
 *
 * Staff-only: authenticated with the CRON_SECRET as a Bearer token, the same
 * secret used by the app's scheduled routes. Never expose this to the browser.
 *
 *   curl -X POST /api/crm/distribution \
 *     -H "authorization: Bearer $CRON_SECRET" \
 *     -H "content-type: application/json" \
 *     -d '{"campaignId":"autumn-2026","subject":"Autumn hair, refreshed",
 *          "heading":"A new season for your hair","bodyHtml":"<p>Hi {{firstName}}…</p>"}'
 */
const schema = z.object({
  campaignId: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._:-]+$/, "campaignId must be url-safe"),
  subject: z.string().trim().min(1).max(200),
  heading: z.string().trim().max(200).optional(),
  bodyHtml: z.string().trim().min(1).max(50_000),
  testRecipients: z.array(z.email()).max(20).optional(),
  dryRun: z.boolean().optional(),
});

function authorised(request: Request) {
  const { CRON_SECRET } = serverEnv();
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;
  return Boolean(token) && token === CRON_SECRET;
}

export async function POST(request: Request) {
  try {
    if (!authorised(request)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    const input = schema.parse(await request.json());
    const result = await sendCampaign(input);
    return NextResponse.json(result);
  } catch (cause) {
    console.error("crm_distribution_error", cause);
    if (cause instanceof z.ZodError) return NextResponse.json({ error: "Invalid campaign", issues: cause.issues }, { status: 400 });
    const message = cause instanceof Error && cause.message.includes("configured")
      ? "Email sending is not configured yet."
      : cause instanceof Error ? cause.message : "Unable to send campaign";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
