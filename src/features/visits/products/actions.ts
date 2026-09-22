
"use server";

import { requireAuth } from "@/lib/authz";
import { toErrorPayload } from "@/lib/errors";
import {
  scanProduct,
  searchProducts,
  markProductPurchased,
  markProductsPurchased,
  addProductToVisit,
  startTrial,
  completeTrial,
  likeProduct,
  dropProduct,
  captureDropReason,
  removeProductFromVisit,
  getVisitWithProducts,
  getVisitProductsForVisit,
} from "./service";
import {
  resolveProductSchema,
  searchProductsSchema,
  markPurchasedSchema,
  markPurchasedManySchema,
  addProductToVisitSchema,
  startTrialSchema,
  completeTrialSchema,
  likeProductSchema,
  dropProductSchema,
  captureDropReasonSchema,
  removeProductFromVisitSchema,
  visitProductsSchema,
} from "./schemas";

export async function scanProductAction(input: { visitId: string; identifier: string }) {
  try {
    const auth = await requireAuth();
    const parsed = resolveProductSchema.parse({ identifier: input.identifier });
    const data = await scanProduct(auth, input.visitId, parsed.identifier);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}

export async function searchProductsAction(input: { visitId: string; query: string }) {
  try {
    const auth = await requireAuth();
    const parsed = searchProductsSchema.parse({ query: input.query });
    const data = await searchProducts(auth, input.visitId, parsed.query);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}

export async function addProductToVisitAction(input: { visitId: string; productVariantId: string }) {
  try {
    const auth = await requireAuth();
    const parsed = addProductToVisitSchema.parse(input);
    const data = await addProductToVisit(auth, parsed.visitId, parsed.productVariantId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}

export async function startTrialAction(input: { visitProductId: string }) {
  try {
    const auth = await requireAuth();
    const parsed = startTrialSchema.parse(input);
    const data = await startTrial(auth, parsed.visitProductId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}

export async function completeTrialAction(input: { visitProductId: string }) {
  try {
    const auth = await requireAuth();
    const parsed = completeTrialSchema.parse(input);
    const data = await completeTrial(auth, parsed.visitProductId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}

export async function likeProductAction(input: { visitProductId: string }) {
  try {
    const auth = await requireAuth();
    const parsed = likeProductSchema.parse(input);
    const data = await likeProduct(auth, parsed.visitProductId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}

export async function markProductPurchasedAction(input: { visitProductId: string; billNumber?: string }) {
  try {
    const auth = await requireAuth();
    const parsed = markPurchasedSchema.parse(input);
    const data = await markProductPurchased(auth, parsed.visitProductId, parsed.billNumber);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}

export async function markProductsPurchasedAction(input: { visitProductIds: string[]; billNumber?: string }) {
  try {
    const auth = await requireAuth();
    const parsed = markPurchasedManySchema.parse(input);
    const data = await markProductsPurchased(auth, parsed.visitProductIds, parsed.billNumber);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}

export async function dropProductAction(input: { visitProductId: string; dropReasonId: string; note?: string }) {
  try {
    const auth = await requireAuth();
    const parsed = dropProductSchema.parse(input);
    const data = await dropProduct(auth, parsed.visitProductId, parsed.dropReasonId, parsed.note ?? null);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}

export async function captureDropReasonAction(input: { visitProductId: string; dropReasonId: string; note?: string }) {
  try {
    const auth = await requireAuth();
    const parsed = captureDropReasonSchema.parse(input);
    const data = await captureDropReason(auth, parsed.visitProductId, parsed.dropReasonId, parsed.note ?? null);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}

export async function removeProductFromVisitAction(input: { visitProductId: string }) {
  try {
    const auth = await requireAuth();
    const parsed = removeProductFromVisitSchema.parse(input);
    const data = await removeProductFromVisit(auth, parsed.visitProductId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}

export async function getVisitWithProductsAction(visitId: string) {
  try {
    const auth = await requireAuth();
    const parsed = visitProductsSchema.parse({ visitId });
    const data = await getVisitWithProducts(auth, parsed.visitId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}

export async function getVisitProductsForVisitAction(visitId: string) {
  try {
    const auth = await requireAuth();
    const parsed = visitProductsSchema.parse({ visitId });
    const data = await getVisitProductsForVisit(auth, parsed.visitId);
    return { ok: true as const, data };
  } catch (e) {
    return { ok: false as const, ...toErrorPayload(e) };
  }
}
