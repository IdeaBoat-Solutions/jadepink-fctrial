/* Catalogue data access (products, variants, categories, suppliers, orders,
   stock movements). Replaces the deleted SEED_* fixtures so the (admin) screens
   show JadePink's real data from Supabase.

   Conventions mirrored from src/features/visits/repository.ts:
   - session-scoped client (RLS enforced), never service-role for reads
   - snake_case row types + explicit row -> camelCase DTO mappers
   - undefined on not-found instead of throwing, so routes can 404 cleanly

   NOTE: SJ-imported products keep size/colour on the product row itself and have
   exactly one product_variant each, so `sizes`/`colors` are derived from the
   variant table when present and fall back to the product's own columns. */

import { createClient } from "@/lib/supabase/server";
import type {
  Category,
  Order,
  OrderItem,
  Product,
  ProductVariant,
  StockMovement,
  Supplier,
} from "@/lib/inventory";

/* ---------- Row shapes ---------- */

export interface ProductRow {
  id: string;
  sku: string;
  name: string;
  category_id: string;
  price: number;
  mrp: number | null;
  cost: number;
  stock: number;
  low_stock_at: number;
  sizes: string | null;
  colors: string | null;
  supplier_id: string | null;
  image_url: string | null;
  image_urls: string[] | null;
  barcode: string | null;
  company_barcode: string | null;
  branch_name: string | null;
  department: string | null;
  brand_name: string | null;
  design_no: string | null;
  hsn_code: string | null;
  party_name: string | null;
  size: string | null;
  color: string | null;
  sales_rate: number | null;
  updated_at: string;
  created_at: string;
}

/* Literal (as const) on purpose: Supabase's select parser needs a literal string
   type — a plain `string` turns the query result into a ParserError. */
const PRODUCT_SELECT =
  "id, sku, name, category_id, price, mrp, cost, stock, low_stock_at, sizes, colors, supplier_id, image_url, image_urls, barcode, company_barcode, branch_name, department, brand_name, design_no, hsn_code, party_name, size, color, sales_rate, updated_at, created_at" as const;

/** Join targets are attached by PostgREST as nested objects, not columns. */
type Joined<T> = T & {
  categories?: { id: string; name: string } | null;
  suppliers?: { id: string; name: string } | null;
};

const csv = (s: string | null | undefined, fallback: string | null = null): string[] => {
  const v = (s ?? "").trim();
  if (!v) return fallback ? [fallback] : [];
  return v.split(",").map((x) => x.trim()).filter(Boolean);
};

export function mapProduct(row: Joined<ProductRow>): Product {
  // Prefer the product's own size/colour columns (one SJ row = one sellable item),
  // then the legacy comma-separated lists.
  const sizes = row.size ? [row.size] : csv(row.sizes);
  const colors = row.color ? [row.color] : csv(row.colors);
  const urls = (row.image_urls ?? []).filter(Boolean);

  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    categoryId: row.category_id,
    categoryName: row.categories?.name ?? row.department ?? "",
    price: Number(row.price ?? 0),
    mrp: Number(row.mrp ?? row.price ?? 0),
    cost: Number(row.cost ?? 0),
    stock: Number(row.stock ?? 0),
    lowStockAt: Number(row.low_stock_at ?? 0),
    sizes,
    colors,
    supplierId: row.supplier_id ?? "",
    supplierName: row.suppliers?.name ?? row.party_name ?? "",
    image: urls[0] ?? row.image_url ?? undefined,
    imageUrl: row.image_url,
    imageUrls: urls,
    barcode: row.barcode,
    companyBarcode: row.company_barcode,
    branchName: row.branch_name,
    department: row.department,
    brandName: row.brand_name,
    designNo: row.design_no,
    hsnCode: row.hsn_code,
    partyName: row.party_name,
    size: row.size,
    color: row.color,
    salesRate: row.sales_rate == null ? null : Number(row.sales_rate),
    updatedAt: row.updated_at ?? row.created_at,
  };
}

/* ---------- Products ---------- */

export type ProductSort = "newest" | "price-asc" | "price-desc" | "stock-desc" | "name";

export interface ProductFilters {
  q?: string;
  categoryId?: string;
  stockStatus?: "in-stock" | "low-stock" | "out-of-stock";
  supplierId?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
}

/**
 * Server-side filter + paging. The 1000 ceiling lets the admin list load the
 * whole catalogue (~900 rows today) and still filter instantly in the browser,
 * while refusing a truly unbounded query. Requested sizes above it are clamped.
 */
export async function listProducts(f: ProductFilters = {}) {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(1000, Math.max(1, f.pageSize ?? 20));
  const q = (f.q ?? "").trim();

  const supabase = await createClient();
  let query = supabase
    .from("products")
    .select(`${PRODUCT_SELECT}, categories(id, name), suppliers(id, name)`, { count: "exact" });

  if (f.categoryId && f.categoryId !== "all") query = query.eq("category_id", f.categoryId);
  if (f.supplierId && f.supplierId !== "all") query = query.eq("supplier_id", f.supplierId);
  if (f.brand && f.brand !== "all") query = query.eq("brand_name", f.brand);
  if (typeof f.minPrice === "number" && Number.isFinite(f.minPrice)) query = query.gte("price", Math.max(0, f.minPrice));
  if (typeof f.maxPrice === "number" && Number.isFinite(f.maxPrice)) query = query.lte("price", Math.max(0, f.maxPrice));
  if (f.stockStatus === "out-of-stock") query = query.lte("stock", 0);
  else if (f.stockStatus === "low-stock") query = query.gt("stock", 0).lte("stock", 5);
  else if (f.stockStatus === "in-stock") query = query.gt("stock", 5);

  if (q) {
    const safe = q.replace(/[,%()]/g, "");
    query = query.or(
      `name.ilike.%${safe}%,sku.ilike.%${safe}%,barcode.ilike.%${safe}%` +
        `%,company_barcode.ilike.%${safe}%,brand_name.ilike.%${safe}%,design_no.ilike.%${safe}%` +
        `%,party_name.ilike.%${safe}%`
    );
  }

  const from = (page - 1) * pageSize;
  const order = f.sort ?? "newest";
  const ordered =
    order === "price-asc" ? query.order("price", { ascending: true })
    : order === "price-desc" ? query.order("price", { ascending: false })
    : order === "stock-desc" ? query.order("stock", { ascending: false })
    : order === "name" ? query.order("name", { ascending: true })
    : query.order("updated_at", { ascending: false });
  const { data, error, count } = await ordered.range(from, from + pageSize - 1);

  if (error) throw new Error(error.message);
  const items = (data ?? []).map((r) => mapProduct(r as unknown as Joined<ProductRow>));
  const total = count ?? items.length;
  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), start: total === 0 ? 0 : from + 1, end: Math.min(total, from + pageSize) };
}

export async function getProduct(id: string): Promise<Product | undefined> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("products")
    .select(`${PRODUCT_SELECT}, categories(id, name), suppliers(id, name)`)
    .eq("id", id)
    .maybeSingle();
  return data ? mapProduct(data as unknown as Joined<ProductRow>) : undefined;
}

interface ProductVariantRow {
  id: string;
  product_id: string;
  sku: string;
  barcode: string | null;
  size: string;
  colour: string;
  price: number | string;
  image_key: string | null;
  is_active: boolean;
}

function mapVariant(row: ProductVariantRow): ProductVariant {
  return {
    id: row.id,
    productId: row.product_id,
    sku: row.sku,
    barcode: row.barcode,
    size: row.size,
    colour: row.colour,
    price: Number(row.price ?? 0),
    imageKey: row.image_key,
    isActive: row.is_active,
  };
}

/** All sellable variants for a product, ordered for stable staff-facing tables. */
export async function listProductVariants(productId: string): Promise<ProductVariant[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("product_variants")
    .select("id, product_id, sku, barcode, size, colour, price, image_key, is_active")
    .eq("product_id", productId)
    .order("is_active", { ascending: false })
    .order("size", { ascending: true })
    .order("colour", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapVariant(row as ProductVariantRow));
}

/* ---------- Categories + suppliers (counts derived, never stored) ---------- */

export async function listCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const [{ data: cats }, { data: counts }] = await Promise.all([
    supabase.from("categories").select("id, name, slug").order("name"),
    supabase.from("products").select("category_id"),
  ]);
  const byId = new Map<string, number>();
  for (const r of counts ?? []) {
    const k = (r as { category_id: string }).category_id;
    byId.set(k, (byId.get(k) ?? 0) + 1);
  }
  return (cats ?? []).map((c) => ({
    id: c.id as string,
    name: c.name as string,
    slug: (c.slug as string) ?? "",
    productCount: byId.get(c.id as string) ?? 0,
  }));
}

export async function listSuppliers(): Promise<Supplier[]> {
  const supabase = await createClient();
  const [{ data: sups }, { data: counts }] = await Promise.all([
    supabase.from("suppliers").select("id, name, contact, phone, email, city, rating").order("name"),
    supabase.from("products").select("supplier_id"),
  ]);
  const byId = new Map<string, number>();
  for (const r of counts ?? []) {
    const k = (r as { supplier_id: string | null }).supplier_id;
    if (k) byId.set(k, (byId.get(k) ?? 0) + 1);
  }
  return (sups ?? []).map((s) => ({
    id: s.id as string,
    name: (s.name as string) ?? "",
    contact: (s.contact as string) ?? "",
    phone: (s.phone as string) ?? "",
    email: (s.email as string) ?? "",
    city: (s.city as string) ?? "",
    activeProducts: byId.get(s.id as string) ?? 0,
    rating: Number(s.rating ?? 0),
  }));
}

/* Distinct brand names for the filter dropdown — one narrow column, not rows. */
export async function listBrands(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("brand_name").not("brand_name", "is", null).limit(1000);
  if (error) throw new Error(error.message);
  const set = new Set<string>();
  for (const r of data ?? []) {
    const b = ((r as { brand_name: string | null }).brand_name ?? "").trim();
    if (b) set.add(b);
  }
  return [...set].sort((a, b) => a.localeCompare(b, "en-IN"));
}

/* ---------- Orders ---------- */

interface OrderRow {
  id: string;
  code: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  status: string;
  channel: string;
  fc_name: string | null;
  created_at: string;
  order_items?: { product_id: string; product_name: string; qty: number; price: number }[];
}

export function mapOrder(row: OrderRow): Order {
  const items: OrderItem[] = (row.order_items ?? []).map((i) => ({
    productId: i.product_id,
    productName: i.product_name,
    qty: Number(i.qty),
    price: Number(i.price),
  }));
  return {
    id: row.id,
    code: row.code,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    items,
    // Recomputed rather than trusted: order_items are the line-level truth.
    total: items.length ? items.reduce((s, i) => s + i.price * i.qty, 0) : Number(row.total ?? 0),
    status: (["pending", "confirmed", "shipped", "delivered", "cancelled"].includes(row.status)
      ? row.status
      : "pending") as Order["status"],
    channel: (["walk-in", "instagram", "website", "meta-lead"].includes(row.channel)
      ? row.channel
      : "walk-in") as Order["channel"],
    fcName: row.fc_name ?? undefined,
    createdAt: row.created_at,
  };
}

export async function listOrders(opts: { page?: number; pageSize?: number; status?: string } = {}) {
  const supabase = await createClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(1000, Math.max(1, opts.pageSize ?? 20));
  let query = supabase
    .from("orders")
    .select("*, order_items(product_id, product_name, qty, price)", { count: "exact" });
  if (opts.status && opts.status !== "all") query = query.eq("status", opts.status);
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw new Error(error.message);
  const items = (data ?? []).map((r) => mapOrder(r as unknown as OrderRow));
  const total = count ?? items.length;
  return { items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)), start: total === 0 ? 0 : from + 1, end: Math.min(total, from + pageSize) };
}

/* Recent orders for honest "today / last 7 days" sales math. Narrow column set,
   capped rows — the browser aggregates, it never ships the whole ledger. */
export async function listOrdersSince(sinceISO: string, limit = 500) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("total, status, fc_name, created_at")
    .gte("created_at", sinceISO)
    .order("created_at", { ascending: false })
    .limit(Math.min(1000, Math.max(1, limit)));
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    total: Number((r as { total: number }).total ?? 0),
    status: String((r as { status: string }).status ?? "pending"),
    fcName: ((r as { fc_name: string | null }).fc_name ?? "").trim() || null,
    createdAt: String((r as { created_at: string }).created_at),
  }));
}

/* ---------- Recent billed items ----------
   Flat line-item feed for Reports: the newest order_items with their order
   attached (bill code, customer, FC, channel, date). Bounded, newest first. */

export interface BilledItem {
  orderId: string;
  orderCode: string;
  productName: string;
  qty: number;
  price: number;
  customerName: string;
  channel: string;
  fcName?: string;
  orderedAt: string;
}

export async function listRecentBilledItems(limit = 20): Promise<BilledItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_items")
    .select("qty, price, product_name, orders!inner(id, code, customer_name, channel, fc_name, created_at, status)")
    .neq("orders.status", "cancelled")
    .order("id", { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)));
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((r) => {
      const o = (r as unknown as { qty: number; price: number; product_name: string; orders: { id: string; code: string; customer_name: string; channel: string; fc_name: string | null; created_at: string } | null }).orders;
      if (!o?.id) return null;
      return {
        orderId: o.id,
        orderCode: o.code ?? "—",
        productName: (r as { product_name: string }).product_name ?? "—",
        qty: Number((r as { qty: number }).qty ?? 0),
        price: Number((r as { price: number }).price ?? 0),
        customerName: o.customer_name ?? "Walk-in customer",
        channel: o.channel ?? "walk-in",
        fcName: o.fc_name ?? undefined,
        orderedAt: o.created_at ?? "",
      } as BilledItem;
    })
    .filter((i): i is BilledItem => !!i);
}

/* ---------- Stock movements ---------- */

export async function listMovements(productId?: string): Promise<StockMovement[]> {
  const supabase = await createClient();
  let query = supabase
    .from("stock_movements")
    .select("id, product_id, product_name, type, qty, reason, actor, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (productId) query = query.eq("product_id", productId);
  const { data } = await query;
  return (data ?? []).map((m) => ({
    id: m.id as string,
    productId: m.product_id as string,
    productName: m.product_name as string,
    type: m.type as StockMovement["type"],
    qty: Number(m.qty),
    reason: (m.reason as string) ?? "",
    at: m.created_at as string,
    actor: (m.actor as string) ?? "system",
  }));
}

/* ---------- Purchases for one product ----------
   Detail list of the users who purchased this item: every order_items row for
   the product, joined to its order for customer / date / channel. Bounded to
   the 50 most recent so a bestseller never fans out to an unbounded query. */

export interface ProductPurchase {
  orderId: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  qty: number;
  price: number;
  channel: string;
  fcName?: string;
  orderedAt: string;
}

export async function listPurchasesForProduct(productId: string, limit = 50): Promise<{ items: ProductPurchase[]; totalQty: number; totalRevenue: number }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("order_items")
    .select("qty, price, orders!inner(id, code, customer_name, customer_phone, channel, fc_name, created_at, status)")
    .eq("product_id", productId)
    .neq("orders.status", "cancelled")
    .order("id", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const items: ProductPurchase[] = (data ?? []).map((r) => {
    const o = (r as unknown as { qty: number; price: number; orders: { id: string; code: string; customer_name: string; customer_phone: string; channel: string; fc_name: string | null; created_at: string } | null }).orders;
    return {
      orderId: o?.id ?? "",
      orderCode: o?.code ?? "—",
      customerName: o?.customer_name ?? "Walk-in customer",
      customerPhone: o?.customer_phone ?? "",
      qty: Number((r as { qty: number }).qty ?? 0),
      price: Number((r as { price: number }).price ?? 0),
      channel: o?.channel ?? "walk-in",
      fcName: o?.fc_name ?? undefined,
      orderedAt: o?.created_at ?? "",
    };
  }).filter((i) => i.orderId);
  // Most recent first when the join carries a timestamp.
  items.sort((a, b) => (b.orderedAt || "").localeCompare(a.orderedAt || ""));
  return {
    items,
    totalQty: items.reduce((s, i) => s + i.qty, 0),
    totalRevenue: items.reduce((s, i) => s + i.qty * i.price, 0),
  };
}

/* ---------- Dashboard aggregate ---------- */

/**
 * Stock totals pushed down to Postgres instead of pulling ~900 fully-mapped
 * products to sum them. Low/out counts need the row-level comparison against
 * product.low_stock_at, which no single aggregate can express, so this reads two
 * narrow numeric columns and folds them here.
 */
export interface StockSummary {
  units: number;
  value: number;
  low: number;
  out: number;
  skus: number;
  /** Products at or below their own threshold, worst first. */
  attention: Array<Pick<Product, "id" | "sku" | "name" | "stock" | "lowStockAt">>;
}

export async function getStockSummary(attentionLimit = 8): Promise<StockSummary> {
  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("products")
    .select("id, sku, name, stock, low_stock_at, cost");
  if (error) throw new Error(error.message);

  let units = 0;
  let value = 0;
  let low = 0;
  let out = 0;
  const attention: StockSummary["attention"] = [];

  for (const p of data ?? []) {
    const row = p as unknown as { id: string; sku: string; name: string; stock: number; low_stock_at: number; cost: number };
    const stock = Number(row.stock ?? 0);
    const threshold = Number(row.low_stock_at ?? 0);
    units += stock;
    value += stock * Number(row.cost ?? 0);
    if (stock <= 0) out += 1;
    else if (stock <= threshold) low += 1;
    if (stock <= threshold) {
      attention.push({ id: row.id, sku: row.sku, name: row.name, stock, lowStockAt: threshold });
    }
  }

  // Fewest units left first: the item most likely to be missed is the one at zero.
  attention.sort((a, b) => a.stock - b.stock);

  return { units, value, low, out, skus: count ?? (data?.length ?? 0), attention: attention.slice(0, attentionLimit) };
}
