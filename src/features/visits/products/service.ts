/* JadePink F.C. Trial — Stage 3 service layer.
   Business operations only; never exposed as raw status writes (§11).
   Every operation: load → authorize → validate state → mutate → record event.

   NOTE on atomicity: Supabase JS cannot wrap multiple statements in one
   transaction. To stay provably safe without a second source of truth we use
   (a) the DB unique(visit_id, product_variant_id) for idempotent adds (§38),
   (b) conditional updates `.eq("status", expected)` for optimistic concurrency
   (§37), and (c) events written only AFTER the state change succeeds, so we can
   never record an event for a mutation that did not happen. The inverse
   (state changed, event insert failed) is non-authoritative audit and can be
   retried by the caller. */

import { Stage2Error, STAGE2_ERRORS } from "@/lib/errors";
import { assertStoreAccess, type AuthContext } from "@/lib/authz";
import { getVisitRow, type VisitRow } from "../repository";
import {
  deleteVisitProduct,
  getCustomerBrief,
  getDropReasonById,
  getVariantById,
  getVisitProductById,
  insertVisitEvent,
  insertVisitProduct,
  listDropReasons,
  listVisitProducts,
  patchVisitProduct,
  resolveVariantByIdentifier,
  transitionVisitProduct,
} from "./repository";
import { canTransitionProductStatus } from "./state-machine";
import {
  computeVisitProductSummary,
  type ProductVisitStatus,
  type ResolvedProduct,
  type VisitProductRow,
} from "./types";
import type { ProductCardDTO, VisitWithProductsDTO } from "./dto";

/* ---------- helpers ---------- */

const nowIso = (): string => new Date().toISOString();

async function loadVisit(visitId: string): Promise<VisitRow> {
  const visit = await getVisitRow(visitId);
  if (!visit) throw new Stage2Error(STAGE2_ERRORS.VISIT_NOT_FOUND, "Visit not found", 404);
  return visit;
}

function assertVisitActive(visit: VisitRow): void {
  if (visit.status === "COMPLETED" || visit.status === "CANCELLED") {
    throw new Stage2Error(STAGE2_ERRORS.VISIT_ALREADY_COMPLETED, "Visit is closed", 422);
  }
  if (visit.status !== "ACTIVE") {
    throw new Stage2Error(STAGE2_ERRORS.VISIT_NOT_ACTIVE, "Start the visit before adding products", 422);
  }
}

/** Load a visit_product and confirm the caller may touch its parent visit. */
async function loadVisitProduct(
  auth: AuthContext,
  visitProductId: string,
): Promise<{ vp: VisitProductRow; visit: VisitRow }> {
  const vp = await getVisitProductById(visitProductId);
  if (!vp) throw new Stage2Error(STAGE2_ERRORS.VISIT_PRODUCT_NOT_FOUND, "Product is not in this visit", 404);
  const visit = await loadVisit(vp.visit_id);
  assertStoreAccess(auth, visit.store_id);
  return { vp, visit };
}

function toResolvedProduct(v: {
  id: string;
  sku: string;
  barcode: string | null;
  product_id: string;
  product_name?: string;
  product_category?: string;
  size: string;
  colour: string;
  price: number;
}): ResolvedProduct {
  return {
    id: v.id,
    sku: v.sku,
    barcode: v.barcode,
    product: { id: v.product_id, name: v.product_name ?? "", category: v.product_category ?? "" },
    size: v.size,
    colour: v.colour,
    price: v.price,
  };
}

export function toProductCard(vp: VisitProductRow): ProductCardDTO {
  return {
    id: vp.id,
    status: vp.status,
    product: {
      id: vp.product?.id ?? "",
      name: vp.product?.name ?? "Unknown product",
      sku: vp.product?.sku ?? "",
      size: vp.product?.size ?? "",
      colour: vp.product?.colour ?? "",
      price: vp.product?.price ?? 0,
      imageKey: vp.product?.image_key ?? null,
    },
    timeline: {
      addedAt: vp.added_at,
      trialStartedAt: vp.trial_started_at,
      trialCompletedAt: vp.trial_completed_at,
      likedAt: vp.liked_at,
      droppedAt: vp.dropped_at,
    },
    dropReason: vp.drop_reason
      ? { id: vp.drop_reason.id, code: vp.drop_reason.code, label: vp.drop_reason.label }
      : null,
    note: vp.note,
  };
}

async function refreshCard(id: string): Promise<ProductCardDTO> {
  const vp = await getVisitProductById(id);
  if (!vp) throw new Stage2Error(STAGE2_ERRORS.VISIT_PRODUCT_NOT_FOUND, "Product disappeared", 404);
  return toProductCard(vp);
}

/** Validate the state machine, update conditionally, then record the event. */
async function runTransition(
  auth: AuthContext,
  visitId: string,
  id: string,
  expected: ProductVisitStatus,
  next: ProductVisitStatus,
  patch: Partial<VisitProductRow>,
  eventType: string,
  metadata: Record<string, unknown>,
): Promise<ProductCardDTO> {
  if (!canTransitionProductStatus(expected, next)) {
    throw new Stage2Error(STAGE2_ERRORS.INVALID_PRODUCT_STATE, `Cannot go from ${expected} to ${next}`, 422);
  }
  const updated = await transitionVisitProduct(id, expected, { ...patch, status: next });
  if (!updated) {
    const current = await getVisitProductById(id);
    if (!current) {
      throw new Stage2Error(STAGE2_ERRORS.VISIT_PRODUCT_NOT_FOUND, "Product is no longer in this visit", 404);
    }
    throw new Stage2Error(
      STAGE2_ERRORS.PRODUCT_STATE_CHANGED,
      `Product is now ${current.status}. Refresh and try again.`,
      409,
    );
  }
  await insertVisitEvent({
    visitId,
    eventType,
    actorId: auth.userId,
    entityType: "VISIT_PRODUCT",
    entityId: id,
    metadata,
  });
  return refreshCard(id);
}

/* ---------- Operations (§19) ---------- */

/** resolveProduct(): identify a variant from a barcode/SKU without adding it. */
export async function scanProduct(auth: AuthContext, visitId: string, identifier: string) {
  const visit = await loadVisit(visitId);
  assertStoreAccess(auth, visit.store_id);
  assertVisitActive(visit);

  const variant = await resolveVariantByIdentifier(identifier);
  if (!variant) throw new Stage2Error(STAGE2_ERRORS.PRODUCT_NOT_FOUND, "No product matches that code", 404);

  const existing = (await listVisitProducts(visitId)).find(
    (vp) => vp.product_variant_id === variant.id,
  );
  return {
    product: toResolvedProduct(variant),
    alreadyAdded: Boolean(existing),
    visitProductId: existing?.id ?? null,
  };
}

/** addProductToVisit(): idempotent by unique(visit_id, product_variant_id). */
export async function addProductToVisit(
  auth: AuthContext,
  visitId: string,
  productVariantId: string,
) {
  const visit = await loadVisit(visitId);
  assertStoreAccess(auth, visit.store_id);
  assertVisitActive(visit);

  const variant = await getVariantById(productVariantId);
  if (!variant || !variant.is_active) {
    throw new Stage2Error(STAGE2_ERRORS.PRODUCT_NOT_FOUND, "Product variant not found", 404);
  }

  // Already on this visit? Return the existing interaction instead of erroring —
  // a retried scan must not create a second row (§38).
  const existing = (await listVisitProducts(visitId)).find(
    (vp) => vp.product_variant_id === productVariantId,
  );
  if (existing) return { added: false as const, product: toProductCard(existing) };

  let created: { id: string };
  try {
    created = await insertVisitProduct(visitId, productVariantId);
  } catch (e) {
    // Concurrent duplicate: unique violation. Fall back to the existing row.
    if ((e as { code?: string })?.code === "23505") {
      const raced = (await listVisitProducts(visitId)).find(
        (vp) => vp.product_variant_id === productVariantId,
      );
      if (raced) return { added: false as const, product: toProductCard(raced) };
    }
    throw e;
  }

  await insertVisitEvent({
    visitId,
    eventType: "PRODUCT_ADDED",
    actorId: auth.userId,
    entityType: "VISIT_PRODUCT",
    entityId: created.id,
    metadata: {
      product_variant_id: variant.id,
      sku: variant.sku,
      barcode: variant.barcode,
      size: variant.size,
      colour: variant.colour,
    },
  });

  return { added: true as const, product: await refreshCard(created.id) };
}

export async function startTrial(auth: AuthContext, visitProductId: string) {
  const { vp, visit } = await loadVisitProduct(auth, visitProductId);
  assertVisitActive(visit);
  if (vp.status === "TRIAL_IN_PROGRESS") return toProductCard(vp); // idempotent retry
  return runTransition(auth, vp.visit_id, vp.id, vp.status, "TRIAL_IN_PROGRESS", { trial_started_at: nowIso() }, "TRIAL_STARTED", {
    product_variant_id: vp.product_variant_id,
    sku: vp.product?.sku ?? null,
  });
}

export async function completeTrial(auth: AuthContext, visitProductId: string) {
  const { vp, visit } = await loadVisitProduct(auth, visitProductId);
  assertVisitActive(visit);
  if (vp.status === "TRIAL_COMPLETED") return toProductCard(vp);
  return runTransition(auth, vp.visit_id, vp.id, vp.status, "TRIAL_COMPLETED", { trial_completed_at: nowIso() }, "TRIAL_COMPLETED", {
    product_variant_id: vp.product_variant_id,
    sku: vp.product?.sku ?? null,
  });
}

export async function likeProduct(auth: AuthContext, visitProductId: string) {
  const { vp, visit } = await loadVisitProduct(auth, visitProductId);
  assertVisitActive(visit);
  if (vp.status === "LIKED") return toProductCard(vp);
  return runTransition(auth, vp.visit_id, vp.id, vp.status, "LIKED", { liked_at: nowIso() }, "PRODUCT_LIKED", {
    product_variant_id: vp.product_variant_id,
    sku: vp.product?.sku ?? null,
  });
}

/** dropProduct(): reason is mandatory and captured atomically (§25, §26). */
export async function dropProduct(
  auth: AuthContext,
  visitProductId: string,
  dropReasonId: string,
  note: string | null = null,
) {
  if (!dropReasonId) {
    throw new Stage2Error(STAGE2_ERRORS.DROP_REASON_REQUIRED, "Choose a drop reason", 422);
  }
  const { vp, visit } = await loadVisitProduct(auth, visitProductId);
  assertVisitActive(visit);

  const reason = await getDropReasonById(dropReasonId);
  if (!reason || !reason.is_active) {
    throw new Stage2Error(STAGE2_ERRORS.DROP_REASON_NOT_FOUND, "Drop reason not found", 404);
  }

  if (vp.status === "DROPPED" && vp.drop_reason_id === dropReasonId) {
    return toProductCard(vp); // idempotent retry
  }

  return runTransition(
    auth,
    vp.visit_id,
    vp.id,
    vp.status,
    "DROPPED",
    { dropped_at: nowIso(), drop_reason_id: dropReasonId, note },
    "PRODUCT_DROPPED",
    {
      product_variant_id: vp.product_variant_id,
      sku: vp.product?.sku ?? null,
      drop_reason_id: reason.id,
      drop_reason_code: reason.code,
      note,
    },
  );
}

/** captureDropReason(): correct/clarify the reason on an already-dropped item. */
export async function captureDropReason(
  auth: AuthContext,
  visitProductId: string,
  dropReasonId: string,
  note: string | null = null,
) {
  const { vp, visit } = await loadVisitProduct(auth, visitProductId);
  assertStoreAccess(auth, visit.store_id);
  if (vp.status !== "DROPPED") {
    throw new Stage2Error(STAGE2_ERRORS.PRODUCT_NOT_DROPPED, "Product has not been dropped", 422);
  }
  const reason = await getDropReasonById(dropReasonId);
  if (!reason || !reason.is_active) {
    throw new Stage2Error(STAGE2_ERRORS.DROP_REASON_NOT_FOUND, "Drop reason not found", 404);
  }
  await patchVisitProduct(vp.id, { drop_reason_id: dropReasonId, note });
  await insertVisitEvent({
    visitId: vp.visit_id,
    eventType: "DROP_REASON_CAPTURED",
    actorId: auth.userId,
    entityType: "VISIT_PRODUCT",
    entityId: vp.id,
    metadata: {
      product_variant_id: vp.product_variant_id,
      drop_reason_id: reason.id,
      drop_reason_code: reason.code,
      note,
    },
  });
  return refreshCard(vp.id);
}

/** removeProductFromVisit(): only before a verdict is reached. */
export async function removeProductFromVisit(auth: AuthContext, visitProductId: string) {
  const { vp, visit } = await loadVisitProduct(auth, visitProductId);
  assertVisitActive(visit);
  if (vp.status !== "SELECTED" && vp.status !== "TRIAL_IN_PROGRESS") {
    throw new Stage2Error(
      STAGE2_ERRORS.INVALID_PRODUCT_STATE,
      "Products with a verdict cannot be removed — drop or like them instead.",
      422,
    );
  }
  await deleteVisitProduct(vp.id);
  await insertVisitEvent({
    visitId: vp.visit_id,
    eventType: "PRODUCT_REMOVED",
    actorId: auth.userId,
    entityType: "VISIT_PRODUCT",
    entityId: vp.id,
    metadata: { product_variant_id: vp.product_variant_id, sku: vp.product?.sku ?? null },
  });
  return { removed: true as const, visitProductId: vp.id };
}

/* ---------- Reads (§27, §44) ---------- */

export async function getVisitProductsForVisit(auth: AuthContext, visitId: string) {
  const visit = await loadVisit(visitId);
  assertStoreAccess(auth, visit.store_id);
  const [rows, dropReasons] = await Promise.all([listVisitProducts(visitId), listDropReasons()]);
  return {
    visitId,
    summary: computeVisitProductSummary(rows),
    products: rows.map(toProductCard),
    dropReasons: dropReasons.map((r) => ({
      id: r.id,
      code: r.code,
      label: r.label,
      description: r.description,
      sortOrder: r.sort_order,
    })),
  };
}

export async function getVisitWithProducts(auth: AuthContext, visitId: string): Promise<VisitWithProductsDTO> {
  const visit = await loadVisit(visitId);
  assertStoreAccess(auth, visit.store_id);
  const [rows, dropReasons, customer] = await Promise.all([
    listVisitProducts(visitId),
    listDropReasons(),
    visit.customer_id ? getCustomerBrief(visit.customer_id) : Promise.resolve(null),
  ]);
  return {
    visit: {
      id: visit.id,
      status: visit.status,
      storeId: visit.store_id,
      customerId: visit.customer_id,
      customerName: customer?.name ?? null,
      salespersonId: visit.assigned_salesperson_id,
      arrivedAt: visit.arrived_at,
      startedAt: visit.started_at,
      completedAt: visit.completed_at,
    },
    summary: computeVisitProductSummary(rows),
    products: rows.map(toProductCard),
    dropReasons: dropReasons.map((r) => ({
      id: r.id,
      code: r.code,
      label: r.label,
      description: r.description,
      sortOrder: r.sort_order,
    })),
  };
}
