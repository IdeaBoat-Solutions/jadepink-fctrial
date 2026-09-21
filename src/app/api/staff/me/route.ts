import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* GET /api/staff/me — current Supabase user + their staff_profiles row (role for gating UI) */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ user: null, profile: null });
    const { data: profile } = await supabase.from("staff_profiles").select("*").eq("id", user.id).single();
    return NextResponse.json({ user: { id: user.id, email: user.email }, profile });
  } catch (e) {
    return NextResponse.json({ user: null, profile: null, error: String(e) });
  }
}
