/* JadePink F.C. Trial — Stage 3 product state machine.
   The canonical, code-owned transition table. Services call
   `assertProductTransition(from, to)` instead of scattering `if` checks (§35).

       SELECTED
          │ startTrial
          ▼
       TRIAL_IN_PROGRESS
          │ completeTrial
          ▼
       TRIAL_COMPLETED
          ├─ like ─▶ LIKED ─▶ PURCHASED (Stage 4 / billing)
          └─ drop ─▶ DROPPED ─▶ PURCHASED (rare: bought despite dropping)

   DROPPED → TRIAL_IN_PROGRESS is intentionally NOT allowed: a dropped product
   is not silently re-trialled; add it again as a fresh interaction instead. */

import type { ProductVisitStatus } from "./types";

const TRANSITIONS: Record<ProductVisitStatus, ProductVisitStatus[]> = {
  SELECTED: ["TRIAL_IN_PROGRESS"],
  TRIAL_IN_PROGRESS: ["TRIAL_COMPLETED"],
  TRIAL_COMPLETED: ["LIKED", "DROPPED"],
  LIKED: ["PURCHASED"],
  DROPPED: ["PURCHASED"],
  PURCHASED: [],
};

export function canTransitionProductStatus(
  from: ProductVisitStatus,
  to: ProductVisitStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function nextAllowedProductStatuses(s: ProductVisitStatus): ProductVisitStatus[] {
  return TRANSITIONS[s] ?? [];
}

/** Returns the legal transition path from → to, or null when illegal. */
export function findProductTransition(
  from: ProductVisitStatus,
  to: ProductVisitStatus,
): [ProductVisitStatus, ProductVisitStatus] | null {
  return canTransitionProductStatus(from, to) ? [from, to] : null;
}

export function productStatusLabel(s: ProductVisitStatus): string {
  switch (s) {
    case "SELECTED":
      return "Selected";
    case "TRIAL_IN_PROGRESS":
      return "Trial in progress";
    case "TRIAL_COMPLETED":
      return "Trial completed";
    case "LIKED":
      return "Liked";
    case "DROPPED":
      return "Dropped";
    case "PURCHASED":
      return "Purchased";
  }
}
