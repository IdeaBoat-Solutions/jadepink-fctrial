import { describe, expect, it } from "vitest";
import { normalizePhone, formatPhoneIN, isValidPhoneIN } from "@/lib/phone";
import { normalizeMobile, formatMobileIN, isValidMobileIN } from "@/lib/domain";

/* §13 Customer identity: every formatting of one number must resolve to the
   same canonical 10-digit key, so a customer is never duplicated by format. */
describe("phone normalization (backend + UI must agree)", () => {
  const canonical = "9876543210";
  const variants = [
    "+91 98765 43210",
    "+919876543210",
    "9876543210",
    "098765 43210",
    "91-98765-43210",
    "  9876543210  ",
  ];

  it("collapses every IN format to the same 10-digit key", () => {
    for (const v of variants) {
      expect(normalizePhone(v)).toBe(canonical);
      expect(normalizeMobile(v)).toBe(canonical);
    }
  });

  it("backend normalizePhone and UI normalizeMobile stay in sync", () => {
    for (const v of variants) {
      expect(normalizePhone(v)).toBe(normalizeMobile(v));
    }
  });

  it("keeps digits when nothing to strip", () => {
    expect(normalizePhone("")).toBe("");
    expect(normalizePhone("abc")).toBe("");
  });

  it("validates only real IN mobile numbers (first digit 6-9, 10 long)", () => {
    expect(isValidPhoneIN("+91 98765 43210")).toBe(true);
    expect(isValidMobileIN("98765 43210")).toBe(true);
    expect(isValidPhoneIN("12345 43210")).toBe(false); // starts with 1
    expect(isValidPhoneIN("98765 4321")).toBe(false); // 9 digits
  });

  it("formats canonical back to display form", () => {
    expect(formatPhoneIN(canonical)).toBe("+91 98765 43210");
    expect(formatMobileIN(canonical)).toBe("+91 98765 43210");
    expect(formatPhoneIN("")).toBe("");
  });
});
