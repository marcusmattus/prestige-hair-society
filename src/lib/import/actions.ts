"use server";

import { revalidatePath } from "next/cache";
import { audit } from "@/lib/audit";
import { requireManager } from "@/lib/auth/roles";
import { parseCsv, slugify, suggestMapping } from "@/lib/import/csv";
import {
  SERVICE_TARGETS,
  validateServiceImport,
  type ServiceImportReport,
} from "@/lib/import/services";
import { createAdminClient } from "@/lib/supabase/admin";

export type PreviewState = {
  error?: string;
  runId?: string;
  filename?: string;
  headers?: string[];
  mapping?: Record<string, string>;
  report?: ServiceImportReport;
};

const MAX_BYTES = 2 * 1024 * 1024; // a service catalogue is kilobytes, not megabytes

/**
 * Step 1 — preview.
 *
 * Parses the upload, guesses the column mapping, validates every row and
 * stores the outcome as a draft import_run. Nothing is written to the
 * catalogue; the operator gets a report and decides.
 */
export async function previewServiceImportAction(
  _prev: PreviewState | null,
  formData: FormData,
): Promise<PreviewState> {
  const user = await requireManager("/studio/settings/import");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a CSV file to upload." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "That file is larger than 2 MB. Export services only, not history." };
  }

  const table = parseCsv(await file.text());
  if (table.headers.length === 0) {
    return { error: "That file has no header row." };
  }
  if (table.rows.length === 0) {
    return { error: "That file has headers but no rows." };
  }

  const supabase = createAdminClient();

  const { data: salon } = await supabase
    .from("salons")
    .select("id")
    .eq("is_active", true)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (!salon) return { error: "No active salon is configured." };

  const { data: existing } = await supabase
    .from("services")
    .select("slug")
    .eq("salon_id", salon.id);

  const existingSlugs = new Set((existing ?? []).map((s) => s.slug));

  // An explicit mapping from the correction form wins over the guess.
  const submitted: Record<string, string> = {};
  for (const target of SERVICE_TARGETS) {
    const value = formData.get(`map.${target.key}`);
    if (typeof value === "string" && value) submitted[target.key] = value;
  }
  const mapping =
    Object.keys(submitted).length > 0
      ? submitted
      : suggestMapping(table.headers, SERVICE_TARGETS.map((t) => ({ key: t.key, aliases: [...t.aliases] })));

  const report = validateServiceImport(table, mapping, existingSlugs);

  const { data: run, error } = await supabase
    .from("import_runs")
    .insert({
      salon_id: salon.id,
      kind: "services",
      status: "previewed",
      source_filename: file.name,
      field_mapping: mapping,
      report: {
        issues: report.issues,
        rows: report.rows,
      },
      total_rows: report.totalRows,
      valid_rows: report.validRows,
      duplicate_rows: report.duplicateRows,
      error_rows: report.errorRows,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[import] preview failed", error.message);
    return { error: "We could not prepare that import." };
  }

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "import.previewed",
    entityType: "import_run",
    entityId: run.id,
    metadata: { kind: "services", filename: file.name, rows: report.totalRows },
  });

  return {
    runId: run.id,
    filename: file.name,
    headers: table.headers,
    mapping,
    report,
  };
}

export type ApplyState = { error?: string; message?: string };

/**
 * Step 2 — apply.
 *
 * Inserts the rows the preview marked importable, recording every created id
 * so the run can be rolled back. Duplicates and error rows are skipped, not
 * merged: overwriting a live price from a spreadsheet is not something an
 * import should do on its own.
 */
export async function applyServiceImportAction(
  _prev: ApplyState | null,
  formData: FormData,
): Promise<ApplyState> {
  const user = await requireManager("/studio/settings/import");

  const runId = formData.get("runId");
  if (typeof runId !== "string" || !runId) return { error: "Missing import run." };

  const supabase = createAdminClient();

  const { data: run } = await supabase
    .from("import_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();

  if (!run) return { error: "That import run no longer exists." };
  if (run.status === "applied") return { error: "That import has already been applied." };

  const report = run.report as unknown as { rows?: ServiceImportReport["rows"] };
  const rows = (report.rows ?? []).filter((r) => !r.isDuplicate);

  if (rows.length === 0) {
    return { error: "There is nothing importable in that run." };
  }

  // Resolve category names to ids, creating any that are missing.
  const { data: categories } = await supabase
    .from("service_categories")
    .select("id, slug")
    .eq("salon_id", run.salon_id);

  const categoryBySlug = new Map((categories ?? []).map((c) => [c.slug, c.id]));
  const createdCategoryIds: string[] = [];

  for (const row of rows) {
    if (!row.category) continue;
    const slug = slugify(row.category);
    if (categoryBySlug.has(slug)) continue;

    const { data: created } = await supabase
      .from("service_categories")
      .insert({ salon_id: run.salon_id, name: row.category, slug, is_active: true })
      .select("id")
      .single();

    if (created) {
      categoryBySlug.set(slug, created.id);
      createdCategoryIds.push(created.id);
    }
  }

  const { data: inserted, error } = await supabase
    .from("services")
    .insert(
      rows.map((row, index) => ({
        salon_id: run.salon_id,
        category_id: row.category ? (categoryBySlug.get(slugify(row.category)) ?? null) : null,
        name: row.name,
        slug: row.slug,
        description: row.description,
        duration_minutes: row.durationMinutes,
        base_price_pence: row.basePricePence,
        deposit_pence: row.depositPence,
        display_order: index + 1,
        // Imported services start inactive: an unverified price should not go
        // live on the public catalogue without somebody looking at it first.
        is_active: false,
      })),
    )
    .select("id");

  if (error) {
    console.error("[import] apply failed", error.message);
    return { error: `The import failed and nothing was changed: ${error.message}` };
  }

  const createdIds = [...(inserted ?? []).map((r) => r.id), ...createdCategoryIds];

  await supabase
    .from("import_runs")
    .update({
      status: "applied",
      imported_rows: inserted?.length ?? 0,
      created_record_ids: createdIds,
      applied_at: new Date().toISOString(),
    })
    .eq("id", runId);

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "import.applied",
    entityType: "import_run",
    entityId: runId,
    metadata: { imported: inserted?.length ?? 0, categoriesCreated: createdCategoryIds.length },
  });

  revalidatePath("/studio/services");
  revalidatePath("/studio/settings/import");

  return {
    message: `Imported ${inserted?.length ?? 0} services as inactive. Review the prices in the catalogue, then activate them.`,
  };
}

/**
 * Step 3 — rollback.
 *
 * Deletes exactly the rows this run created. Safe because imported services
 * start inactive and therefore cannot have been booked; if one has since been
 * activated and booked, the foreign key from bookings refuses the delete and
 * the operator is told which.
 */
export async function rollbackImportAction(
  _prev: ApplyState | null,
  formData: FormData,
): Promise<ApplyState> {
  const user = await requireManager("/studio/settings/import");

  const runId = formData.get("runId");
  if (typeof runId !== "string" || !runId) return { error: "Missing import run." };

  const supabase = createAdminClient();

  const { data: run } = await supabase
    .from("import_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle();

  if (!run) return { error: "That import run no longer exists." };
  if (run.status !== "applied") return { error: "Only an applied import can be rolled back." };

  const ids = run.created_record_ids ?? [];
  if (ids.length === 0) return { error: "That run created nothing to roll back." };

  const { error: serviceError } = await supabase.from("services").delete().in("id", ids);

  if (serviceError) {
    return {
      error:
        "Some imported services are now referenced by bookings and cannot be removed. " +
        "Deactivate them in the catalogue instead.",
    };
  }

  // Categories the run created, now that nothing points at them.
  await supabase.from("service_categories").delete().in("id", ids);

  await supabase
    .from("import_runs")
    .update({ status: "rolled_back", rolled_back_at: new Date().toISOString() })
    .eq("id", runId);

  await audit({
    actorId: user.id,
    actorEmail: user.email,
    action: "import.rolled_back",
    entityType: "import_run",
    entityId: runId,
    metadata: { removed: ids.length },
  });

  revalidatePath("/studio/services");
  revalidatePath("/studio/settings/import");

  return { message: "The import has been rolled back." };
}
