import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/authz";
import { toErrorPayload } from "@/lib/errors";
import { createCustomerSchema } from "@/features/customers/schemas";
import { createCustomer } from "@/features/customers/service";

export async function POST(req: Request) {
  try {
    const auth = await requireAuth();
    const body = await req.json().catch(() => ({}));
    const parsed = createCustomerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ code: "INVALID_PHONE", message: "Invalid input", issues: parsed.error.flatten() }, { status: 422 });
    }
    const data = await createCustomer(auth, parsed.data);
    return NextResponse.json({ data }, { status: 201 });
  } catch (e) {
    const err = toErrorPayload(e);
    return NextResponse.json({ code: err.code, message: err.message }, { status: err.status });
  }
}
