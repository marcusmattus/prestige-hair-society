import { describe, expect, it } from "vitest";
import { placeholdersUsed, render } from "@/lib/comms/render";
import { toE164 } from "@/lib/comms/send";

describe("template rendering", () => {
  const context = {
    customer: { firstName: "Ada" },
    booking: { reference: "PHS-1042", serviceName: "Silk Press" },
  };

  it("substitutes dotted paths", () => {
    expect(render("Hello {{customer.firstName}},", context)).toBe("Hello Ada,");
    expect(render("Ref {{booking.reference}}", context)).toBe("Ref PHS-1042");
  });

  it("tolerates whitespace inside the braces", () => {
    expect(render("{{ customer.firstName }}", context)).toBe("Ada");
  });

  it("renders an unknown placeholder as empty rather than leaving braces", () => {
    // A customer must never receive an email containing "{{booking.nope}}".
    expect(render("[{{booking.nope}}]", context)).toBe("[]");
    expect(render("[{{nothing.at.all}}]", context)).toBe("[]");
  });

  it("does not evaluate anything", () => {
    // Templates are edited by salon staff. They are data, not code.
    const hostile = "{{constructor}}{{__proto__}}{{customer.constructor}}";
    expect(render(hostile, context)).toBe("");
  });

  it("leaves non-placeholder braces alone", () => {
    expect(render("A { b } c", context)).toBe("A { b } c");
  });

  it("lists the placeholders a template uses", () => {
    expect(placeholdersUsed("{{a.b}} and {{c}} and {{a.b}}")).toEqual(["a.b", "c"]);
  });
});

describe("toE164", () => {
  it("normalises the shapes UK customers type", () => {
    expect(toE164("07700 900123")).toBe("+447700900123");
    expect(toE164("07700900123")).toBe("+447700900123");
    expect(toE164("(07700) 900123")).toBe("+447700900123");
    expect(toE164("+44 7700 900123")).toBe("+447700900123");
    expect(toE164("447700900123")).toBe("+447700900123");
    expect(toE164("7700900123")).toBe("+447700900123");
  });

  it("passes through other international numbers", () => {
    expect(toE164("+1 415 555 0123")).toBe("+14155550123");
  });

  it("rejects what cannot be dialled", () => {
    expect(toE164("")).toBeNull();
    expect(toE164("abc")).toBeNull();
    expect(toE164("12345")).toBeNull();
    expect(toE164("+1")).toBeNull();
  });
});
