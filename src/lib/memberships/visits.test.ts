import { describe, expect, it } from "vitest";
import { remainingVisits, canBookVisit, isLondonBst, toLondonISO, visitReference } from "./visits";

describe("visit counts", () => {
  it("computes remaining and bookability", () => {
    expect(remainingVisits({ included_visits: 6, completed_visits: 2 })).toBe(4);
    expect(canBookVisit({ included_visits: 6, completed_visits: 2 })).toBe(true);
    expect(canBookVisit({ included_visits: 6, completed_visits: 6 })).toBe(false);
    // Never negative, even if data drifts.
    expect(remainingVisits({ included_visits: 3, completed_visits: 5 })).toBe(0);
  });
});

describe("London time handling", () => {
  it("detects BST in summer and GMT in winter", () => {
    expect(isLondonBst("2026-07-01")).toBe(true);
    expect(isLondonBst("2026-01-15")).toBe(false);
  });

  it("emits the right offset in the ISO timestamp", () => {
    expect(toLondonISO("2026-07-01", "10:00")).toBe("2026-07-01T10:00:00+01:00");
    expect(toLondonISO("2026-01-15", "10:00")).toBe("2026-01-15T10:00:00+00:00");
  });
});

describe("visitReference", () => {
  it("builds an uppercased, prefixed reference", () => {
    expect(visitReference("abcd1234-ef")).toBe("PHS-V-ABCD1234");
  });
});
