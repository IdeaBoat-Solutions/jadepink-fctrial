import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* GET /api/staff/me — current Supabase user + their staff_profiles row (role for gating UI).
   Maps snake_case columns to the camelCase StaffProfile the client expects —
   returning the raw row leaves profile.storeId undefined and silently disables
   every store-scoped operation (walk-ins, floor loading). */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ user: null, profile: null });
    const { data: row } = await supabase.from("staff_profiles").select("id, name, role, store_id").eq("id", user.id).single();
    const profile = row
      ? { id: row.id, name: row.name, role: row.role, storeId: row.store_id }
      : null;
    return NextResponse.json({ user: { id: user.id, email: user.email }, profile });
  } catch (e) {
    return NextResponse.json({ user: null, profile: null, error: String(e) });
  }
}
