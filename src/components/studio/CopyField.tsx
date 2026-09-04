"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

/**
 * A secret URL with a copy button and a webcal:// link.
 *
 * The URL is shown masked until revealed: these pages get shared over a
 * shoulder or a screen share more often than anyone plans for, and a calendar
 * feed URL is a credential.
 */
export function CopyField({
  label,
  url,
  webcal,
}: {
  label: string;
  url: string;
  webcal: string;
}) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be refused; revealing lets them copy by hand.
      setRevealed(true);
    }
  }

  const masked = `${url.slice(0, url.lastIndexOf("/") + 1)}${"•".repeat(12)}`;

  return (
    <div className="rounded-[6px] border border-line px-5 py-4">
      <div className="mb-2 text-[14px]">{label}</div>

      <div className="mb-3 overflow-x-auto">
        <code className="text-[13px] break-all text-muted">
          {revealed ? url : masked}
        </code>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={copy}>
          {copied ? "Copied" : "Copy link"}
        </Button>
        <Button asChild size="sm" variant="outline">
          <a href={webcal}>Add to iPhone</a>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setRevealed((v) => !v)}
        >
          {revealed ? "Hide" : "Reveal"}
        </Button>
      </div>
    </div>
  );
}
