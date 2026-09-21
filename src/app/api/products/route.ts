import { NextResponse } from "next/server";
import { listProducts } from "@/features/catalogue/repository";
import { productSchema, type StockStatus } from "@/lib/inventory";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { parsePage, parsePageSize } from "@/lib/pagination";

const STOCK_VALUES: StockStatus[] = ["in-stock", "low-stock", "out-of-stock"];

/* GET /api/products?q=&category=&stock=&page=&pageSize=
   Real catalogue only, filtered in SQL: the client catalogue is ~900 rows and
   grows with every export, so it is never fetched whole. Search deliberately
   covers barcode / company_barcode / brand_name / design_no, because that is
   what the inventory search box claims to match. */
export async function GET(req: Request) {
  const empty = { source: "none", data: [], items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 };
  if (!isSupabaseConfigured()) return NextResponse.json(empty);

  const { searchParams } = new URL(req.url);
  const rawStock = searchParams.get("stock");
  const page = parsePage(searchParams.get("page"));

  try {
    const result = await listProducts({
      q: searchParams.get("q") ?? "",
      categoryId: searchParams.get("category") ?? "all",
      stockStatus: rawStock && (STOCK_VALUES as string[]).includes(rawStock) ? (rawStock as StockStatus) : undefined,
      page,
      pageSize: parsePageSize(searchParams.get("pageSize"), 20, 1000),
    });
    return NextResponse.json({ source: "db", data: result.items, ...result });
  } catch (e) {
    return NextResponse.json({ ...empty, error: String(e) }, { status: 500 });
  }
}

/* POST /api/products — manual SKU entry. Writes are manager-only under RLS; an FC
   calling this gets 403/PGRST403 rather than a silent no-op. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid product", issues: parsed.error.flatten() }, { status: 400 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const v = parsed.data;
  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("products")
    .insert({
      // products.id has no default, so mint one rather than deriving it from the
      // SKU (a re-import of the same style would then collide on the PK).
      id: crypto.randomUUID(),
      sku: v.sku,
      name: v.name,
      category_id: v.categoryId,
      price: v.price,
      mrp: v.mrp ?? v.price,
      cost: v.cost ?? 0,
      stock: v.stock,
      low_stock_at: v.lowStockAt ?? 5,
      supplier_id: v.supplierId || null,
      barcode: v.barcode || null,
      company_barcode: v.companyBarcode || null,
      brand_name: v.brandName || null,
      design_no: v.designNo || null,
      hsn_code: v.hsnCode || null,
      image_url: v.imageUrl || null,
      image_urls: v.imageUrls ?? [],
    })
    .select("*")
    .single();

  if (error) {
    const dup = /duplicate key|Unique constraint/i.test(error.message);
    return NextResponse.json(
      {
        code: dup ? "DUPLICATE" : "DB_WRITE_FAILED",
        error: dup ? "That SKU, barcode or company barcode already exists" : error.message,
      },
      { status: dup ? 409 : 500 }
    );
  }
  return NextResponse.json({ source: "db", data: created }, { status: 201 });
}
