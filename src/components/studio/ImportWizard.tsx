"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  applyServiceImportAction,
  previewServiceImportAction,
  type ApplyState,
  type PreviewState,
} from "@/lib/import/actions";
import { SERVICE_TARGETS } from "@/lib/import/services";
import { formatPence } from "@/lib/money";
import { formatDurationShort } from "@/lib/time";

/**
 * Upload → map → review → apply.
 *
 * The mapping step is re-submittable: correcting a column re-runs the preview
 * with the corrected mapping, so the operator sees the effect of the change
 * before anything is written.
 */
export function ImportWizard() {
  const [preview, previewAction, previewing] = useActionState<PreviewState | null, FormData>(
    previewServiceImportAction,
    null,
  );
  const [applied, applyAction, applying] = useActionState<ApplyState | null, FormData>(
    applyServiceImportAction,
    null,
  );

  const report = preview?.report;
  const importable = report?.rows.filter((r) => !r.isDuplicate) ?? [];

  return (
    <div className="grid gap-10">
      <section>
        <h3 className="mb-2 font-serif text-[22px]">1. Upload the export</h3>
        <p className="mb-5 max-w-[620px] text-[14px] leading-[1.7] text-muted">
          Export your services from Slick as CSV. Nothing is written to the
          catalogue at this step — you get a validation report first.
        </p>

        <form action={previewAction} className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="text-[14px] text-muted file:mr-3 file:cursor-pointer file:rounded-[4px] file:border file:border-line file:bg-cream file:px-4 file:py-2 file:text-[14px] file:text-ink"
          />
          <Button type="submit" disabled={previewing}>
            {previewing ? "Reading…" : "Preview import"}
          </Button>
        </form>

        {preview?.error && (
          <p role="alert" className="mt-4 text-[14px] text-[#B4483C]">
            {preview.error}
          </p>
        )}
      </section>

      {preview?.headers && report && (
        <>
          <section>
            <h3 className="mb-2 font-serif text-[22px]">2. Check the columns</h3>
            <p className="mb-5 max-w-[620px] text-[14px] leading-[1.7] text-muted">
              We guessed these from your column names. Correct anything wrong
              and preview again — a wrong guess here is what corrupts a
              catalogue.
            </p>

            <form action={previewAction} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {SERVICE_TARGETS.map((target) => (
                <label key={target.key} className="text-[13px]">
                  <span className="mb-1.5 block tracking-[0.06em] text-sage uppercase">
                    {target.key}
                  </span>
                  <select
                    name={`map.${target.key}`}
                    defaultValue={preview.mapping?.[target.key] ?? ""}
                    className="min-h-[44px] w-full rounded-[4px] border border-line bg-white px-3 py-2 text-[14px]"
                  >
                    <option value="">— not mapped —</option>
                    {preview.headers!.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                </label>
              ))}

              <div className="flex items-end sm:col-span-2 lg:col-span-3">
                <p className="mb-2 text-[13px] text-muted">
                  Re-uploading the file is required when changing a mapping.
                </p>
              </div>
            </form>
          </section>

          <section>
            <h3 className="mb-4 font-serif text-[22px]">3. Review</h3>

            <dl className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Rows read" value={report.totalRows} />
              <Stat label="Will import" value={importable.length} tone="good" />
              <Stat label="Duplicates skipped" value={report.duplicateRows} />
              <Stat
                label="Rows with errors"
                value={report.errorRows}
                tone={report.errorRows > 0 ? "bad" : undefined}
              />
            </dl>

            {report.issues.length > 0 && (
              <details className="mb-6 rounded-[6px] border border-line px-5 py-4">
                <summary className="cursor-pointer text-[14px]">
                  {report.issues.length} note
                  {report.issues.length === 1 ? "" : "s"} on individual rows
                </summary>
                <ul className="mt-4 grid gap-2">
                  {report.issues.slice(0, 100).map((issue, i) => (
                    <li key={i} className="text-[13px] leading-[1.6]">
                      <span
                        className={
                          issue.severity === "error" ? "text-[#B4483C]" : "text-gold"
                        }
                      >
                        Row {issue.row} · {issue.field}
                      </span>{" "}
                      <span className="text-muted">{issue.message}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            {importable.length > 0 && (
              <div className="mb-6 overflow-x-auto rounded-[6px] border border-line">
                <table className="w-full min-w-[560px] text-left text-[14px]">
                  <thead>
                    <tr className="border-b border-line text-[12px] tracking-[0.08em] text-sage uppercase">
                      <th className="px-4 py-3 font-normal">Service</th>
                      <th className="px-4 py-3 font-normal">Category</th>
                      <th className="px-4 py-3 font-normal">Duration</th>
                      <th className="px-4 py-3 font-normal">Price</th>
                      <th className="px-4 py-3 font-normal">Deposit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importable.slice(0, 50).map((row) => (
                      <tr key={row.row} className="border-b border-line last:border-0">
                        <td className="px-4 py-3">{row.name}</td>
                        <td className="px-4 py-3 text-muted">{row.category ?? "—"}</td>
                        <td className="px-4 py-3 text-muted">
                          {formatDurationShort(row.durationMinutes)}
                        </td>
                        <td className="px-4 py-3">{formatPence(row.basePricePence)}</td>
                        <td className="px-4 py-3 text-muted">
                          {formatPence(row.depositPence)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <form action={applyAction}>
              <input type="hidden" name="runId" value={preview.runId ?? ""} />
              <Button type="submit" disabled={applying || importable.length === 0}>
                {applying
                  ? "Importing…"
                  : `Import ${importable.length} service${importable.length === 1 ? "" : "s"}`}
              </Button>
            </form>

            <p className="mt-3 text-[13px] leading-[1.6] text-muted">
              Imported services arrive <strong>inactive</strong>. Check the
              prices in the catalogue, then activate them. The run can be rolled
              back until they are.
            </p>

            {applied?.error && (
              <p role="alert" className="mt-4 text-[14px] text-[#B4483C]">
                {applied.error}
              </p>
            )}
            {applied?.message && (
              <p role="status" className="mt-4 text-[14px] text-moss">
                {applied.message}
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "good" | "bad";
}) {
  return (
    <div className="rounded-[6px] border border-line px-4 py-3">
      <dt className="text-[12px] tracking-[0.08em] text-sage uppercase">{label}</dt>
      <dd
        className={`mt-1 font-serif text-[28px] ${
          tone === "good" ? "text-moss" : tone === "bad" ? "text-[#B4483C]" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
