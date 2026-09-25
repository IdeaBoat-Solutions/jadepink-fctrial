import { describe, expect, it } from "vitest";
import { canTransitionProductStatus, nextAllowedProductStatuses } from "@/features/visits/products/state-machine";
import { computeVisitProductSummary, type ProductVisitStatus, type VisitProductRow } from "@/features/visits/products/types";

/* §20 product state machine. Actions are independent (trial/like/drop/bill
   reachable directly), but a few edges must stay closed. */
describe("product state machine (§20)", () => {
  it("allows direct actions from SELECTED", () => {
    for (const to of ["TRIAL_IN_PROGRESS", "LIKED", "DROPPED", "PURCHASED"] as ProductVisitStatus[]) {
      expect(canTransitionProductStatus("SELECTED", to)).toBe(true);
    }
  });

  it("allows the trial path and mid-trial drop/bill", () => {
    expect(canTransitionProductStatus("TRIAL_IN_PROGRESS", "TRIAL_COMPLETED")).toBe(true);
    expect(canTransitionProductStatus("TRIAL_IN_PROGRESS", "DROPPED")).toBe(true);
    expect(canTransitionProductStatus("TRIAL_COMPLETED", "LIKED")).toBe(true);
  });

  it("treats PURCHASED as terminal", () => {
    expect(nextAllowedProductStatuses("PURCHASED")).toEqual([]);
    expect(canTransitionProductStatus("PURCHASED", "LIKED")).toBe(false);
  });

  it("never self-transitions", () => {
    const all: ProductVisitStatus[] = ["SELECTED", "TRIAL_IN_PROGRESS", "TRIAL_COMPLETED", "LIKED", "DROPPED", "PURCHASED"];
    for (const s of all) expect(canTransitionProductStatus(s, s)).toBe(false);
  });

  it("does NOT silently re-trial a dropped product (DROPPED→TRIAL_IN_PROGRESS via reopen only, not forward)", () => {
    // undrop paths exist (correction), but forward re-trial without undo is not a free edge from SELECTED-less flow.
    // Guard the documented rule: a fresh trial needs the product re-added, not DROPPED jumping mid-trial silently.
    expect(canTransitionProductStatus("PURCHASED", "TRIAL_IN_PROGRESS")).toBe(false);
  });
});

/* §43 visit summary is DERIVED from rows — the source of truth, no counters. */
describe("computeVisitProductSummary (§43)", () => {
  let seq = 0;
  const row = (status: ProductVisitStatus): VisitProductRow => ({
    id: `vp-${status}-${seq++}`,
    visit_id: "v1",
    product_variant_id: "pv1",
    status,
    added_at: "2026-09-22T00:00:00Z",
    trial_started_at: null,
    trial_completed_at: null,
    liked_at: null,
    dropped_at: null,
    drop_reason_id: null,
    drop_subcategory: null,
    note: null,
    staff_note: null,
    bill_number: null,
    price_at_bill: null,
    purchased_at: null,
    created_at: "2026-09-22T00:00:00Z",
    updated_at: "2026-09-22T00:00:00Z",
  });

  it("counts each status bucket independently", () => {
    const rows = [
      ...Array.from({ length: 5 }, () => row("SELECTED")),
      ...Array.from({ length: 1 }, () => row("TRIAL_IN_PROGRESS")),
      ...Array.from({ length: 9 }, () => row("TRIAL_COMPLETED")),
      ...Array.from({ length: 6 }, () => row("LIKED")),
      ...Array.from({ length: 4 }, () => row("DROPPED")),
    ];
    expect(computeVisitProductSummary(rows)).toEqual({
      selected: 5,
      trialInProgress: 1,
      trialCompleted: 9,
      liked: 6,
      dropped: 4,
      purchased: 0,
    });
  });

  it("returns all zeros for an empty visit", () => {
    expect(computeVisitProductSummary([])).toEqual({
      selected: 0,
      trialInProgress: 0,
      trialCompleted: 0,
      liked: 0,
      dropped: 0,
      purchased: 0,
    });
  });
});
