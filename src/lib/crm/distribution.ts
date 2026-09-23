import "server-only";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailEnv } from "@/lib/env";
import { SALON_EMAIL } from "@/lib/email";

/**
 * CRM email distribution — send a marketing broadcast to consenting clients.
 *
 * This is deliberately consent-first and idempotent:
 *   - Only profiles with `marketing_email = true` (the working mirror of the
 *     latest granted marketing_email consent) are ever contacted.
 *   - Every send is written to `message_deliveries` with an idempotency key of
 *     `campaign:<campaignId>:<profileId>`. A re-run of the same campaign skips
 *     anyone already sent, so a retry or a double-click never double-mails.
 *   - Sends go through Resend, the same provider as transactional mail.
 *
 * Nothing here trusts the browser: the route that calls it is authenticated
 * with the CRON_SECRET, and this uses the service-role client.
 */

export type Campaign = {
  /** Stable id for idempotency. Reusing it resumes/completes a prior run. */
  campaignId: string;
  subject: string;
  /** Pre-heading shown above the body (optional). */
  heading?: string;
  /**
   * Body as HTML or plain text with {{placeholders}}:
   * {{firstName}} {{lastName}} {{name}} {{email}}.
   */
  bodyHtml: string;
  /** Preview to a fixed set of addresses instead of the CRM (not logged). */
  testRecipients?: string[];
  /** Count recipients and render, but send nothing and log nothing. */
  dryRun?: boolean;
};

export type DistributionResult = {
  campaignId: string;
  recipients: number;
  sent: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  test: boolean;
  errors: Array<{ email: string; message: string }>;
};

type Recipient = { id: string; email: string; first_name: string; last_name: string };

const PALETTE = { ink: "#213126", cream: "#fbfaf6", sage: "#8f9b7b", muted: "#687067", line: "#ded9cd" };

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]!));

/** Render {{placeholders}} against a recipient's fields. Unknown keys blank. */
export function renderTemplate(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => vars[key] ?? "");
}

function personalise(campaign: Campaign, r: { first_name?: string; last_name?: string; email: string }) {
  const first = (r.first_name || "").trim();
  const last = (r.last_name || "").trim();
  const vars = { firstName: first || "there", lastName: last, name: `${first} ${last}`.trim() || "there", email: r.email };
  return {
    subject: renderTemplate(campaign.subject, vars),
    body: renderTemplate(campaign.bodyHtml, vars),
  };
}

/** Wrap the campaign body in the salon's email shell. */
function wrap(bodyHtml: string, heading: string | undefined, email: string) {
  const head = heading ? `<h1 style="font-family:Georgia,serif;font-weight:400;color:${PALETTE.ink}">${escape(heading)}</h1>` : "";
  const footer = `<p style="margin-top:28px;font-size:12px;color:${PALETTE.muted};line-height:1.6">You are receiving this because you opted in to hear from Prestige Hair Society at ${escape(email)}. To stop these emails, reply with the word UNSUBSCRIBE and we will remove you.</p>`;
  return `<div style="background:${PALETTE.cream};padding:36px 18px;font-family:Arial,sans-serif;color:${PALETTE.ink}"><div style="max-width:560px;margin:auto;background:#fff;border:1px solid ${PALETTE.line};padding:32px"><p style="font-size:12px;letter-spacing:2px;color:${PALETTE.sage};text-transform:uppercase">Prestige Hair Society</p>${head}<div style="line-height:1.6;color:${PALETTE.ink}">${bodyHtml}</div>${footer}<p style="margin-top:24px;color:${PALETTE.muted}">KOOP Studio · 2 Queenstown Road · London SW8 3RX</p></div></div>`;
}

async function resolveSalonId(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin
    .from("salons")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not resolve salon: ${error.message}`);
  if (!data) throw new Error("No salon configured");
  return data.id as string;
}

/** Everyone who has opted in to marketing email and has not been deleted. */
async function marketingRecipients(admin: ReturnType<typeof createAdminClient>): Promise<Recipient[]> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, email, first_name, last_name")
    .eq("marketing_email", true)
    .is("deleted_at", null);
  if (error) throw new Error(`Could not load recipients: ${error.message}`);
  return (data ?? []).filter((r): r is Recipient => Boolean(r.email));
}

export async function sendCampaign(campaign: Campaign): Promise<DistributionResult> {
  const { RESEND_API_KEY, EMAIL_FROM } = emailEnv();
  const resend = new Resend(RESEND_API_KEY);
  const test = Boolean(campaign.testRecipients?.length);

  const result: DistributionResult = {
    campaignId: campaign.campaignId,
    recipients: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    dryRun: Boolean(campaign.dryRun),
    test,
    errors: [],
  };

  // --- Test mode: send to explicit addresses, never touch the CRM or ledger.
  if (test) {
    const recipients = campaign.testRecipients!;
    result.recipients = recipients.length;
    if (campaign.dryRun) return result;
    for (const email of recipients) {
      const { subject, body } = personalise(campaign, { email });
      const { error } = await resend.emails.send({ from: EMAIL_FROM, to: email, replyTo: SALON_EMAIL, subject, html: wrap(body, campaign.heading, email) });
      if (error) { result.failed++; result.errors.push({ email, message: error.message }); }
      else result.sent++;
    }
    return result;
  }

  const admin = createAdminClient();
  const salonId = await resolveSalonId(admin);
  const recipients = await marketingRecipients(admin);
  result.recipients = recipients.length;
  if (campaign.dryRun) return result;

  // Skip anyone already mailed for this campaign (idempotency).
  const keyFor = (profileId: string) => `campaign:${campaign.campaignId}:${profileId}`;
  const { data: existing, error: existingError } = await admin
    .from("message_deliveries")
    .select("idempotency_key")
    .in("idempotency_key", recipients.map((r) => keyFor(r.id)));
  if (existingError) throw new Error(`Could not read delivery ledger: ${existingError.message}`);
  const alreadySent = new Set((existing ?? []).map((row) => row.idempotency_key));

  for (const recipient of recipients) {
    const idempotencyKey = keyFor(recipient.id);
    if (alreadySent.has(idempotencyKey)) { result.skipped++; continue; }

    const { subject, body } = personalise(campaign, recipient);
    const html = wrap(body, campaign.heading, recipient.email);

    let providerId: string | null = null;
    let status: "sent" | "failed" = "sent";
    let errorMessage: string | null = null;
    try {
      const { data, error } = await resend.emails.send({ from: EMAIL_FROM, to: recipient.email, replyTo: SALON_EMAIL, subject, html });
      if (error) throw new Error(error.message);
      providerId = data?.id ?? null;
    } catch (cause) {
      status = "failed";
      errorMessage = cause instanceof Error ? cause.message : "Unknown send error";
    }

    // Record the outcome. The unique idempotency_key doubles as the send lock:
    // if two runs race, the second insert conflicts and we treat it as skipped.
    const { error: insertError } = await admin.from("message_deliveries").insert({
      salon_id: salonId,
      profile_id: recipient.id,
      kind: "marketing_campaign",
      channel: "email",
      status,
      idempotency_key: idempotencyKey,
      recipient: recipient.email,
      subject,
      body: html,
      provider: "resend",
      provider_message_id: providerId,
      error_message: errorMessage,
      attempts: 1,
      sent_at: status === "sent" ? new Date().toISOString() : null,
    });

    if (insertError) {
      // Most likely a duplicate key from a concurrent run — count as skipped.
      if (insertError.code === "23505") { result.skipped++; continue; }
      result.failed++;
      result.errors.push({ email: recipient.email, message: insertError.message });
      continue;
    }

    if (status === "sent") result.sent++;
    else { result.failed++; result.errors.push({ email: recipient.email, message: errorMessage ?? "send failed" }); }
  }

  return result;
}
