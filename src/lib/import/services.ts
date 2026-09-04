import {
  parseDurationToMinutes,
  parseMoneyToPence,
  slugify,
  type CsvTable,
} from "./csv";

/**
 * Validating a Slick service export into rows we can insert.
 *
 * Nothing here writes. It produces a report the operator reads before deciding
 * to apply, because an import that silently drops or mangles rows is worse
 * than one that refuses to run.
 */

export const SERVICE_TARGETS = [
  { key: "name", aliases: ["service", "service name", "title"] },
  { key: "category", aliases: ["category name", "group", "service category"] },
  { key: "description", aliases: ["details", "notes", "about"] },
  { key: "duration", aliases: ["duration minutes", "length", "time", "mins"] },
  { key: "price", aliases: ["cost", "amount", "price from", "rrp"] },
  { key: "deposit", aliases: ["deposit amount", "booking fee"] },
] as const;

export type ServiceRowIssue = {
  row: number;
  field: string;
  message: string;
  severity: "error" | "warning";
};

export type ParsedServiceRow = {
  row: number;
  name: string;
  slug: string;
  category: string | null;
  description: string;
  durationMinutes: number;
  basePricePence: number;
  depositPence: number;
  isDuplicate: boolean;
};

export type ServiceImportReport = {
  totalRows: number;
  validRows: number;
  errorRows: number;
  duplicateRows: number;
  issues: ServiceRowIssue[];
  rows: ParsedServiceRow[];
};

/** Fields we cannot sensibly guess and will not invent. */
const DEFAULT_DURATION = 60;

export function validateServiceImport(
  table: CsvTable,
  mapping: Record<string, string>,
  existingSlugs: Set<string>,
): ServiceImportReport {
  const issues: ServiceRowIssue[] = [];
  const rows: ParsedServiceRow[] = [];
  const seenSlugs = new Set<string>();
  let errorRows = 0;
  let duplicateRows = 0;

  const get = (row: Record<string, string>, key: string) => {
    const column = mapping[key];
    return column ? (row[column] ?? "") : "";
  };

  table.rows.forEach((raw, index) => {
    // +2: one for the header line, one because operators count from 1.
    const rowNumber = index + 2;
    const rowIssues: ServiceRowIssue[] = [];

    const name = get(raw, "name");
    if (!name) {
      rowIssues.push({
        row: rowNumber,
        field: "name",
        message: "No service name — the row cannot be imported.",
        severity: "error",
      });
    }

    const durationRaw = get(raw, "duration");
    let durationMinutes = parseDurationToMinutes(durationRaw);
    if (durationRaw && durationMinutes === null) {
      rowIssues.push({
        row: rowNumber,
        field: "duration",
        message: `Could not read "${durationRaw}" as a duration.`,
        severity: "error",
      });
    } else if (!durationRaw) {
      durationMinutes = DEFAULT_DURATION;
      rowIssues.push({
        row: rowNumber,
        field: "duration",
        message: `No duration given; defaulting to ${DEFAULT_DURATION} minutes. Check before applying.`,
        severity: "warning",
      });
    }

    if (durationMinutes !== null && (durationMinutes < 5 || durationMinutes > 600)) {
      rowIssues.push({
        row: rowNumber,
        field: "duration",
        message: `${durationMinutes} minutes is outside the allowed 5–600 range.`,
        severity: "error",
      });
    }

    const priceRaw = get(raw, "price");
    let basePricePence = parseMoneyToPence(priceRaw);
    if (priceRaw && basePricePence === null) {
      rowIssues.push({
        row: rowNumber,
        field: "price",
        message: `Could not read "${priceRaw}" as a price.`,
        severity: "error",
      });
    } else if (!priceRaw) {
      basePricePence = 0;
      rowIssues.push({
        row: rowNumber,
        field: "price",
        message: "No price given; imported as £0 and flagged for review.",
        severity: "warning",
      });
    }

    const depositRaw = get(raw, "deposit");
    let depositPence = depositRaw ? parseMoneyToPence(depositRaw) : 0;
    if (depositRaw && depositPence === null) {
      rowIssues.push({
        row: rowNumber,
        field: "deposit",
        message: `Could not read "${depositRaw}" as a deposit.`,
        severity: "error",
      });
      depositPence = 0;
    }

    // The database rejects a deposit above the price; catch it here so the
    // operator sees a row number rather than a constraint violation.
    if (
      depositPence !== null &&
      basePricePence !== null &&
      depositPence > basePricePence
    ) {
      rowIssues.push({
        row: rowNumber,
        field: "deposit",
        message: "Deposit is larger than the price. It will be capped at the price.",
        severity: "warning",
      });
      depositPence = basePricePence;
    }

    const slug = slugify(name);
    const isDuplicate = slug !== "" && (existingSlugs.has(slug) || seenSlugs.has(slug));
    if (isDuplicate) {
      duplicateRows += 1;
      rowIssues.push({
        row: rowNumber,
        field: "name",
        message: existingSlugs.has(slug)
          ? `"${name}" already exists in the catalogue and will be skipped.`
          : `"${name}" appears more than once in this file; only the first is imported.`,
        severity: "warning",
      });
    }
    if (slug) seenSlugs.add(slug);

    issues.push(...rowIssues);

    const hasError = rowIssues.some((i) => i.severity === "error");
    if (hasError) {
      errorRows += 1;
      return;
    }

    rows.push({
      row: rowNumber,
      name,
      slug,
      category: get(raw, "category") || null,
      description: get(raw, "description"),
      durationMinutes: durationMinutes ?? DEFAULT_DURATION,
      basePricePence: basePricePence ?? 0,
      depositPence: depositPence ?? 0,
      isDuplicate,
    });
  });

  return {
    totalRows: table.rows.length,
    validRows: rows.filter((r) => !r.isDuplicate).length,
    errorRows,
    duplicateRows,
    issues,
    rows,
  };
}
