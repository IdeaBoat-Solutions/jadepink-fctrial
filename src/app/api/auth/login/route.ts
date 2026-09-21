import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { throttle } from "@/lib/otp";

/* POST /api/auth/login { email, password }
   Staff sign-in with EMAIL + password.

   Runs a normal email+password grant on the cookie-bound server client, so the
   session is persisted. Errors stay generic to avoid account enumeration. */

const schema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

const GENERIC = "Email or password is incorrect.";

export async function POST(req: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter your email and password." }, { status: 400 });
  }
  const email = parsed.data.email.trim().toLowerCase();
  const { password } = parsed.data;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!throttle(`login:${ip}:${email}`, 8)) {
    return NextResponse.json({ error: "Too many attempts. Try again in a few minutes." }, { status: 429 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return NextResponse.json({ error: GENERIC }, { status: 401 });

  return NextResponse.json({ ok: true, user: { id: data.user?.id, email: data.user?.email } });
}
