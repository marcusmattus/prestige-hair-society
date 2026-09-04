/**
 * A small, dependency-free CSV reader.
 *
 * Slick exports are ordinary RFC 4180 CSV, and the alternative -- pulling in a
 * parser -- buys little for one upload form. This handles quoted fields,
 * embedded commas, escaped quotes and both line-ending conventions, which is
 * the whole of what those exports contain.
 */

export type CsvTable = {
  headers: string[];
  rows: Record<string, string>[];
};

export function parseCsv(input: string): CsvTable {
  const text = input.replace(/^﻿/, ""); // strip a BOM if Excel added one
  const records: string[][] = [];

  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'; // an escaped quote
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      record.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      // Swallow the \n of a \r\n pair.
      if (char === "\r" && text[i + 1] === "\n") i++;
      record.push(field);
      field = "";
      // Skip blank lines rather than emitting an empty record.
      if (record.length > 1 || record[0] !== "") records.push(record);
      record = [];
    } else {
      field += char;
    }
  }

  // Whatever is left when the input ends without a trailing newline.
  if (field !== "" || record.length > 0) {
    record.push(field);
    if (record.length > 1 || record[0] !== "") records.push(record);
  }

  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0].map((h) => h.trim());
  const rows = records.slice(1).map((values) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (values[index] ?? "").trim();
    });
    return row;
  });

  return { headers, rows };
}

/**
 * Guess which CSV column feeds which of our fields.
 *
 * Slick's column names vary between export versions, so this scores candidates
 * by normalised name and returns a mapping the operator can correct before
 * anything is written. A wrong guess costs a click; a silent wrong guess costs
 * a corrupted catalogue, which is why the preview step is not optional.
 */
export function suggestMapping(
  headers: string[],
  targets: { key: string; aliases: string[] }[],
): Record<string, string> {
  const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const normalised = headers.map((h) => ({ header: h, key: normalise(h) }));
  const mapping: Record<string, string> = {};
  const taken = new Set<string>();

  for (const target of targets) {
    const wanted = [target.key, ...target.aliases].map(normalise);

    const exact = normalised.find(
      (h) => !taken.has(h.header) && wanted.includes(h.key),
    );
    const partial =
      exact ??
      normalised.find(
        (h) =>
          !taken.has(h.header) &&
          wanted.some((w) => h.key.includes(w) || w.includes(h.key)),
      );

    if (partial) {
      mapping[target.key] = partial.header;
      taken.add(partial.header);
    }
  }

  return mapping;
}

/** Money in an export may be "85", "£85.00", "85.00 GBP" or "1,085.50". */
export function parseMoneyToPence(input: string): number | null {
  const cleaned = input.trim().replace(/[£$€,\s]/g, "").replace(/gbp/i, "");
  if (cleaned === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [pounds, fraction = ""] = cleaned.split(".");
  return Number(pounds) * 100 + Number(fraction.padEnd(2, "0"));
}

/** Durations appear as "90", "90 min", "1h 30m" or "01:30". */
export function parseDurationToMinutes(input: string): number | null {
  const value = input.trim().toLowerCase();
  if (value === "") return null;

  const clock = value.match(/^(\d{1,2}):(\d{2})$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

  const composite = value.match(/^(?:(\d+)\s*h(?:ours?|rs?)?)?\s*(?:(\d+)\s*m(?:ins?|inutes?)?)?$/);
  if (composite && (composite[1] || composite[2])) {
    return Number(composite[1] ?? 0) * 60 + Number(composite[2] ?? 0);
  }

  const plain = value.match(/^(\d+)(?:\s*(?:min|mins|minutes))?$/);
  if (plain) return Number(plain[1]);

  return null;
}

/** Slug from a name, matching the database's slugify(). */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
