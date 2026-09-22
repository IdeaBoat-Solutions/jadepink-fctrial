import { describe, expect, it } from "vitest";
import { roundRobinNext, type RosterMember, type AssignedVisit } from "@/lib/round-robin";

const roster: RosterMember[] = [
  { id: "c", name: "Aakash" },
  { id: "a", name: "Mehul" },
  { id: "b", name: "Riya" },
]; // sorted by name → Aakash(c), Mehul(a), Riya(b)

describe("round-robin FC rotation", () => {
  it("returns null for an empty roster", () => {
    expect(roundRobinNext([], [])).toBeNull();
  });

  it("returns the only FC when roster has one", () => {
    expect(roundRobinNext([{ id: "a", name: "Riya" }], [])).toEqual({ id: "a", name: "Riya" });
  });

  it("rotates to the FC after the most recently assigned one", () => {
    const visits: AssignedVisit[] = [
      { assignedSalespersonId: "c", assignedAt: "2026-09-22T10:00:00Z" },
    ];
    // last was Aakash(c) → next in name order is Mehul(a)
    expect(roundRobinNext(roster, visits)?.id).toBe("a");
  });

  it("wraps around the roster", () => {
    const visits: AssignedVisit[] = [
      { assignedSalespersonId: "b", assignedAt: "2026-09-22T10:00:00Z" },
    ];
    // last was Riya(b, last in order) → wraps to Aakash(c)
    expect(roundRobinNext(roster, visits)?.id).toBe("c");
  });

  it("falls back to fewest active load when there is no history", () => {
    // no assigned visits with an FC → fewest-load heuristic, ties break by name → Aakash
    expect(roundRobinNext(roster, [])?.id).toBe("c");
  });

  it("skips inactive roster members", () => {
    const withInactive: RosterMember[] = [...roster, { id: "z", name: "Zara", active: false }];
    const picks = roundRobinNext(withInactive, []);
    expect(picks?.id).not.toBe("z");
  });
});
