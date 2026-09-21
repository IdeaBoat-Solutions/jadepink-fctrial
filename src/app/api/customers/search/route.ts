import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { toErrorPayload } from "@/lib/errors";
import { searchCustomer } from "@/features/customers/service";

export async function GET(req: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const phone = searchParams.get("phone") ?? "";
    if (phone.trim().length < 3) return NextResponse.json({ data: null });
    const data = await searchCustomer(phone);
    return NextResponse.json({ data });
  } catch (e) {
    const err = toErrorPayload(e);
    return NextResponse.json({ code: err.code, message: err.message }, { status: err.status });
  }
}
