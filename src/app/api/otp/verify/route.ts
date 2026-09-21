import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { otpVerifySchema, throttle, toE164IN } from "@/lib/otp";

/* POST /api/otp/verify { channel, email?/phone?, token: "123456" }
   Verifies the Supabase-owned code; the server client persists the session
   in cookies, so the caller is signed in on success. */
export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = otpVerifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.flatten() }, { status: 400 });
  }
  const { channel, email, phone, token } = parsed.data;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const target = channel === "email" ? email?.toLowerCase() : phone;

  if (channel === "email" && !email) return NextResponse.json({ error: "email required" }, { status: 400 });
  let e164: string | null = null;
  if (channel === "phone") {
    e164 = phone ? toE164IN(phone) : null;
    if (!e164) return NextResponse.json({ error: "Valid 10-digit Indian mobile required" }, { status: 400 });
  }
  if (!target || !throttle(`otp-verify:${ip}:${target}`, 10)) {
    return NextResponse.json({ error: "Too many attempts. Request a fresh code." }, { status: 429 });
  }

  try {
    const supabase = await createClient();
    const { data, error } = channel === "email"
      ? await supabase.auth.verifyOtp({ email: email!, token, type: "email" })
      : await supabase.auth.verifyOtp({ phone: e164!, token, type: "sms" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, user: { id: data.user?.id, email: data.user?.email, phone: data.user?.phone } });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}
