import { describe, expect, it } from "vitest";
import {
  focalPosition,
  gallerySlot,
  isSafeImageUrl,
  stylistSlot,
} from "@/lib/images";

describe("isSafeImageUrl", () => {
  it("accepts a path to a file in public/", () => {
    expect(isSafeImageUrl("/photos/hero.jpg")).toBe(true);
    expect(isSafeImageUrl("/logo.jpg")).toBe(true);
  });

  it("accepts https", () => {
    expect(isSafeImageUrl("https://project.supabase.co/storage/v1/x.jpg")).toBe(true);
    expect(isSafeImageUrl("https://images.example.com/a.webp")).toBe(true);
  });

  it("refuses javascript: and data: URLs", () => {
    // The value goes straight into an img src, so this is the check that
    // matters even though only a manager can set it.
    expect(isSafeImageUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeImageUrl("data:image/svg+xml,<svg onload=alert(1)>")).toBe(false);
    expect(isSafeImageUrl("JAVASCRIPT:alert(1)")).toBe(false);
  });

  it("refuses plain http", () => {
    // Mixed content is blocked by the browser anyway; failing here is clearer.
    expect(isSafeImageUrl("http://example.com/a.jpg")).toBe(false);
  });

  it("refuses a protocol-relative URL", () => {
    // //evil.example inherits the page's scheme and reads as a path at a glance.
    expect(isSafeImageUrl("//evil.example/a.jpg")).toBe(false);
  });

  it("refuses nonsense", () => {
    expect(isSafeImageUrl("")).toBe(false);
    expect(isSafeImageUrl("not a url")).toBe(false);
    expect(isSafeImageUrl("   ")).toBe(false);
  });

  it("ignores surrounding whitespace", () => {
    expect(isSafeImageUrl("  /photos/hero.jpg  ")).toBe(true);
    expect(isSafeImageUrl("  javascript:alert(1)  ")).toBe(false);
  });
});

describe("focalPosition", () => {
  it("renders a CSS object-position", () => {
    expect(focalPosition({ focalX: 50, focalY: 50 })).toBe("50% 50%");
    expect(focalPosition({ focalX: 30, focalY: 20 })).toBe("30% 20%");
  });
});

describe("slot keys", () => {
  it("namespaces stylists and gallery images", () => {
    expect(stylistSlot("nekeia-griffith")).toBe("stylist:nekeia-griffith");
    expect(gallerySlot(3)).toBe("gallery:3");
  });

  it("keeps a stylist slot distinct from a gallery slot", () => {
    expect(stylistSlot("1")).not.toBe(gallerySlot(1));
  });
});
