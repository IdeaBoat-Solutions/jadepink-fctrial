import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/* GET /api/barcode?code=01260901576 — exact scan lookup for SJ live records.
   Matches barcode first, then company_barcode / sku.
   No fixture fallback: an unscannable code must answer "not found", never a
   invented product from sample data. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") || "").trim();
  if (!code) return NextResponse.json({ error: "Missing ?code=" }, { status: 400 });
  if (!isSupabaseConfigured()) return NextResponse.json({ source: "none", data: [] });

  const supabase = await createClient();
  try {
    const { data: rows, error } = await supabase
      .from("products")
      .select("*, categories(id, name), suppliers(id, name)")
      .or(`barcode.eq.${code},company_barcode.eq.${code},sku.eq.${code}`)
      .limit(5);
    if (error) return NextResponse.json({ source: "db", data: [], error: error.message }, { status: 500 });
    return NextResponse.json({ source: "db", data: rows ?? [] });
  } catch (e) {
    return NextResponse.json({ source: "db", data: [], error: String(e) }, { status: 500 });
  }
}
