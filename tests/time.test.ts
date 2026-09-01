import { describe, expect, it } from "vitest";
import {
  formatDateShort,
  formatDuration,
  formatTime,
  formatWhenShort,
  hoursUntil,
  isWithinPolicyWindow,
  timeOfDay,
  toSalonDate,
} from "@/lib/time";

/**
 * The cases that matter are the ones where the server's zone and the salon's
 * zone disagree. British Summer Time is UTC+1 from late March to late October,
 * so a 10:00 London appointment is 09:00Z in summer and 10:00Z in winter.
 */
describe("timezone handling", () => {
  it("renders a summer instant in London time, not UTC", () => {
    // 2026-07-15T09:00:00Z is 10:00 in London (BST).
    expect(formatTime("2026-07-15T09:00:00Z")).toBe("10:00");
  });

  it("renders a winter instant in London time", () => {
    // 2026-01-15T10:00:00Z is 10:00 in London (GMT).
    expect(formatTime("2026-01-15T10:00:00Z")).toBe("10:00");
  });

  it("keeps the salon-local date across the UTC day boundary", () => {
    // 23:30 London on 15 July is 22:30Z the same day...
    expect(toSalonDate("2026-07-15T22:30:00Z")).toBe("2026-07-15");
    // ...but 00:30 London on 16 July is 23:30Z on the 15th.
    expect(toSalonDate("2026-07-15T23:30:00Z")).toBe("2026-07-16");
  });

  it("formats dates in the salon's zone", () => {
    expect(formatDateShort("2026-07-15T09:00:00Z")).toBe("Wed, 15 Jul");
  });

  it("combines date and time the way the summary shows them", () => {
    expect(formatWhenShort("2026-07-15T09:00:00Z")).toBe("Wed, 15 Jul at 10:00");
  });
});

describe("timeOfDay", () => {
  it("buckets by salon-local hour, not UTC hour", () => {
    // 11:30Z in July is 12:30 in London -- afternoon, not morning.
    expect(timeOfDay("2026-07-15T11:30:00Z")).toBe("afternoon");
    expect(timeOfDay("2026-07-15T08:00:00Z")).toBe("morning");
    expect(timeOfDay("2026-07-15T17:00:00Z")).toBe("evening");
  });

  it("puts the boundaries where the filter labels imply", () => {
    // 10:59 London
    expect(timeOfDay("2026-01-15T11:59:00Z")).toBe("morning");
    // 12:00 London
    expect(timeOfDay("2026-01-15T12:00:00Z")).toBe("afternoon");
    // 17:00 London
    expect(timeOfDay("2026-01-15T17:00:00Z")).toBe("evening");
  });
});

describe("formatDuration", () => {
  it("reads naturally", () => {
    expect(formatDuration(30)).toBe("30 minutes");
    expect(formatDuration(60)).toBe("1 hour");
    expect(formatDuration(90)).toBe("1 hour 30 minutes");
    expect(formatDuration(120)).toBe("2 hours");
    expect(formatDuration(185)).toBe("3 hours 5 minutes");
  });

  it("handles the degenerate case", () => {
    expect(formatDuration(0)).toBe("0 minutes");
  });
});

describe("cancellation policy window", () => {
  it("allows a change outside the window", () => {
    const in48h = new Date(Date.now() + 48 * 3_600_000).toISOString();
    expect(isWithinPolicyWindow(in48h, 24)).toBe(true);
  });

  it("refuses inside the window", () => {
    const in6h = new Date(Date.now() + 6 * 3_600_000).toISOString();
    expect(isWithinPolicyWindow(in6h, 24)).toBe(false);
  });

  it("refuses for an appointment already in the past", () => {
    const yesterday = new Date(Date.now() - 24 * 3_600_000).toISOString();
    expect(isWithinPolicyWindow(yesterday, 24)).toBe(false);
    expect(hoursUntil(yesterday)).toBeLessThan(0);
  });
});
