/* Stage 2 + Stage 3 predictable error model (§36). Frontend maps codes to human copy. */

import { z } from "zod";

export const STAGE2_ERRORS = {
  CUSTOMER_NOT_FOUND: "CUSTOMER_NOT_FOUND",
  CUSTOMER_ALREADY_EXISTS: "CUSTOMER_ALREADY_EXISTS",
  INVALID_PHONE: "INVALID_PHONE",
  VISIT_NOT_FOUND: "VISIT_NOT_FOUND",
  VISIT_ALREADY_COMPLETED: "VISIT_ALREADY_COMPLETED",
  VISIT_NOT_ACTIVE: "VISIT_NOT_ACTIVE",
  INVALID_VISIT_STATE: "INVALID_VISIT_STATE",
  CUSTOMER_REQUIRED: "CUSTOMER_REQUIRED",
  SALESPERSON_REQUIRED: "SALESPERSON_REQUIRED",
  SALESPERSON_NOT_FOUND: "SALESPERSON_NOT_FOUND",
  SALESPERSON_NOT_AVAILABLE: "SALESPERSON_NOT_AVAILABLE",
  SALESPERSON_WRONG_STORE: "SALESPERSON_WRONG_STORE",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  CUSTOMER_HAS_HISTORY: "CUSTOMER_HAS_HISTORY",
  VISIT_NOT_DELETABLE: "VISIT_NOT_DELETABLE",
  /** The guards passed but the write itself failed (RLS, FK, outage). */
  OPERATION_FAILED: "OPERATION_FAILED",

  /* ---------- Stage 3: products, trials, likes/drops ---------- */
  PRODUCT_NOT_FOUND: "PRODUCT_NOT_FOUND",
  PRODUCT_ALREADY_ADDED: "PRODUCT_ALREADY_ADDED",
  VISIT_PRODUCT_NOT_FOUND: "VISIT_PRODUCT_NOT_FOUND",
  INVALID_PRODUCT_STATE: "INVALID_PRODUCT_STATE",
  /** Optimistic-concurrency guard: the row changed under us. */
  PRODUCT_STATE_CHANGED: "PRODUCT_STATE_CHANGED",
  DROP_REASON_REQUIRED: "DROP_REASON_REQUIRED",
  DROP_REASON_NOT_FOUND: "DROP_REASON_NOT_FOUND",
  PRODUCT_NOT_DROPPED: "PRODUCT_NOT_DROPPED",
  /* ---------- Stage 3: billed — scanned ---------- */
  BILL_NUMBER_REQUIRED: "BILL_NUMBER_REQUIRED",
  /** Roadmap: a visit cannot close while liked/trialled pieces are unbilled. */
  VISIT_HAS_UNBILLED_ITEMS: "VISIT_HAS_UNBILLED_ITEMS",
} as const;

export type Stage2ErrorCode = (typeof STAGE2_ERRORS)[keyof typeof STAGE2_ERRORS];

const NOT_FOUND_CODES: ReadonlySet<string> = new Set([
  "VISIT_NOT_FOUND",
  "CUSTOMER_NOT_FOUND",
  "SALESPERSON_NOT_FOUND",
  "PRODUCT_NOT_FOUND",
  "VISIT_PRODUCT_NOT_FOUND",
  "DROP_REASON_NOT_FOUND",
]);

const UNPROCESSABLE_CODES: ReadonlySet<string> = new Set([
  "INVALID_VISIT_STATE",
  "VISIT_ALREADY_COMPLETED",
  "INVALID_PHONE",
  "INVALID_PRODUCT_STATE",
  "VISIT_NOT_ACTIVE",
  "DROP_REASON_REQUIRED",
  "PRODUCT_NOT_DROPPED",
  "BILL_NUMBER_REQUIRED",
  "VISIT_HAS_UNBILLED_ITEMS",
]);

function statusFor(code: string): number {
  if (code === "UNAUTHORIZED") return 401;
  if (code === "FORBIDDEN" || code === "SALESPERSON_WRONG_STORE") return 403;
  if (NOT_FOUND_CODES.has(code)) return 404;
  if (code === "CUSTOMER_ALREADY_EXISTS" || code === "PRODUCT_ALREADY_ADDED" || code === "PRODUCT_STATE_CHANGED") return 409;
  if (code === "CUSTOMER_HAS_HISTORY") return 409;
  if (code === "VISIT_NOT_DELETABLE") return 409;
  if (code === "OPERATION_FAILED") return 500;
  if (UNPROCESSABLE_CODES.has(code)) return 422;
  return 400;
}

export class Stage2Error extends Error {
  code: Stage2ErrorCode;
  status: number;
  constructor(code: Stage2ErrorCode, message?: string, status?: number) {
    super(message ?? code);
    this.code = code;
    this.status = status ?? statusFor(code);
  }
}

export function toErrorPayload(e: unknown): { code: string; message: string; status: number } {
  if (e instanceof Stage2Error) return { code: e.code, message: e.message, status: e.status };
  // Zod input-validation failures are client errors, never 500s.
  if (e instanceof z.ZodError) {
    return { code: "INVALID_INPUT", message: e.issues[0]?.message ?? "Invalid request", status: 400 };
  }
  const msg = String((e as Error)?.message ?? e);
  // Unique violation → race-safe duplicate path (§20 / Stage 3 §38).
  if (msg.includes("Unique constraint") || msg.includes("duplicate key") || msg.includes("P2002")) {
    if (msg.includes("visit_products")) {
      return { code: STAGE2_ERRORS.PRODUCT_ALREADY_ADDED, message: "Product already added to this visit", status: 409 };
    }
    if (msg.includes("product_variants")) {
      return { code: STAGE2_ERRORS.PRODUCT_NOT_FOUND, message: "Duplicate product variant", status: 409 };
    }
    return { code: STAGE2_ERRORS.CUSTOMER_ALREADY_EXISTS, message: "Phone already registered", status: 409 };
  }
  return { code: "INTERNAL", message: msg.slice(0, 300), status: 500 };
}
