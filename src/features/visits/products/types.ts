
/* JadePink F.C. Trial — Stage 3 product & visit-product domain types.
   Complements src/lib/domain.ts (Stage 2 walk-in flow).
   Product interactions belong to a Visit, not directly to a Customer. */

export type ProductVisitStatus =
  | "SELECTED"
  | "TRIAL_IN_PROGRESS"
  | "TRIAL_COMPLETED"
  | "LIKED"
  | "DROPPED"
  | "PURCHASED";

export type ProductEventType =
  | "PRODUCT_ADDED"
  | "PRODUCT_REMOVED"
  | "TRIAL_STARTED"
  | "TRIAL_COMPLETED"
  | "PRODUCT_LIKED"
  | "PRODUCT_DROPPED"
  | "DROP_REASON_CAPTURED"
  | "PRODUCT_PURCHASED";

export interface ProductVariantRow {
  id: string;
  product_id: string;
  sku: string;
  barcode: string | null;
  size: string;
  colour: string;
  price: number;
  image_key: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  /** joined product fields (optional, populated by repository) */
  product_name?: string;
  product_category?: string;
}

export interface DropReasonRow {
  id: string;
  code: string;
  label: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface VisitProductRow {
  id: string;
  visit_id: string;
  product_variant_id: string;
  status: ProductVisitStatus;
  added_at: string;
  trial_started_at: string | null;
  trial_completed_at: string | null;
  liked_at: string | null;
  dropped_at: string | null;
  drop_reason_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  /** joined fields (optional, populated by repository) */
  variant?: ProductVariantRow;
  product?: {
    id: string;
    name: string;
    category: string;
    sku: string;
    size: string;
    colour: string;
    price: number;
    image_key: string | null;
  };
  drop_reason?: DropReasonRow;
}

/* ---------- Stage 3 state machine ----------
   Transitions live in ./state-machine.ts (single source of truth); re-exported
   here so existing imports from "./types" keep working. */
export {
  canTransitionProductStatus,
  nextAllowedProductStatuses,
  findProductTransition,
  productStatusLabel,
} from "./state-machine";

/* ---------- Visit product summary (derived, not stored) ---------- */

export interface VisitProductSummary {
  selected: number;
  trialInProgress: number;
  trialCompleted: number;
  liked: number;
  dropped: number;
  purchased: number;
}

export function computeVisitProductSummary(rows: VisitProductRow[]): VisitProductSummary {
  return rows.reduce(
    (acc, r) => {
      switch (r.status) {
        case "SELECTED":
          acc.selected++;
          break;
        case "TRIAL_IN_PROGRESS":
          acc.trialInProgress++;
          break;
        case "TRIAL_COMPLETED":
          acc.trialCompleted++;
          break;
        case "LIKED":
          acc.liked++;
          break;
        case "DROPPED":
          acc.dropped++;
          break;
        case "PURCHASED":
          acc.purchased++;
          break;
      }
      return acc;
    },
    {
      selected: 0,
      trialInProgress: 0,
      trialCompleted: 0,
      liked: 0,
      dropped: 0,
      purchased: 0,
    },
  );
}

/* ---------- Scan/identify product ---------- */

export interface ResolvedProduct {
  id: string;
  sku: string;
  barcode: string | null;
  product: {
    id: string;
    name: string;
    category: string;
  };
  size: string;
  colour: string;
  price: number;
}

/* ---------- Event metadata shapes ---------- */

export interface ProductAddedMetadata {
  product_variant_id: string;
  sku: string;
  barcode: string | null;
  size: string;
  colour: string;
}

export interface TrialStartedMetadata {
  product_variant_id: string;
  sku: string;
}

export interface TrialCompletedMetadata {
  product_variant_id: string;
  sku: string;
}

export interface ProductLikedMetadata {
  product_variant_id: string;
  sku: string;
}

export interface ProductDroppedMetadata {
  product_variant_id: string;
  sku: string;
}

export interface DropReasonCapturedMetadata {
  product_variant_id: string;
  drop_reason_id: string;
  drop_reason_code: string;
  note: string | null;
}
