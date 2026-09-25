import { NextResponse } from "next/server";
import { getProduct, listMovements, listProductVariants } from "@/features/catalogue/repository";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/* GET /api/products/[id] — one product plus its stock ledger, in one round trip
   so the detail screen does not fan out to N endpoints. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  const { id } = await ctx.params;

  try {
    const product = await getProduct(id);
    if (!product) return NextResponse.json({ code: "PRODUCT_NOT_FOUND", error: "No such product" }, { status: 404 });
    const [movements, variants] = await Promise.all([
      listMovements(product.id),
      listProductVariants(product.id).catch(() => []),
    ]);
    return NextResponse.json({ source: "db", data: { product, movements, variants } });
  } catch (e) {
    return NextResponse.json({ code: "INTERNAL", error: String(e) }, { status: 500 });
  }
}
