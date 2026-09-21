import { NextResponse } from "next/server";
import { listCategories } from "@/features/catalogue/repository";

/* GET /api/categories — real categories with a derived product count.
   Returns { source, data } (shape unchanged from when this served fixtures). */
export async function GET() {
  try {
    const data = await listCategories();
    return NextResponse.json({ source: "db", data });
  } catch (e) {
    return NextResponse.json({ source: "db", data: [], error: String(e) }, { status: 500 });
  }
}
