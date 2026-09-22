
import { z } from "zod";

/* ---------- Scan / resolve product ---------- */

export const resolveProductSchema = z.object({
  identifier: z.string().min(1, "Scan or enter a product identifier"),
});
export type ResolveProductInput = z.infer<typeof resolveProductSchema>;

/* ---------- Search products by name / partial code ---------- */

export const searchProductsSchema = z.object({
  query: z.string().trim().min(2, "Type at least 2 characters").max(100),
});
export type SearchProductsInput = z.infer<typeof searchProductsSchema>;

/* ---------- Add product to visit ---------- */

export const addProductToVisitSchema = z.object({
  visitId: z.string().min(1, "Visit ID required"),
  productVariantId: z.string().min(1, "Product variant ID required"),
});
export type AddProductToVisitInput = z.infer<typeof addProductToVisitSchema>;

/* ---------- Trial operations ---------- */

export const startTrialSchema = z.object({
  visitProductId: z.string().min(1, "Visit product ID required"),
});
export type StartTrialInput = z.infer<typeof startTrialSchema>;

export const completeTrialSchema = z.object({
  visitProductId: z.string().min(1, "Visit product ID required"),
});
export type CompleteTrialInput = z.infer<typeof completeTrialSchema>;

/* ---------- Like / drop ---------- */

export const likeProductSchema = z.object({
  visitProductId: z.string().min(1, "Visit product ID required"),
});
export type LikeProductInput = z.infer<typeof likeProductSchema>;

/* ---------- Billed — scanned (roadmap Stage 3) ----------
   Bill number is OPTIONAL: the FC can bill liked pieces immediately and add
   the paper bill number later (or never — walk-in cash sales often have none).
   Bulk billing covers 2–3 pieces on one bill, Amazon-cart style. */

export const markPurchasedSchema = z.object({
  visitProductId: z.string().min(1, "Visit product ID required"),
  billNumber: z.string().trim().max(50).optional().default(""),
});
export type MarkPurchasedInput = z.infer<typeof markPurchasedSchema>;

export const markPurchasedManySchema = z.object({
  visitProductIds: z.array(z.string().min(1)).min(1, "Pick at least one product").max(20),
  billNumber: z.string().trim().max(50).optional().default(""),
});
export type MarkPurchasedManyInput = z.infer<typeof markPurchasedManySchema>;

/* Drop is ONE atomic operation: a DROPPED row can never exist without a reason
   (matches the visit_products_drop_reason_required DB check). */
export const dropProductSchema = z.object({
  visitProductId: z.string().min(1, "Visit product ID required"),
  dropReasonId: z.string().min(1, "Choose why the customer dropped it"),
  note: z.string().max(500).optional(),
});
export type DropProductInput = z.infer<typeof dropProductSchema>;

/* ---------- Capture / correct drop reason ---------- */

export const captureDropReasonSchema = z.object({
  visitProductId: z.string().min(1, "Visit product ID required"),
  dropReasonId: z.string().min(1, "Drop reason required"),
  note: z.string().max(500).optional(),
});
export type CaptureDropReasonInput = z.infer<typeof captureDropReasonSchema>;

/* ---------- Remove product from visit ---------- */

export const removeProductFromVisitSchema = z.object({
  visitProductId: z.string().min(1, "Visit product ID required"),
});
export type RemoveProductFromVisitInput = z.infer<typeof removeProductFromVisitSchema>;

/* ---------- Get visit products / summary ---------- */

export const visitProductsSchema = z.object({
  visitId: z.string().min(1, "Visit ID required"),
});
export type VisitProductsInput = z.infer<typeof visitProductsSchema>;
