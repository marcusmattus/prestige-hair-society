import { describe, expect, it } from "vitest";
import {
  createBookingSchema,
  customerDetailsSchema,
  holdSlotSchema,
  serviceFormSchema,
  signUpSchema,
  waitlistSchema,
} from "@/lib/validation";

const validDetails = {
  firstName: "Ada",
  lastName: "Okafor",
  email: "Ada@Example.com",
  phone: "07700 900123",
  acceptedPolicy: true as const,
};

describe("customer details", () => {
  it("accepts a realistic submission", () => {
    const parsed = customerDetailsSchema.parse(validDetails);
    expect(parsed.firstName).toBe("Ada");
    // Emails are lower-cased so they match the unique index on profiles.
    expect(parsed.email).toBe("ada@example.com");
    expect(parsed.marketingEmail).toBe(false);
  });

  it("requires the cancellation policy to be accepted", () => {
    const result = customerDetailsSchema.safeParse({
      ...validDetails,
      acceptedPolicy: false,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed email", () => {
    expect(
      customerDetailsSchema.safeParse({ ...validDetails, email: "not-an-email" }).success,
    ).toBe(false);
  });

  it("rejects markup in a name", () => {
    expect(
      customerDetailsSchema.safeParse({ ...validDetails, firstName: "<script>" }).success,
    ).toBe(false);
  });

  it("rejects an implausible phone number", () => {
    expect(customerDetailsSchema.safeParse({ ...validDetails, phone: "abc" }).success).toBe(
      false,
    );
    expect(customerDetailsSchema.safeParse({ ...validDetails, phone: "123" }).success).toBe(
      false,
    );
  });
});

describe("booking payloads", () => {
  it("accepts a hold request", () => {
    expect(
      holdSlotSchema.safeParse({
        serviceId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
        staffId: "3f2504e0-4f89-41d3-9a0c-0305e82c3302",
        startsAt: "2026-07-15T09:00:00Z",
      }).success,
    ).toBe(true);
  });

  it("rejects a non-ISO instant", () => {
    expect(
      holdSlotSchema.safeParse({
        serviceId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
        staffId: "3f2504e0-4f89-41d3-9a0c-0305e82c3302",
        startsAt: "next Tuesday",
      }).success,
    ).toBe(false);
  });

  it("silently drops a price the client tries to send", () => {
    // The whole point: pricing is derived server-side from the catalogue.
    const parsed = createBookingSchema.parse({
      holdToken: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      details: validDetails,
      totalPricePence: 1,
      depositPence: 0,
      status: "confirmed",
    } as Record<string, unknown>);

    expect(parsed).not.toHaveProperty("totalPricePence");
    expect(parsed).not.toHaveProperty("depositPence");
    expect(parsed).not.toHaveProperty("status");
  });

  it("caps the number of add-ons", () => {
    const many = Array.from({ length: 11 }, () => "3f2504e0-4f89-41d3-9a0c-0305e82c3301");
    expect(
      holdSlotSchema.safeParse({
        serviceId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
        staffId: "3f2504e0-4f89-41d3-9a0c-0305e82c3302",
        startsAt: "2026-07-15T09:00:00Z",
        addonIds: many,
      }).success,
    ).toBe(false);
  });
});

describe("sign-up", () => {
  it("requires a password with some variety", () => {
    expect(
      signUpSchema.safeParse({
        firstName: "Ada",
        lastName: "Okafor",
        email: "ada@example.com",
        phone: "07700900123",
        password: "short",
      }).success,
    ).toBe(false);

    expect(
      signUpSchema.safeParse({
        firstName: "Ada",
        lastName: "Okafor",
        email: "ada@example.com",
        phone: "07700900123",
        password: "alllowercase123",
      }).success,
    ).toBe(false);

    expect(
      signUpSchema.safeParse({
        firstName: "Ada",
        lastName: "Okafor",
        email: "ada@example.com",
        phone: "07700900123",
        password: "GoodPassword1",
      }).success,
    ).toBe(true);
  });
});

describe("service form", () => {
  const base = {
    name: "Silk Press",
    slug: "silk-press",
    durationMinutes: 90,
    bufferMinutes: 15,
    basePricePence: 8500,
    pricingMode: "fixed" as const,
    depositPence: 3000,
  };

  it("accepts a well-formed service", () => {
    expect(serviceFormSchema.safeParse(base).success).toBe(true);
  });

  it("refuses a deposit larger than the price", () => {
    // The database has the same check; catching it here gives a better message.
    const result = serviceFormSchema.safeParse({ ...base, depositPence: 9000 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(["depositPence"]);
    }
  });

  it("refuses a slug that would break the URL", () => {
    expect(serviceFormSchema.safeParse({ ...base, slug: "Silk Press!" }).success).toBe(false);
  });
});

describe("waiting list", () => {
  const base = {
    serviceId: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    earliestDate: "2026-07-15",
    latestDate: "2026-07-30",
    timesOfDay: ["morning" as const],
    details: {
      firstName: "Ada",
      lastName: "Okafor",
      email: "ada@example.com",
      phone: "07700900123",
    },
  };

  it("accepts a sensible range", () => {
    expect(waitlistSchema.safeParse(base).success).toBe(true);
  });

  it("refuses a range that ends before it starts", () => {
    const result = waitlistSchema.safeParse({
      ...base,
      earliestDate: "2026-07-30",
      latestDate: "2026-07-15",
    });
    expect(result.success).toBe(false);
  });

  it("requires at least one time of day", () => {
    expect(waitlistSchema.safeParse({ ...base, timesOfDay: [] }).success).toBe(false);
  });
});
