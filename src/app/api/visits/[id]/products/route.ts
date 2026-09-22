import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { toErrorPayload } from "@/lib/errors";
import {
  addProductToVisit,
  cancelTrial,
  captureDropReason,
  completeTrial,
  dropProduct,
  getVisitWithProducts,
  likeProduct,
  markProductPurchased,
  markProductsPurchased,
  removeProductFromVisit,
  reopenTrial,
  scanProduct,
  searchProducts,
  startTrial,
  undropProduct,
  unlikeProduct,
} from "@/features/visits/products/service";
import {
  addProductToVisitSchema,
  captureDropReasonSchema,
  completeTrialSchema,
  dropProductSchema,
  likeProductSchema,
  markPurchasedManySchema,
  markPurchasedSchema,
  removeProductFromVisitSchema,
  resolveProductSchema,
  searchProductsSchema,
  startTrialSchema,
  undoProductSchema,
} from "@/features/visits/products/schemas";

function fail(e: unknown) {
  const err = toErrorPayload(e);
  return NextResponse.json({ code: err.code, message: err.message }, { status: err.status });
}

/** GET /api/visits/[id]/products — visit + product cards + summary + drop reasons (§44). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    const data = await getVisitWithProducts(auth, id);
    return NextResponse.json({ data });
  } catch (e) {
    return fail(e);
  }
}

/**
 * POST /api/visits/[id]/products
 * Explicit business operations — never a raw status write (§11, §34).
 *
 *   { action: "scan",               identifier }
 *   { action: "search",             query }
 *   { action: "add",                productVariantId }
 *   { action: "start-trial",        visitProductId }
 *   { action: "complete-trial",     visitProductId }
 *   { action: "like",               visitProductId }
 *   { action: "mark-purchased",     visitProductId, billNumber? }
 *   { action: "mark-purchased-many", visitProductIds, billNumber? }
 *   { action: "drop",               visitProductId, dropReasonId, note? }
 *   { action: "capture-drop-reason",visitProductId, dropReasonId, note? }
 *   { action: "remove",             visitProductId }
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAuth();
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? "");

    switch (action) {
      case "scan": {
        const parsed = resolveProductSchema.parse({ identifier: body.identifier });
        return NextResponse.json({ data: await scanProduct(auth, id, parsed.identifier) });
      }
      case "search": {
        const parsed = searchProductsSchema.parse({ query: body.query ?? body.identifier });
        return NextResponse.json({ data: await searchProducts(auth, id, parsed.query) });
      }
      case "add": {
        const parsed = addProductToVisitSchema.parse({ visitId: id, productVariantId: body.productVariantId });
        return NextResponse.json({ data: await addProductToVisit(auth, parsed.visitId, parsed.productVariantId) });
      }
      case "start-trial": {
        const parsed = startTrialSchema.parse({ visitProductId: body.visitProductId });
        return NextResponse.json({ data: await startTrial(auth, parsed.visitProductId) });
      }
      case "complete-trial": {
        const parsed = completeTrialSchema.parse({ visitProductId: body.visitProductId });
        return NextResponse.json({ data: await completeTrial(auth, parsed.visitProductId) });
      }
      case "like": {
        const parsed = likeProductSchema.parse({ visitProductId: body.visitProductId });
        return NextResponse.json({ data: await likeProduct(auth, parsed.visitProductId) });
      }
      case "unlike": {
        const parsed = undoProductSchema.parse({ visitProductId: body.visitProductId });
        return NextResponse.json({ data: await unlikeProduct(auth, parsed.visitProductId) });
      }
      case "reopen-trial": {
        const parsed = undoProductSchema.parse({ visitProductId: body.visitProductId });
        return NextResponse.json({ data: await reopenTrial(auth, parsed.visitProductId) });
      }
      case "cancel-trial": {
        const parsed = undoProductSchema.parse({ visitProductId: body.visitProductId });
        return NextResponse.json({ data: await cancelTrial(auth, parsed.visitProductId) });
      }
      case "undrop": {
        const parsed = undoProductSchema.parse({ visitProductId: body.visitProductId });
        return NextResponse.json({ data: await undropProduct(auth, parsed.visitProductId) });
      }
      case "mark-purchased": {
        const parsed = markPurchasedSchema.parse({
          visitProductId: body.visitProductId,
          billNumber: body.billNumber ?? "",
        });
        return NextResponse.json({
          data: await markProductPurchased(auth, parsed.visitProductId, parsed.billNumber),
        });
      }
      case "mark-purchased-many": {
        const parsed = markPurchasedManySchema.parse({
          visitProductIds: body.visitProductIds,
          billNumber: body.billNumber ?? "",
        });
        return NextResponse.json({
          data: await markProductsPurchased(auth, parsed.visitProductIds, parsed.billNumber),
        });
      }
      case "drop": {
        const parsed = dropProductSchema.parse({
          visitProductId: body.visitProductId,
          dropReasonId: body.dropReasonId,
          note: body.note,
        });
        return NextResponse.json({
          data: await dropProduct(auth, parsed.visitProductId, parsed.dropReasonId, parsed.note ?? null),
        });
      }
      case "capture-drop-reason": {
        const parsed = captureDropReasonSchema.parse({
          visitProductId: body.visitProductId,
          dropReasonId: body.dropReasonId,
          note: body.note,
        });
        return NextResponse.json({
          data: await captureDropReason(auth, parsed.visitProductId, parsed.dropReasonId, parsed.note ?? null),
        });
      }
      case "remove": {
        const parsed = removeProductFromVisitSchema.parse({ visitProductId: body.visitProductId });
        return NextResponse.json({ data: await removeProductFromVisit(auth, parsed.visitProductId) });
      }
      default:
        return NextResponse.json(
          { code: "INVALID_PRODUCT_STATE", message: `Unknown action "${action}"` },
          { status: 422 },
        );
    }
  } catch (e) {
    return fail(e);
  }
}
