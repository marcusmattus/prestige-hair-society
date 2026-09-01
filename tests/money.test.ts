import { describe, expect, it } from "vitest";
import {
  balanceDue,
  formatPence,
  formatPenceCompact,
  formatPrice,
  parsePence,
} from "@/lib/money";

describe("formatPence", () => {
  it("always shows two decimal places", () => {
    expect(formatPence(8500)).toBe("£85.00");
    expect(formatPence(8550)).toBe("£85.50");
    expect(formatPence(5)).toBe("£0.05");
    expect(formatPence(0)).toBe("£0.00");
  });

  it("groups thousands", () => {
    expect(formatPence(123456)).toBe("£1,234.56");
  });
});

describe("formatPenceCompact", () => {
  it("drops the decimals on round amounts, as the design does", () => {
    expect(formatPenceCompact(8500)).toBe("£85");
    expect(formatPenceCompact(15000)).toBe("£150");
  });

  it("keeps them when there are pence to show", () => {
    expect(formatPenceCompact(8550)).toBe("£85.50");
  });
});

describe("formatPrice", () => {
  it("marks a starting price as 'from'", () => {
    expect(formatPrice(15000, "from")).toBe("from £150");
    expect(formatPrice(8500, "fixed")).toBe("£85");
  });

  it("defaults to a fixed price", () => {
    expect(formatPrice(4500)).toBe("£45");
  });
});

describe("balanceDue", () => {
  it("subtracts what has already been paid", () => {
    expect(balanceDue(8500, 3000)).toBe(5500);
    expect(balanceDue(8500, 3000, 2000)).toBe(3500);
  });

  it("never returns a negative balance", () => {
    // An over-payment or a manual adjustment must not read as a credit here.
    expect(balanceDue(8500, 9000)).toBe(0);
  });

  it("returns the full total when nothing is paid", () => {
    expect(balanceDue(8500, 0)).toBe(8500);
  });
});

describe("parsePence", () => {
  it("accepts the shapes staff actually type", () => {
    expect(parsePence("85")).toBe(8500);
    expect(parsePence("£85")).toBe(8500);
    expect(parsePence("85.50")).toBe(8550);
    expect(parsePence("85.5")).toBe(8550);
    expect(parsePence(" £1,234.56 ".replace(/,/g, ""))).toBe(123456);
  });

  it("rejects anything that is not money", () => {
    expect(parsePence("")).toBeNull();
    expect(parsePence("abc")).toBeNull();
    expect(parsePence("85.999")).toBeNull();
    expect(parsePence("-85")).toBeNull();
  });

  it("round-trips through formatPence", () => {
    for (const pence of [0, 5, 4500, 8550, 123456]) {
      expect(parsePence(formatPence(pence).replace(/,/g, ""))).toBe(pence);
    }
  });
});
