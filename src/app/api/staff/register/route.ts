import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhone } from "@/lib/phone";
import { FULL_NAME_ERROR, isFullName, normalizeName } from "@/lib/domain";

/* POST /api/staff/register — manager-only staff signup.
   Body: { name, email, password, role: "FC" | "STORE_MANAGER", storeId?, phone? }
   Creates the auth.users row (service-role) + staff_profiles row. */
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ code: "UNAUTHORIZED", message: "Sign in required" }, { status: 401 });

    const { data: caller } = await supabase
      .from("staff_profiles")
      .select("role, active, store_id")
      .eq("id", user.id)
      .single();
    if (!caller?.active || !["STORE_MANAGER", "ADMIN", "MANAGEMENT"].includes(caller.role)) {
      return NextResponse.json({ code: "FORBIDDEN", message: "Only managers can register staff" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const name = normalizeName(String(body.name ?? ""));
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const role = String(body.role ?? "FC");
    const phoneRaw = String(body.phone ?? "").trim();
    let phone: string | null = null;
    if (phoneRaw) {
      const norm = normalizePhone(phoneRaw);
      if (!/^[6-9]\d{9}$/.test(norm)) return NextResponse.json({ code: "INVALID", message: "Enter a valid 10-digit mobile number" }, { status: 422 });
      phone = norm;
    }
    if (!isFullName(name)) return NextResponse.json({ code: "INVALID", message: FULL_NAME_ERROR }, { status: 422 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ code: "INVALID", message: "Enter a valid email" }, { status: 422 });
    if (password.length < 8) return NextResponse.json({ code: "INVALID", message: "Password needs at least 8 characters" }, { status: 422 });
    if (!["FC", "STORE_MANAGER"].includes(role)) return NextResponse.json({ code: "INVALID", message: "Role must be FC or STORE_MANAGER" }, { status: 422 });

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ code: "NOT_CONFIGURED", message: "Supabase service key missing" }, { status: 500 });

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, role },
    });
    if (createErr) {
      const dup = /already|exists|duplicate/i.test(createErr.message);
      return NextResponse.json(
        { code: dup ? "ALREADY_EXISTS" : "CREATE_FAILED", message: dup ? "That email is already registered" : createErr.message },
        { status: dup ? 409 : 500 }
      );
    }

    const storeId = String(body.storeId ?? caller.store_id ?? "store-thaltej");
    const profileRow: Record<string, unknown> = { id: created.user.id, email, name, role, store_id: storeId, active: true };
    if (phone) profileRow.phone = phone;
    const { error: upErr } = await admin.from("staff_profiles").upsert(profileRow, { onConflict: "id" });
    if (upErr) return NextResponse.json({ code: "PROFILE_FAILED", message: upErr.message }, { status: 500 });

    // Best-effort: attach the mobile to the auth user so phone-based flows work later.
    // Non-fatal (a duplicate/unconfirmed phone must not break registration).
    if (phone) {
      try {
        await admin.auth.admin.updateUserById(created.user.id, { phone: `+91${phone}`, phone_confirm: true });
      } catch { /* ignore */ }
    }

    return NextResponse.json(
      { data: { id: created.user.id, email, name, role, storeId, phone } },
      { status: 201 }
    );
  } catch (e) {
    return NextResponse.json({ code: "INTERNAL", message: String(e) }, { status: 500 });
  }
}
