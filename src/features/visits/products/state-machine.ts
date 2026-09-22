/* Product state machine for the floor trial.
   The canonical, code-owned transition table. Services call
   `canTransitionProductStatus(from, to)` instead of scattering `if` checks.

   Actions are independent: from SELECTED the FC can trial, like, drop or
   bill directly - no forced march through every step. Mid-trial the FC can
   drop or bill without completing first.

        SELECTED -+- trial --> TRIAL_IN_PROGRESS -+- complete --> TRIAL_COMPLETED -+- like --> LIKED --> PURCHASED
                   +- like --> LIKED             +- drop --> DROPPED (reason)      +- drop --> DROPPED (reason)
                   +- drop --> DROPPED (reason)  +- bill --> PURCHASED            +- bill --> PURCHASED
                   +- bill --> PURCHASED (buy w/o trial)

    Liked-but-not-billed needs a reason if later dropped (vendor reports).
    DROPPED -> TRIAL_IN_PROGRESS is intentionally NOT allowed: a dropped
    product is not silently re-trialled; add it again as a fresh interaction
    instead. */

import type { ProductVisitStatus } from "./types";

const TRANSITIONS: Record<ProductVisitStatus, ProductVisitStatus[]> = {
  SELECTED: ["TRIAL_IN_PROGRESS", "LIKED", "DROPPED", "PURCHASED"],
  TRIAL_IN_PROGRESS: ["TRIAL_COMPLETED", "SELECTED", "DROPPED", "PURCHASED"],
  TRIAL_COMPLETED: ["LIKED", "TRIAL_IN_PROGRESS", "DROPPED", "PURCHASED"],
  LIKED: ["PURCHASED", "DROPPED", "TRIAL_COMPLETED", "SELECTED"],
  DROPPED: ["PURCHASED", "LIKED", "TRIAL_COMPLETED", "TRIAL_IN_PROGRESS", "SELECTED"],
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
    case "TRIAL_COMPLETED":
      // One merged display label for both trial states.
      return "Trial";
    case "LIKED":
      return "Liked";
    case "DROPPED":
      return "Dropped";
    case "PURCHASED":
      return "Purchased";
  }
}
