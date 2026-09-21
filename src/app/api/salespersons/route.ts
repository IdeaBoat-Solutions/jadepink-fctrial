import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { toErrorPayload } from "@/lib/errors";
import { getAvailableSalespersons } from "@/features/assignments/service";

export async function GET(req: Request) {
  try {
    const auth = await requireAuth();
    const { searchParams } = new URL(req.url);
    const storeId = searchParams.get("storeId") ?? auth.storeId ?? "";
    if (!storeId) return NextResponse.json({ code: "FORBIDDEN", message: "storeId required" }, { status: 403 });
    const data = await getAvailableSalespersons(auth, storeId);
    return NextResponse.json({ data });
  } catch (e) {
    const err = toErrorPayload(e);
    return NextResponse.json({ code: err.code, message: err.message }, { status: err.status });
  }
}
