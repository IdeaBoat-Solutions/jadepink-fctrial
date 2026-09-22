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
  recordSale,
  resolveVariantByIdentifier,
  searchVariants,
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
  product_image_url?: string | null;
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
    imageUrl: v.product_image_url ?? null,
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
      imageUrl: vp.product?.image_url ?? vp.variant?.product_image_url ?? null,
    },
    timeline: {
      addedAt: vp.added_at,
      trialStartedAt: vp.trial_started_at,
      trialCompletedAt: vp.trial_completed_at,
      likedAt: vp.liked_at,
      droppedAt: vp.dropped_at,
      purchasedAt: vp.purchased_at ?? null,
    },
    dropReason: vp.drop_reason
      ? { id: vp.drop_reason.id, code: vp.drop_reason.code, label: vp.drop_reason.label }
      : null,
    dropSubcategory: vp.drop_subcategory ?? null,
    note: vp.note,
    staffNote: vp.staff_note,
    billNumber: vp.bill_number ?? null,
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

/** searchProducts(): fuzzy fallback when exact scan misses — typo-tolerant,
    token-order-free matching over name + colour + size + category + SKU.
    Read-only; visit must still be ACTIVE and store-scoped. Each candidate
    carries alreadyAdded so the UI focuses instead of duplicating. */
export async function searchProducts(auth: AuthContext, visitId: string, query: string) {
  const visit = await loadVisit(visitId);
  assertStoreAccess(auth, visit.store_id);
  assertVisitActive(visit);

  const q = (query ?? "").trim();
  if (q.length < 2) return { query: q, results: [] as Array<ResolvedProduct & { alreadyAdded: boolean; visitProductId: string | null }> };

  const [variants, existing] = await Promise.all([searchVariants(q), listVisitProducts(visitId)]);
  const onVisit = new Map(existing.map((vp) => [vp.product_variant_id, vp.id]));
  return {
    query: q,
    results: variants.map((v) => ({
      ...toResolvedProduct(v),
      alreadyAdded: onVisit.has(v.id),
      visitProductId: onVisit.get(v.id) ?? null,
    })),
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

/* ---------- Undo: every step can step back ----------
   A mistaken tap on the floor must never trap a product. Each undo returns
   the piece where it came from and records its own event, so the timeline
   stays honest (liked → unliked reads as two facts, not a silent rewrite). */

/** unlikeProduct(): LIKED steps back to trial-completed when trialled, else
    straight back to selected. */
export async function unlikeProduct(auth: AuthContext, visitProductId: string) {
  const { vp, visit } = await loadVisitProduct(auth, visitProductId);
  assertVisitActive(visit);
  const back = vp.trial_completed_at ? "TRIAL_COMPLETED" : "SELECTED";
  if (vp.status === back && !vp.liked_at) return toProductCard(vp); // already undone retry
  return runTransition(auth, vp.visit_id, vp.id, "LIKED", back, { liked_at: null }, "PRODUCT_UNLIKED", {
    product_variant_id: vp.product_variant_id,
    sku: vp.product?.sku ?? null,
  });
}

/** reopenTrial(): a completed trial goes back in progress (customer tries again). */
export async function reopenTrial(auth: AuthContext, visitProductId: string) {
  const { vp, visit } = await loadVisitProduct(auth, visitProductId);
  assertVisitActive(visit);
  if (vp.status === "TRIAL_IN_PROGRESS" && !vp.trial_completed_at) return toProductCard(vp);
  return runTransition(auth, vp.visit_id, vp.id, "TRIAL_COMPLETED", "TRIAL_IN_PROGRESS", { trial_completed_at: null }, "TRIAL_REOPENED", {
    product_variant_id: vp.product_variant_id,
    sku: vp.product?.sku ?? null,
  });
}

/** cancelTrial(): a trial in progress is called off — back to selected. */
export async function cancelTrial(auth: AuthContext, visitProductId: string) {
  const { vp, visit } = await loadVisitProduct(auth, visitProductId);
  assertVisitActive(visit);
  if (vp.status === "SELECTED" && !vp.trial_started_at) return toProductCard(vp);
  return runTransition(auth, vp.visit_id, vp.id, "TRIAL_IN_PROGRESS", "SELECTED", { trial_started_at: null }, "TRIAL_CANCELLED", {
    product_variant_id: vp.product_variant_id,
    sku: vp.product?.sku ?? null,
  });
}

/** undropProduct(): a dropped piece comes back where it was dropped from.
    The drop reason stays in the event history; the row itself is live again. */
export async function undropProduct(auth: AuthContext, visitProductId: string) {
  const { vp, visit } = await loadVisitProduct(auth, visitProductId);
  assertVisitActive(visit);
  const back = vp.liked_at ? "LIKED" : vp.trial_completed_at ? "TRIAL_COMPLETED" : vp.trial_started_at ? "TRIAL_IN_PROGRESS" : "SELECTED";
  if (vp.status === back) return toProductCard(vp);
  return runTransition(auth, vp.visit_id, vp.id, "DROPPED", back, { dropped_at: null, drop_reason_id: null }, "PRODUCT_UNDROPPED", {
    product_variant_id: vp.product_variant_id,
    sku: vp.product?.sku ?? null,
    previous_drop_reason_id: vp.drop_reason_id,
  });
}

/** markProductPurchased(): roadmap Stage 3 "Billed". The (optional) bill number
    is attached and the sale closed against the piece. Bill number is NOT
    mandatory — walk-in cash sales often have none on the floor; it can be
    left blank. */
export async function markProductPurchased(
  auth: AuthContext,
  visitProductId: string,
  billNumber?: string,
) {
  const bill = (billNumber ?? "").trim();
  const { vp, visit } = await loadVisitProduct(auth, visitProductId);
  assertVisitActive(visit);
  if (vp.status === "PURCHASED") {
    // Idempotent retry — optionally backfill a bill number that was skipped.
    if (bill && !vp.bill_number) {
      await patchVisitProduct(vp.id, { bill_number: bill });
      await insertVisitEvent({
        visitId: vp.visit_id,
        eventType: "PRODUCT_PURCHASED",
        actorId: auth.userId,
        entityType: "VISIT_PRODUCT",
        entityId: vp.id,
        metadata: {
          product_variant_id: vp.product_variant_id,
          sku: vp.product?.sku ?? null,
          bill_number: bill,
        },
      });
    }
    // Heal the ledger: pieces billed before migration 210 (or after a failed
    // ledger write) still have order_id NULL — record_sale picks them up and
    // is a no-op when the order already exists.
    await recordSale(vp.visit_id, bill || vp.bill_number || null, [vp.id], auth.userId);
    return refreshCard(vp.id);
  }
  const card = await runTransition(
    auth,
    vp.visit_id,
    vp.id,
    vp.status,
    "PURCHASED",
    { purchased_at: nowIso(), bill_number: bill || null },
    "PRODUCT_PURCHASED",
    {
      product_variant_id: vp.product_variant_id,
      sku: vp.product?.sku ?? null,
      bill_number: bill || null,
    },
  );
  // Ledger write AFTER the state change (same ordering rule as events): if it
  // throws, the sale is still recorded on visit_products and the next retry
  // lands in the idempotent branch above, which records only the missing order.
  await recordSale(vp.visit_id, bill || null, [card.id], auth.userId);
  return card;
}

/** markProductsPurchased(): bill 2–3 liked pieces together on ONE bill,
    Amazon-cart style. One (optional) bill number is stamped on every piece.
    Per-item results: billable rows (LIKED, or DROPPED bought anyway) go
    through; anything else is reported in `failed` without aborting the rest. */
export async function markProductsPurchased(
  auth: AuthContext,
  visitProductIds: string[],
  billNumber?: string,
) {
  const bill = (billNumber ?? "").trim();
  const billed: ProductCardDTO[] = [];
  const failed: Array<{ visitProductId: string; code: string; message: string }> = [];
  const seen = new Set<string>();
  let visitId: string | null = null;
  for (const id of visitProductIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    try {
      const { vp, visit } = await loadVisitProduct(auth, id);
      visitId = visit.id;
      assertVisitActive(visit);
      if (vp.status === "PURCHASED") {
        if (bill && !vp.bill_number) {
          await patchVisitProduct(vp.id, { bill_number: bill });
        }
        billed.push(await refreshCard(vp.id));
        continue;
      }
      if (!canTransitionProductStatus(vp.status, "PURCHASED")) {
        failed.push({
          visitProductId: id,
          code: STAGE2_ERRORS.INVALID_PRODUCT_STATE,
          message: `${vp.product?.name ?? "Product"} is ${vp.status} — only liked pieces can be billed together`,
        });
        continue;
      }
      billed.push(
        await runTransition(
          auth,
          vp.visit_id,
          vp.id,
          vp.status,
          "PURCHASED",
          { purchased_at: nowIso(), bill_number: bill || null },
          "PRODUCT_PURCHASED",
          {
            product_variant_id: vp.product_variant_id,
            sku: vp.product?.sku ?? null,
            bill_number: bill || null,
          },
        ),
      );
    } catch (e) {
      const payload = e instanceof Stage2Error
        ? { code: e.code, message: e.message }
        : { code: "INTERNAL", message: e instanceof Error ? e.message : "Could not bill this piece" };
      failed.push({ visitProductId: id, ...payload });
    }
  }
  // One ledger order for this whole billing action. Already-PURCHASED rows
  // are included on purpose: record_sale skips pieces whose order_id is set,
  // so a retry after a partial failure records only the missing order.
  if (visitId && billed.length > 0) {
    await recordSale(visitId, bill || null, billed.map((c) => c.id), auth.userId);
  }
  return { billed, failed, billNumber: bill || null };
}

/** dropProduct(): reason is mandatory and captured atomically (§25, §26). */
export async function dropProduct(
  auth: AuthContext,
  visitProductId: string,
  dropReasonId: string,
  note: string | null = null,
  subCategory: string | null = null,
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
    { dropped_at: nowIso(), drop_reason_id: dropReasonId, drop_subcategory: subCategory || null, note },
    "PRODUCT_DROPPED",
    {
      product_variant_id: vp.product_variant_id,
      sku: vp.product?.sku ?? null,
      drop_reason_id: reason.id,
      drop_reason_code: reason.code,
      drop_subcategory: subCategory || null,
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
  subCategory: string | null = null,
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
  await patchVisitProduct(vp.id, { drop_reason_id: dropReasonId, drop_subcategory: subCategory || null, note });
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
      drop_subcategory: subCategory || null,
      note,
    },
  });
  return refreshCard(vp.id);
}

/** setVisitProductNote(): the FC's handling note for a piece ("pack with
    sleeve", "ask about the fit"). Not a state transition — allowed in any
    product state on an active visit, cleared by saving an empty note. */
export async function setVisitProductNote(
  auth: AuthContext,
  visitProductId: string,
  note: string | null,
) {
  const { vp, visit } = await loadVisitProduct(auth, visitProductId);
  assertVisitActive(visit);
  const clean = (note ?? "").trim().slice(0, 500) || null;
  if ((vp.staff_note ?? null) === clean) return refreshCard(vp.id);
  await patchVisitProduct(vp.id, { staff_note: clean });
  await insertVisitEvent({
    visitId: vp.visit_id,
    eventType: "PRODUCT_NOTE_UPDATED",
    actorId: auth.userId,
    entityType: "VISIT_PRODUCT",
    entityId: vp.id,
    metadata: {
      product_variant_id: vp.product_variant_id,
      sku: vp.product?.sku ?? null,
      note: clean,
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
      suite: visit.suite ?? null,
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
