import { describe, expect, it } from "vitest";
import { canTransition, nextAllowedStatuses, isFullName, normalizeName, type VisitStatus } from "@/lib/domain";

/* §15 Visit state machine: the backend must reject illegal jumps. These lock
   the transition table so a refactor can't silently open a forbidden edge. */
describe("visit state machine (§15)", () => {
  it("allows the happy path ARRIVED→IDENTIFYING→ASSIGNED→ACTIVE", () => {
    expect(canTransition("ARRIVED", "IDENTIFYING")).toBe(true);
    expect(canTransition("IDENTIFYING", "ASSIGNED")).toBe(true);
    expect(canTransition("ASSIGNED", "ACTIVE")).toBe(true);
  });

  it("rejects skipping straight to ACTIVE", () => {
    expect(canTransition("ARRIVED", "ACTIVE")).toBe(false);
    expect(canTransition("ARRIVED", "ASSIGNED")).toBe(false);
  });

  it("treats COMPLETED and ABANDONED as terminal", () => {
    expect(nextAllowedStatuses("COMPLETED")).toEqual([]);
    expect(nextAllowedStatuses("ABANDONED")).toEqual([]);
    expect(canTransition("COMPLETED", "ACTIVE")).toBe(false);
  });

  it("never allows a self-transition", () => {
    const states: VisitStatus[] = ["ARRIVED", "IDENTIFYING", "ASSIGNED", "ACTIVE", "ON_FLOOR", "COMPLETED", "ABANDONED"];
    for (const s of states) expect(canTransition(s, s)).toBe(false);
  });

  it("lets any open state be abandoned", () => {
    expect(canTransition("ARRIVED", "ABANDONED")).toBe(true);
    expect(canTransition("ACTIVE", "ABANDONED")).toBe(true);
  });
});

/* §12/§13: two people share a first name; the surname keeps them apart. */
describe("full-name rule", () => {
  it("requires first + surname", () => {
    expect(isFullName("Priya")).toBe(false);
    expect(isFullName("Priya Shah")).toBe(true);
  });
  it("collapses inner whitespace before judging", () => {
    expect(normalizeName("  Priya   Shah ")).toBe("Priya Shah");
    expect(isFullName("  Priya   Shah ")).toBe(true);
  });
});
