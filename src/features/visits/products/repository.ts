/* JadePink F.C. Trial — Stage 3 repository.
   The only place that talks to Supabase for products / visit_products /
   drop_reasons. Returns mapped domain rows; business rules live in ./service.ts.

   This module is the single source of truth for the Stage 3 data access API —
   service.ts imports exactly the names exported here. */

import { createClient } from "@/lib/supabase/server";
import type { DropReasonRow, ProductVariantRow, VisitProductRow } from "./types";

/* ---------- PostgREST embed selects ---------- */

const VARIANT_SELECT = "*, products(id, name, category_id, categories(name))";

const VISIT_PRODUCT_SELECT =
  "*, product_variants(*, products(id, name, category_id, categories(name))), drop_reasons(id, code, label, description, sort_order, is_active, created_at)";

/* ---------- Raw shapes (snake_case, as Postgres/PostgREST returns) ---------- */

interface RawProduct {
  id: string;
  name: string;
  category_id: string;
  categories?: { name: string } | { name: string }[] | null;
}

interface RawVariant {
  id: string;
  product_id: string;
  sku: string;
  barcode: string | null;
  size: string;
  colour: string;
  price: number | string;
  image_key: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  products?: RawProduct | RawProduct[] | null;
}

interface RawVisitProduct {
  id: string;
  visit_id: string;
  product_variant_id: string;
  status: VisitProductRow["status"];
  added_at: string;
  trial_started_at: string | null;
  trial_completed_at: string | null;
  liked_at: string | null;
  dropped_at: string | null;
  drop_reason_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  product_variants?: RawVariant | null;
  drop_reasons?: DropReasonRow | null;
}

/** PostgREST returns a to-one embed as either an object or a 1-element array. */
function first<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/* ---------- Mappers: DB row → domain ---------- */

export function mapVariant(row: RawVariant): ProductVariantRow {
  const product = first(row.products);
  const category = product ? first(product.categories) : null;
  return {
    id: row.id,
    product_id: row.product_id,
    sku: row.sku,
    barcode: row.barcode,
    size: row.size,
    colour: row.colour,
    price: Number(row.price) || 0,
    image_key: row.image_key,
    is_active: row.is_active,
    created_at: row.created_at,
    updated_at: row.updated_at,
    product_name: product?.name,
    product_category: category?.name,
  };
}

export function mapVisitProduct(row: RawVisitProduct): VisitProductRow {
  const variant = row.product_variants ? mapVariant(row.product_variants) : undefined;
  return {
    id: row.id,
    visit_id: row.visit_id,
    product_variant_id: row.product_variant_id,
    status: row.status,
    added_at: row.added_at,
    trial_started_at: row.trial_started_at,
    trial_completed_at: row.trial_completed_at,
    liked_at: row.liked_at,
    dropped_at: row.dropped_at,
    drop_reason_id: row.drop_reason_id,
    note: row.note,
    created_at: row.created_at,
    updated_at: row.updated_at,
    variant,
    product:
      variant && variant.product_name
        ? {
            id: variant.product_id,
            name: variant.product_name,
            category: variant.product_category ?? "",
            sku: variant.sku,
            size: variant.size,
            colour: variant.colour,
            price: variant.price,
            image_key: variant.image_key,
          }
        : undefined,
    drop_reason: row.drop_reasons ?? undefined,
  };
}

/* ---------- Product lookup (scan / search) ---------- */

function normalizeIdentifier(raw: string): string {
  return (raw ?? "").trim().replace(/\s+/g, "");
}

/** resolveProductVariant(identifier): barcode first, then SKU (§7, §20). */
export async function resolveVariantByIdentifier(
  identifier: string,
): Promise<ProductVariantRow | null> {
  const supabase = await createClient();
  const key = normalizeIdentifier(identifier);
  if (!key) return null;

  const byBarcode = await supabase
    .from("product_variants")
    .select(VARIANT_SELECT)
    .eq("barcode", key)
    .eq("is_active", true)
    .maybeSingle();
  if (byBarcode.data) return mapVariant(byBarcode.data as RawVariant);

  const bySku = await supabase
    .from("product_variants")
    .select(VARIANT_SELECT)
    .ilike("sku", key)
    .eq("is_active", true)
    .maybeSingle();
  if (bySku.data) return mapVariant(bySku.data as RawVariant);

  return null;
}

export async function getVariantById(id: string): Promise<ProductVariantRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("product_variants")
    .select(VARIANT_SELECT)
    .eq("id", id)
    .maybeSingle();
  return data ? mapVariant(data as RawVariant) : null;
}

/* ---------- Visit products ---------- */

export async function getVisitProductById(id: string): Promise<VisitProductRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("visit_products")
    .select(VISIT_PRODUCT_SELECT)
    .eq("id", id)
    .maybeSingle();
  return data ? mapVisitProduct(data as RawVisitProduct) : null;
}

export async function listVisitProducts(visitId: string): Promise<VisitProductRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("visit_products")
    .select(VISIT_PRODUCT_SELECT)
    .eq("visit_id", visitId)
    .order("added_at", { ascending: true });
  return ((data ?? []) as RawVisitProduct[]).map(mapVisitProduct);
}

/** Insert a visit_product. The DB unique(visit_id, product_variant_id) makes
    this race-safe / idempotent (§38). Throws the raw Supabase error (code
    23505) on conflict so the service can fall back to the existing row. */
export async function insertVisitProduct(
  visitId: string,
  productVariantId: string,
): Promise<{ id: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visit_products")
    .insert({ visit_id: visitId, product_variant_id: productVariantId, status: "SELECTED" })
    .select("id")
    .single();
  if (error) throw error;
  return data as { id: string };
}

/**
 * Conditional update: only succeeds while the row is still in `expectedStatus`.
 * Returns null when 0 rows matched (row gone OR a concurrent user changed it) —
 * the service turns that into PRODUCT_STATE_CHANGED (§37).
 */
export async function transitionVisitProduct(
  id: string,
  expectedStatus: VisitProductRow["status"],
  patch: Partial<VisitProductRow>,
): Promise<{ id: string } | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visit_products")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", expectedStatus)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return data ? (data as { id: string }) : null;
}

/** Unconditional field update (correcting a drop reason on a DROPPED row). */
export async function patchVisitProduct(id: string, patch: Partial<VisitProductRow>): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("visit_products")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteVisitProduct(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("visit_products").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- Drop reasons ---------- */

export async function listDropReasons(): Promise<DropReasonRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("drop_reasons")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []) as DropReasonRow[];
}

export async function getDropReasonById(id: string): Promise<DropReasonRow | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("drop_reasons").select("*").eq("id", id).maybeSingle();
  return (data as DropReasonRow | null) ?? null;
}

/* ---------- Customers (brief join for the visit summary) ---------- */

export async function getCustomerBrief(id: string): Promise<{ id: string; name: string } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("id, name").eq("id", id).maybeSingle();
  return (data as { id: string; name: string } | null) ?? null;
}

/* ---------- Visit events (§16, §17) ---------- */

export interface VisitEventInsert {
  visitId: string;
  eventType: string;
  actorId: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function insertVisitEvent(e: VisitEventInsert): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("visit_events").insert({
    visit_id: e.visitId,
    event_type: e.eventType,
    actor_id: e.actorId,
    entity_type: e.entityType ?? null,
    entity_id: e.entityId ?? null,
    metadata: e.metadata ?? {},
  });
  if (error) throw error;
}
