
import { z } from "zod";
import type { ProductVisitStatus } from "./types";

/* Reusable status enum validator — mirrors the Postgres enum. */
export const productVisitStatusSchema = z.enum([
  "SELECTED",
  "TRIAL_IN_PROGRESS",
  "TRIAL_COMPLETED",
  "LIKED",
  "DROPPED",
  "PURCHASED",
]) as z.ZodType<ProductVisitStatus>;

/* Drop reason codes (mirrors seed data). */
export const dropReasonCodeSchema = z.enum([
  "SIZE",
  "FIT",
  "COLOUR",
  "DESIGN",
  "MATERIAL",
  "PRICE",
  "STYLE",
  "NOT_SUITABLE",
  "OTHER",
]);

/* Public product card (what the frontend renders). */
export interface ProductCardDTO {
  id: string; // visit_product id
  status: ProductVisitStatus;
  product: {
    id: string;
    name: string;
    sku: string;
    size: string;
    colour: string;
    price: number;
    imageKey: string | null;
  };
  timeline: {
    addedAt: string;
    trialStartedAt: string | null;
    trialCompletedAt: string | null;
    likedAt: string | null;
    droppedAt: string | null;
  };
  dropReason: { id: string; code: string; label: string } | null;
  note: string | null;
}

/* Visit product summary (derived counters). */
export interface VisitProductSummaryDTO {
  selected: number;
  trialInProgress: number;
  trialCompleted: number;
  liked: number;
  dropped: number;
  purchased: number;
}

/* Full visit-with-products response (what the floor UI consumes). */
export interface VisitWithProductsDTO {
  visit: {
    id: string;
    status: string;
    storeId: string;
    customerId: string | null;
    customerName: string | null;
    salespersonId: string | null;
    arrivedAt: string;
    startedAt: string | null;
    completedAt: string | null;
  };
  summary: VisitProductSummaryDTO;
  products: ProductCardDTO[];
  dropReasons: Array<{ id: string; code: string; label: string; description: string | null; sortOrder: number }>;
}
