import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { toErrorPayload } from "@/lib/errors";
import { searchCustomer, searchCustomersByName } from "@/features/customers/service";

export async function GET(req: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    /* ?phone= → single record or null (the unique key, used at attach time).
       ?name= → every close match (used to tell same-named people apart). */
    const name = searchParams.get("name") ?? "";
    if (name.trim()) {
      const data = await searchCustomersByName(name);
      return NextResponse.json({ data });
    }
    const phone = searchParams.get("phone") ?? "";
    if (phone.trim().length < 3) return NextResponse.json({ data: null });
    const data = await searchCustomer(phone);
    return NextResponse.json({ data });
  } catch (e) {
    const err = toErrorPayload(e);
    return NextResponse.json({ code: err.code, message: err.message }, { status: err.status });
  }
}
