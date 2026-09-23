import { NextResponse } from "next/server";
import { listBrands } from "@/features/catalogue/repository";

/* GET /api/brands — distinct brand names for the products filter dropdown. */
export async function GET() {
  try {
    const data = await listBrands();
    return NextResponse.json({ source: "db", data });
  } catch (e) {
    return NextResponse.json({ source: "db", data: [], error: String(e) }, { status: 500 });
  }
}
