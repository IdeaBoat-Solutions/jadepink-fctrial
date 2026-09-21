import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { otpSendSchema, throttle, toE164IN } from "@/lib/otp";

/* POST /api/otp/send { channel: "email"|"phone", email?, phone? }
   Supabase Auth generates + owns the code (free). Email delivers natively;
   phone delivers via the Send-SMS hook (/api/hooks/send-sms -> Fast2SMS). */
export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = otpSendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request", issues: parsed.error.flatten() }, { status: 400 });
  }
  const { channel, email, phone } = parsed.data;
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const target = channel === "email" ? email?.toLowerCase() : phone;

  if (channel === "email" && !email) return NextResponse.json({ error: "email required" }, { status: 400 });
  let e164: string | null = null;
  if (channel === "phone") {
    e164 = phone ? toE164IN(phone) : null;
    if (!e164) return NextResponse.json({ error: "Valid 10-digit Indian mobile required" }, { status: 400 });
  }
  if (!target || !throttle(`otp-send:${ip}:${target}`)) {
    return NextResponse.json({ error: "Too many codes requested. Try again in 10 minutes." }, { status: 429 });
  }

  try {
    const supabase = await createClient();
    const { error } = channel === "email"
      ? await supabase.auth.signInWithOtp({ email: email! })
      : await supabase.auth.signInWithOtp({ phone: e164! });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, channel, ...(e164 ? { phone: e164 } : {}) });
  } catch (e) {
    return NextResponse.json({ error: String(e).slice(0, 200) }, { status: 500 });
  }
}
