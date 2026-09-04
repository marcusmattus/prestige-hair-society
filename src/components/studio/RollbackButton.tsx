"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { rollbackImportAction, type ApplyState } from "@/lib/import/actions";

/**
 * Rolling back deletes rows, so it asks first. The confirmation names the
 * count rather than saying "are you sure?", because the number is the thing
 * worth checking.
 */
export function RollbackButton({ runId, count }: { runId: string; count: number }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<ApplyState | null, FormData>(
    rollbackImportAction,
    null,
  );

  if (state?.message) {
    return <span className="text-[13px] text-moss">{state.message}</span>;
  }

  return (
    <div className="text-right">
      {confirming ? (
        <form action={action} className="flex items-center gap-2">
          <input type="hidden" name="runId" value={runId} />
          <span className="text-[13px] text-muted">
            Remove {count} imported service{count === 1 ? "" : "s"}?
          </span>
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Removing…" : "Yes, roll back"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setConfirming(false)}
          >
            Keep
          </Button>
        </form>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setConfirming(true)}
        >
          Roll back
        </Button>
      )}

      {state?.error && (
        <p role="alert" className="mt-2 max-w-[320px] text-[13px] text-[#B4483C]">
          {state.error}
        </p>
      )}
    </div>
  );
}
