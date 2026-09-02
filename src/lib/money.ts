/**
 * Money helpers.
 *
 * Everything is integer pence. There is no float arithmetic anywhere in this
 * codebase, and no `number` representing pounds is ever persisted.
 */

const GBP = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
});

const GBP_COMPACT = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** 8500 -> "£85.00" */
export function formatPence(pence: number): string {
  return GBP.format(pence / 100);
}

/** 8500 -> "£85"; 8550 -> "£85.50". Used where the design shows round prices. */
export function formatPenceCompact(pence: number): string {
  return pence % 100 === 0 ? GBP_COMPACT.format(pence / 100) : GBP.format(pence / 100);
}

/** "from £150" / "£85", matching how the catalogue displays each pricing mode. */
export function formatPrice(
  pence: number,
  mode: "fixed" | "from" = "fixed",
): string {
  const amount = formatPenceCompact(pence);
  return mode === "from" ? `from ${amount}` : amount;
}

/** What the customer still owes in the salon after the deposit. */
export function balanceDue(
  totalPence: number,
  depositPaidPence: number,
  balancePaidPence = 0,
): number {
  return Math.max(0, totalPence - depositPaidPence - balancePaidPence);
}

/** 8500 -> "85.00", for a pounds input field. Inverse of parsePence. */
export function penceToPoundsInput(pence: number): string {
  return (pence / 100).toFixed(2);
}

/** Parse "85", "£85", "85.50" into pence. Returns null if it is not money. */
export function parsePence(input: string): number | null {
  const cleaned = input.trim().replace(/[£,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [pounds, fraction = ""] = cleaned.split(".");
  return Number(pounds) * 100 + Number(fraction.padEnd(2, "0"));
}
