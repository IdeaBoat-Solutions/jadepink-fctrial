import { NextResponse } from "next/server";
import { listSuppliers } from "@/features/catalogue/repository";

/* GET /api/suppliers — real suppliers with active SKU counts derived from
   products.supplier_id. POST is deliberately NOT implemented: suppliers arrive
   from the S J FASHIONS export (npm run seed:sj), so hand-creating them here
   would fork the catalogue from its source of truth. */
export async function GET() {
  try {
    const data = await listSuppliers();
    return NextResponse.json({ source: "db", data });
  } catch (e) {
    return NextResponse.json({ source: "db", data: [], error: String(e) }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    { error: "Suppliers are imported from the client's export, not created here." },
    { status: 405 }
  );
}
