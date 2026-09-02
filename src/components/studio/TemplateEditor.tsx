"use client";

import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { AVAILABLE_PLACEHOLDERS, placeholdersUsed, render } from "@/lib/comms/render";
import { saveTemplateAction, type ActionResult } from "@/lib/studio/actions";
import { formatDateShort } from "@/lib/time";
import { cn } from "@/lib/utils";

type Template = {
  id: string;
  kind: string;
  channel: string;
  subject: string | null;
  body: string;
  is_active: boolean;
  updated_at: string;
};

/** Sample values so the preview reads like a real message, not a form. */
const SAMPLE = {
  customer: { firstName: "Ada", lastName: "Okafor", email: "ada@example.com" },
  booking: {
    reference: "PHS-1042",
    serviceName: "Silk Press",
    staffName: "Amara Bennett",
    whenLong: "Wednesday, 2 September 2026 at 10:00",
    whenShort: "Wed, 2 Sept at 10:00",
    duration: "1 hour 30 minutes",
    total: "£85.00",
    depositPaid: "£30.00",
    balance: "£55.00",
    refundNote: "Your £30.00 deposit will be refunded within five working days.",
    weeksSince: "6",
  },
  service: {
    preparation: "Arrive with clean, detangled hair.",
    aftercare: "Wrap at night and avoid moisture for three days.",
  },
  payment: { amount: "£30.00" },
  salon: {
    name: "Prestige Hair Society",
    address: "2 Queens Road, London SW11 1AA",
    phone: "020 7000 0000",
  },
  waitlist: { expiresAt: "Today at 17:00" },
  links: {
    manage: "https://example.com/account/bookings",
    book: "https://example.com/book",
    offer: "https://example.com/book/offer/abc",
    retry: "https://example.com/book?retry=PHS-1042",
    review: "https://example.com/account/bookings",
    preferences: "https://example.com/account/preferences",
  },
};

export function TemplateEditor({ templates }: { templates: Template[] }) {
  const [selectedId, setSelectedId] = useState(templates[0]?.id ?? null);
  const selected = templates.find((t) => t.id === selectedId) ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
      <ul className="max-h-[70vh] overflow-y-auto rounded-[6px] border border-line">
        {templates.map((t) => (
          <li key={t.id} className="border-b border-line last:border-0">
            <button
              type="button"
              onClick={() => setSelectedId(t.id)}
              aria-current={t.id === selectedId ? "true" : undefined}
              className={cn(
                "w-full cursor-pointer px-4 py-3 text-left transition-colors",
                t.id === selectedId ? "bg-sand" : "hover:bg-sand/60",
              )}
            >
              <span className="block text-[14px] capitalize">
                {t.kind.replace(/_/g, " ")}
              </span>
              <span className="mt-0.5 flex items-center gap-2 text-[12px] text-muted">
                <span className="rounded-[3px] border border-line px-1.5">{t.channel}</span>
                {!t.is_active && <span className="text-gold">off</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {selected ? (
        <TemplateForm key={selected.id} template={selected} />
      ) : (
        <p className="rounded-[6px] border border-line px-5 py-6 text-[15px] text-muted">
          No templates yet. Run supabase/seed.sql to create the default set.
        </p>
      )}
    </div>
  );
}

function TemplateForm({ template }: { template: Template }) {
  const [subject, setSubject] = useState(template.subject ?? "");
  const [body, setBody] = useState(template.body);
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveTemplateAction,
    null,
  );

  // Anything referenced that we cannot supply will render as an empty string
  // in a real message, so surface it here rather than in someone's inbox.
  const unknown = useMemo(() => {
    const used = [...placeholdersUsed(subject), ...placeholdersUsed(body)];
    return [...new Set(used)].filter(
      (p) => !(AVAILABLE_PLACEHOLDERS as readonly string[]).includes(p),
    );
  }, [subject, body]);

  return (
    <div className="grid gap-5">
      <form action={action} className="rounded-[6px] border border-line px-5 py-5">
        <input type="hidden" name="templateId" value={template.id} />

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-serif text-[22px] capitalize">
            {template.kind.replace(/_/g, " ")}
          </h2>
          <span className="text-[13px] text-muted">
            {template.channel} · updated {formatDateShort(template.updated_at)}
          </span>
        </div>

        {template.channel === "email" && (
          <label className="mb-4 block">
            <span className="mb-1.5 block text-[13px] text-muted">Subject</span>
            <Input
              name="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </label>
        )}

        <label className="block">
          <span className="mb-1.5 block text-[13px] text-muted">
            Message{" "}
            {template.channel === "sms" && (
              <span className={body.length > 160 ? "text-gold" : ""}>
                ({body.length} characters{body.length > 160 && " — over one SMS"})
              </span>
            )}
          </span>
          <Textarea
            name="body"
            rows={12}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="font-mono text-[13px]"
          />
        </label>

        <label className="mt-4 flex items-center gap-2.5 text-[14px]">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={template.is_active}
            className="h-[18px] w-[18px] accent-ink"
          />
          Send this message
        </label>

        {unknown.length > 0 && (
          <p className="mt-4 rounded-[4px] border border-gold px-3 py-2 text-[13px] leading-[1.5]">
            <span className="text-gold">Unknown placeholder{unknown.length > 1 && "s"}:</span>{" "}
            {unknown.join(", ")} — these render as nothing in a real message.
          </p>
        )}

        {state?.error && (
          <p role="alert" className="mt-4 text-[14px] text-[#B4483C]">
            {state.error}
          </p>
        )}
        {state?.message && (
          <p role="status" className="mt-4 text-[14px] text-moss">
            {state.message}
          </p>
        )}

        <Button type="submit" className="mt-5" disabled={pending}>
          {pending ? "Saving…" : "Save template"}
        </Button>
      </form>

      <section className="rounded-[6px] border border-line px-5 py-5">
        <h3 className="mb-3 text-[12px] tracking-[0.16em] text-sage uppercase">
          Preview with sample data
        </h3>
        {template.channel === "email" && subject && (
          <p className="mb-3 border-b border-line pb-3 text-[14px]">
            <span className="text-muted">Subject: </span>
            {render(subject, SAMPLE)}
          </p>
        )}
        <pre className="rounded-[4px] bg-white px-4 py-4 font-sans text-[14px] leading-[1.7] whitespace-pre-wrap">
          {render(body, SAMPLE)}
        </pre>
      </section>

      <section className="rounded-[6px] border border-line px-5 py-5">
        <h3 className="mb-3 text-[12px] tracking-[0.16em] text-sage uppercase">
          Placeholders you can use
        </h3>
        <ul className="flex flex-wrap gap-2">
          {AVAILABLE_PLACEHOLDERS.map((p) => (
            <li key={p}>
              <button
                type="button"
                onClick={() => setBody((b) => `${b}{{${p}}}`)}
                className="cursor-pointer rounded-[3px] border border-line px-2 py-1 font-mono text-[12px] hover:border-gold"
              >
                {`{{${p}}}`}
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[12px] leading-[1.5] text-muted">
          Click one to append it. Anything else in double braces renders as
          nothing.
        </p>
      </section>
    </div>
  );
}
