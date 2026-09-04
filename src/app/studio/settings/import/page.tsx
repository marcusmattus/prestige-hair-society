import type { Metadata } from "next";
import Link from "next/link";
import { ImportWizard } from "@/components/studio/ImportWizard";
import { RollbackButton } from "@/components/studio/RollbackButton";
import { requireManager } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatWhenLong } from "@/lib/time";

export const metadata: Metadata = {
  title: "Import from Slick",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  previewed: "Previewed, not applied",
  applied: "Applied",
  rolled_back: "Rolled back",
  failed: "Failed",
};

export default async function ImportPage() {
  await requireManager("/studio/settings/import");

  const supabase = createAdminClient();
  const { data: runs } = await supabase
    .from("import_runs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div>
      <h2 className="mb-2 font-serif text-[28px] font-light">Import from Slick</h2>
      <p className="mb-10 max-w-[640px] text-[15px] leading-[1.7] text-muted">
        Bring the verified service catalogue across from{" "}
        <span className="whitespace-nowrap">book.getslick.com</span>. Only
        export data you are entitled to: customer records need the salon
        owner&rsquo;s authorisation and a lawful export, and are not covered by
        this tool. See{" "}
        <Link href="/studio/settings" className="text-moss underline">
          settings
        </Link>{" "}
        and <code className="text-[13px]">docs/SLICK_MIGRATION.md</code>.
      </p>

      <ImportWizard />

      <section className="mt-14">
        <h3 className="mb-4 border-b border-line pb-3 text-[13px] tracking-[0.12em] text-sage uppercase">
          Import history
        </h3>

        {!runs || runs.length === 0 ? (
          <p className="text-[15px] text-muted">No imports have been run yet.</p>
        ) : (
          <ul className="grid gap-3">
            {runs.map((run) => (
              <li
                key={run.id}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 rounded-[6px] border border-line px-5 py-4"
              >
                <div>
                  <div className="text-[15px]">
                    {run.source_filename ?? "Untitled"}{" "}
                    <span className="text-[13px] text-muted">({run.kind})</span>
                  </div>
                  <div className="mt-0.5 text-[13px] text-muted">
                    {formatWhenLong(run.created_at)} · {STATUS_LABEL[run.status] ?? run.status}
                    {run.status === "applied" && ` · ${run.imported_rows} imported`}
                    {run.error_rows > 0 && ` · ${run.error_rows} with errors`}
                  </div>
                </div>

                {run.status === "applied" && (
                  <RollbackButton runId={run.id} count={run.imported_rows} />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
