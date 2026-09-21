import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { toErrorPayload } from "@/lib/errors";
import { createWalkIn } from "@/features/visits/service";

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const storeId = String(body.storeId ?? auth.storeId ?? "");
    if (!storeId) return NextResponse.json({ code: "FORBIDDEN", message: "storeId required" }, { status: 403 });
    const data = await createWalkIn(auth, storeId);
    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    const err = toErrorPayload(e);
    return NextResponse.json({ code: err.code, message: err.message }, { status: err.status });
  }
}
