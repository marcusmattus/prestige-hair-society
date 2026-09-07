"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  removePhotoAction,
  setPhotoUrlAction,
  uploadPhotoAction,
  type PhotoResult,
} from "@/lib/studio/photo-actions";

const FIELD =
  "min-h-[40px] w-full rounded-[4px] border border-line bg-white px-3 py-2 text-[14px]";

export type SlotState = {
  slot: string;
  label: string;
  hint: string;
  url: string | null;
  alt: string;
  caption: string | null;
  focalX: number;
  focalY: number;
};

/**
 * One image slot: what is there now, and the two ways to change it.
 *
 * Upload is what the salon will use. The link route exists because it needs no
 * storage bucket — a photograph committed to `public/photos/` works with
 * nothing configured at all, which is the only route available before the
 * Supabase project is set up.
 */
export function PhotoSlot({ state }: { state: SlotState }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"upload" | "link">("upload");

  const [uploadState, upload, uploading] = useActionState<PhotoResult | null, FormData>(
    uploadPhotoAction,
    null,
  );
  const [linkState, link, linking] = useActionState<PhotoResult | null, FormData>(
    setPhotoUrlAction,
    null,
  );
  const [removeState, remove, removing] = useActionState<PhotoResult | null, FormData>(
    removePhotoAction,
    null,
  );

  const result = uploadState ?? linkState ?? removeState;

  return (
    <li className="rounded-[6px] border border-line">
      <div className="flex flex-wrap items-start gap-4 px-5 py-4">
        <div className="h-20 w-16 shrink-0 overflow-hidden rounded-[4px] border border-line">
          {state.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={state.url}
              alt=""
              style={{ objectPosition: `${state.focalX}% ${state.focalY}%` }}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="stripe-warm h-full w-full" />
          )}
        </div>

        <div className="min-w-[200px] flex-1">
          <div className="text-[15px]">
            {state.label}
            {!state.url && (
              <span className="ml-2 rounded-[3px] border border-line px-2 py-0.5 text-[12px] text-muted">
                placeholder
              </span>
            )}
          </div>
          <p className="mt-1 text-[13px] leading-[1.6] text-muted">{state.hint}</p>
          {state.url && state.alt && (
            <p className="mt-1 text-[13px] text-muted">
              Described as: &ldquo;{state.alt}&rdquo;
            </p>
          )}
        </div>

        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : state.url ? "Replace" : "Add"}
          </Button>
          {state.url && (
            <form action={remove}>
              <input type="hidden" name="slot" value={state.slot} />
              <Button type="submit" size="sm" variant="outline" disabled={removing}>
                {removing ? "Removing…" : "Remove"}
              </Button>
            </form>
          )}
        </div>
      </div>

      {result?.error && (
        <p role="alert" className="border-t border-line px-5 py-3 text-[14px] text-[#B4483C]">
          {result.error}
        </p>
      )}
      {result?.message && (
        <p role="status" className="border-t border-line px-5 py-3 text-[14px] text-moss">
          {result.message}
        </p>
      )}

      {open && (
        <div className="border-t border-line px-5 py-5">
          <div
            role="tablist"
            aria-label="How to add the image"
            className="mb-4 flex gap-2"
          >
            {(["upload", "link"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={`min-h-[36px] cursor-pointer rounded-[4px] border px-4 py-1.5 text-[13px] ${
                  mode === m ? "border-ink bg-ink text-sand" : "border-line text-ink"
                }`}
              >
                {m === "upload" ? "Upload a file" : "Use a path or address"}
              </button>
            ))}
          </div>

          <form action={mode === "upload" ? upload : link}>
            <input type="hidden" name="slot" value={state.slot} />

            {mode === "upload" ? (
              <label className="mb-4 block text-[13px]">
                <span className="mb-1.5 block tracking-[0.06em] text-sage uppercase">
                  Image file
                </span>
                <input
                  type="file"
                  name="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  required
                  className="text-[14px] text-muted file:mr-3 file:cursor-pointer file:rounded-[4px] file:border file:border-line file:bg-cream file:px-4 file:py-2 file:text-[14px] file:text-ink"
                />
                <span className="mt-1.5 block text-[13px] text-muted">
                  JPEG, PNG, WebP or AVIF, up to 8 MB.
                </span>
              </label>
            ) : (
              <label className="mb-4 block text-[13px]">
                <span className="mb-1.5 block tracking-[0.06em] text-sage uppercase">
                  Path or address
                </span>
                <input
                  name="url"
                  defaultValue={state.url ?? ""}
                  placeholder="/photos/salon-interior.jpg"
                  required
                  className={FIELD}
                />
                <span className="mt-1.5 block text-[13px] leading-[1.6] text-muted">
                  A file in <code>public/</code> starts with a slash. An address
                  elsewhere must be https.
                </span>
              </label>
            )}

            <label className="mb-4 block text-[13px]">
              <span className="mb-1.5 block tracking-[0.06em] text-sage uppercase">
                Describe it
              </span>
              <input
                name="alt"
                defaultValue={state.alt}
                required
                placeholder="The salon's front room, with a stylist at the chair"
                className={FIELD}
              />
              <span className="mt-1.5 block text-[13px] text-muted">
                Read aloud to anyone using a screen reader. A sentence is plenty.
              </span>
            </label>

            <div className="grid gap-3 sm:grid-cols-[1fr_100px_100px]">
              <label className="text-[13px]">
                <span className="mb-1.5 block tracking-[0.06em] text-sage uppercase">
                  Caption (optional)
                </span>
                <input name="caption" defaultValue={state.caption ?? ""} className={FIELD} />
              </label>

              <label className="text-[13px]">
                <span className="mb-1.5 block tracking-[0.06em] text-sage uppercase">
                  Focus ←→
                </span>
                <input
                  type="number"
                  name="focalX"
                  min={0}
                  max={100}
                  defaultValue={state.focalX}
                  className={FIELD}
                />
              </label>

              <label className="text-[13px]">
                <span className="mb-1.5 block tracking-[0.06em] text-sage uppercase">
                  Focus ↑↓
                </span>
                <input
                  type="number"
                  name="focalY"
                  min={0}
                  max={100}
                  defaultValue={state.focalY}
                  className={FIELD}
                />
              </label>
            </div>

            <p className="mt-2 mb-4 text-[13px] leading-[1.6] text-muted">
              Focus is the part to keep when the image is cropped, as a
              percentage. 50/50 centres it; lower the second number to keep a
              face near the top of the frame.
            </p>

            <Button type="submit" disabled={uploading || linking}>
              {uploading || linking ? "Saving…" : "Save image"}
            </Button>
          </form>
        </div>
      )}
    </li>
  );
}
