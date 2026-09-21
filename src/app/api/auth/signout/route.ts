import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* POST /api/auth/signout — clears the Supabase auth cookies server-side. */
export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.json({ data: { ok: true } });
}
