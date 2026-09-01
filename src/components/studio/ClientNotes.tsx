"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/field";
import { addClientNoteAction, type ActionResult } from "@/lib/studio/actions";
import { formatDateShort } from "@/lib/time";

type Note = {
  id: string;
  body: string;
  kind: string;
  createdAt: string;
  author: string;
};

const KIND_LABELS: Record<string, string> = {
  note: "Note",
  formula: "Formula",
  product: "Product",
  complaint: "Complaint",
};

/**
 * Internal notes.
 *
 * These are staff-only by RLS, not by the fact that this component lives under
 * /studio. The banner says so plainly, because a note written as if the client
 * will never read it is exactly the kind that ends up in a subject access
 * request.
 */
export function ClientNotes({
  profileId,
  notes,
  currentUserName,
}: {
  profileId: string;
  notes: Note[];
  currentUserName: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    addClientNoteAction,
    null,
  );

  return (
    <section className="rounded-[6px] border border-line px-5 py-5">
      <h2 className="mb-1 text-[12px] tracking-[0.16em] text-sage uppercase">
        Internal notes
      </h2>
      <p className="mb-4 text-[12px] leading-[1.5] text-muted">
        Not shown to the client — but they can request a copy under data
        protection law. Write accordingly.
      </p>

      <form action={action} className="mb-5">
        <input type="hidden" name="profileId" value={profileId} />

        <Textarea
          name="body"
          rows={3}
          required
          placeholder={`Add a note as ${currentUserName}…`}
          className="mb-2"
          aria-label="Note"
        />

        <div className="flex gap-2">
          <Select name="kind" defaultValue="note" aria-label="Note type" className="flex-1">
            <option value="note">Note</option>
            <option value="formula">Formula</option>
            <option value="product">Product</option>
            <option value="complaint">Complaint</option>
          </Select>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Saving…" : "Add"}
          </Button>
        </div>

        {state?.error && (
          <p role="alert" className="mt-2 text-[13px] text-[#B4483C]">
            {state.error}
          </p>
        )}
      </form>

      {notes.length === 0 ? (
        <p className="text-[14px] text-muted">No notes yet.</p>
      ) : (
        <ul className="grid gap-3">
          {notes.map((note) => (
            <li key={note.id} className="border-t border-line pt-3 first:border-0 first:pt-0">
              <div className="mb-1 flex items-center gap-2 text-[12px] text-muted">
                <span className="rounded-[3px] border border-line px-1.5 py-0.5">
                  {KIND_LABELS[note.kind] ?? note.kind}
                </span>
                <span>{note.author}</span>
                <span>·</span>
                <time dateTime={note.createdAt}>{formatDateShort(note.createdAt)}</time>
              </div>
              <p className="text-[14px] leading-[1.6] whitespace-pre-wrap">{note.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
