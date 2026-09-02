import type { Metadata } from "next";
import Link from "next/link";
import { TemplateEditor } from "@/components/studio/TemplateEditor";
import { requireManager } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Studio — message templates",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Template editing.
 *
 * Manager and admin only: these are what every customer reads, and a mistake
 * here reaches everyone at once. The editor lists the available placeholders
 * rather than expecting staff to remember them, and previews with sample
 * values so a typo in `{{booking.refrence}}` is visible before it ships.
 */
export default async function TemplatesPage() {
  await requireManager("/studio/messages/templates");
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("message_templates")
    .select("id, kind, channel, subject, body, is_active, updated_at")
    .order("kind")
    .order("channel");

  return (
    <div>
      <Link href="/studio/messages" className="text-[14px] text-muted hover:text-ink">
        ← Message log
      </Link>

      <div className="mt-4 mb-6">
        <h1 className="font-serif text-[32px] font-light">Message templates</h1>
        <p className="mt-1 max-w-[640px] text-[15px] leading-[1.7] text-muted">
          What the salon sends, and when. Editing a template changes every
          message sent from now on; messages already in the log keep the text
          they were sent with.
        </p>
      </div>

      <TemplateEditor templates={templates ?? []} />
    </div>
  );
}
