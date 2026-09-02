import { describe, expect, it } from "vitest";
import { penceToPoundsInput, parsePence } from "@/lib/money";
import {
  BOOKING_STATUSES,
  DELIVERY_STATUSES,
  MESSAGE_CHANNELS,
  asEnum,
} from "@/lib/studio/filters";

describe("asEnum", () => {
  it("passes through a value in the set", () => {
    expect(asEnum("confirmed", BOOKING_STATUSES)).toBe("confirmed");
    expect(asEnum("sms", MESSAGE_CHANNELS)).toBe("sms");
  });

  it("drops anything else", () => {
    // A hand-edited URL must not reach PostgREST as an invalid enum
    // comparison, which would error the whole page rather than ignore one
    // filter.
    expect(asEnum("nonsense", BOOKING_STATUSES)).toBeUndefined();
    expect(asEnum("", BOOKING_STATUSES)).toBeUndefined();
    expect(asEnum(undefined, BOOKING_STATUSES)).toBeUndefined();
  });

  it("is not fooled by a near miss", () => {
    expect(asEnum("Confirmed", BOOKING_STATUSES)).toBeUndefined();
    expect(asEnum("confirmed ", BOOKING_STATUSES)).toBeUndefined();
    expect(asEnum("delivered", MESSAGE_CHANNELS)).toBeUndefined();
  });

  it("covers every status the log filters on", () => {
    for (const status of DELIVERY_STATUSES) {
      expect(asEnum(status, DELIVERY_STATUSES)).toBe(status);
    }
  });
});

describe("pounds input round trip", () => {
  it("survives editing a price in the studio", () => {
    // The service editor shows pounds, stores pence. A price that changed
    // by a factor of 100 on save would be the worst kind of quiet bug.
    for (const pence of [0, 500, 4500, 8500, 8550, 15000, 22000]) {
      expect(parsePence(penceToPoundsInput(pence))).toBe(pence);
    }
  });

  it("accepts what staff actually type", () => {
    expect(parsePence("85")).toBe(8500);
    expect(parsePence("£85")).toBe(8500);
    expect(parsePence(" 85.5 ")).toBe(8550);
  });

  it("refuses a price it cannot represent exactly", () => {
    expect(parsePence("85.999")).toBeNull();
    expect(parsePence("eighty five")).toBeNull();
  });
});
