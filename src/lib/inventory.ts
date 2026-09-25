/* JadePink fullstack domain — Inventory, Orders, Suppliers, Dashboard.
   Complements src/lib/domain.ts (Stage 2 walk-in flow).
   Single source of truth for catalogue + stock + orders. */

import { z } from "zod";

export type StockStatus = "in-stock" | "low-stock" | "out-of-stock";
export type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";
type MovementType = "IN" | "OUT" | "ADJUST";

export interface Category {
  id: string;
  name: string;
  slug: string;
  productCount: number;
}

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  phone: string;
  email: string;
  city: string;
  activeProducts: number;
  rating: number;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  categoryId: string;
  categoryName: string;
  price: number;
  mrp: number;
  cost: number;
  stock: number;
  lowStockAt: number;
  sizes: string[];
  colors: string[];
  supplierId: string;
  supplierName: string;
  image?: string;
  /** Primary image (mirrors imageUrls[0]). Multiple images live in imageUrls. */
  imageUrl?: string | null;
  /** All product images, in display order. Set at creation; stored as text[] in DB. */
  imageUrls?: string[];
  /* S J FASHIONS live barcode fields (Barcode Search export) */
  barcode?: string | null;
  companyBarcode?: string | null;
  branchName?: string | null;
  department?: string | null;
  brandName?: string | null;
  designNo?: string | null;
  hsnCode?: string | null;
  partyName?: string | null;
  size?: string | null;
  color?: string | null;
  /** A product can have multiple sellable variants; each has its own code. */
  salesRate?: number | null;
  updatedAt: string;
}

export interface OrderItem {
  productId: string;
  productName: string;
  qty: number;
  price: number;
}

export interface Order {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  total: number;
  status: OrderStatus;
  channel: "walk-in" | "instagram" | "website" | "meta-lead";
  fcName?: string;
  createdAt: string;
}

export interface ProductVariant {
  id: string;
  productId: string;
  sku: string;
  barcode?: string | null;
  size: string;
  colour: string;
  price: number;
  imageKey?: string | null;
  isActive: boolean;
}

export interface StockMovement {
  id: string;
  productId: string;
  productName: string;
  type: MovementType;
  qty: number;
  reason: string;
  at: string;
  actor: string;
}

export function stockStatus(p: Pick<Product, "stock" | "lowStockAt">): StockStatus {
  if (p.stock <= 0) return "out-of-stock";
  if (p.stock <= p.lowStockAt) return "low-stock";
  return "in-stock";
}

export function stockLabel(s: StockStatus): string {
  switch (s) {
    case "in-stock": return "In stock";
    case "low-stock": return "Low stock";
    case "out-of-stock": return "Out of stock";
  }
}

/* ---------- Zod validations (shared client + API) ---------- */

export const productSchema = z.object({
  name: z.string().min(2, "Name needs at least 2 characters"),
  sku: z.string().min(2, "SKU required"),
  categoryId: z.string().min(1, "Pick a category"),
  price: z.coerce.number().min(1, "Price must be positive"),
  mrp: z.coerce.number().min(1).optional(),
  cost: z.coerce.number().min(0).optional(),
  stock: z.coerce.number().int().min(0),
  lowStockAt: z.coerce.number().int().min(0).default(5),
  supplierId: z.string().min(1, "Pick a supplier"),
  barcode: z.string().optional(),
  companyBarcode: z.string().optional(),
  brandName: z.string().optional(),
  designNo: z.string().optional(),
  hsnCode: z.string().optional(),
  size: z.string().optional(),
  color: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  imageUrls: z.array(z.string().url()).max(10).default([]),
});

export type ProductInput = z.infer<typeof productSchema>;

export const orderSchema = z.object({
  customerName: z.string().min(2),
  customerPhone: z.string().min(10),
  items: z.array(z.object({
    productId: z.string(),
    qty: z.coerce.number().int().min(1),
  })).min(1, "Add at least one item"),
  channel: z.enum(["walk-in", "instagram", "website", "meta-lead"]).default("walk-in"),
});

/* ---------- Sample catalogue DELETED (was: 8 fake products, 6 categories,
   4 invented suppliers, 3 fake orders, 3 fake stock movements) ----------
   Removed on request: it served no purpose and any of it reaching a screen would
   present invented stock and revenue as if it were JadePink's real data.

   Real data lives in Supabase: `products` + `product_variants` from the S J
   FASHIONS barcode export (npm run seed:sj), with `categories` and `suppliers`
   derived from the same file. Read it from there; do not reintroduce fixtures. */

/* ---------- Dashboard aggregates (pure, testable) ---------- */

export function revenueByDay(orders: Order[]) {
  const map = new Map<string, number>();
  orders.forEach((o) => {
    const d = new Date(o.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
    map.set(d, (map.get(d) || 0) + o.total);
  });
  return [...map.entries()].map(([day, revenue]) => ({ day, revenue }));
}
