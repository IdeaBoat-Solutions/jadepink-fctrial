/* Supabase-routed OTP — shared helpers for /api/otp/* and /api/hooks/send-sms.
   Supabase Auth owns code generation + verification (free on all plans).
   Delivery: email is native/free; SMS is delivered by our Send-SMS hook
   endpoint via Fast2SMS (free test credit, Quick-SMS route needs no DLT). */

import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";
import { isValidPhoneIN, normalizePhone } from "@/lib/phone";

/** 10-digit IN mobile -> "+91XXXXXXXXXX", else null. */
export function toE164IN(raw: string): string | null {
  if (!isValidPhoneIN(raw)) return null;
  return `+91${normalizePhone(raw)}`;
}

export const otpSendSchema = z.object({
  channel: z.enum(["email", "phone"]),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export const otpVerifySchema = z.object({
  channel: z.enum(["email", "phone"]),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  token: z.string().regex(/^\d{6}$/, "6-digit code required"),
});

/* ---------- minimal in-memory throttle (per target + IP, 10-min window) ---------- */
const buckets = new Map<string, number[]>();
export function throttle(key: string, limit = 5, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) return false;
  hits.push(now);
  buckets.set(key, hits);
  return true;
}

/* ---------- Standard Webhooks signature check (Supabase Auth hooks) ---------- */
export function verifyWebhookSignature(args: {
  payload: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  secret: string; // already stripped of "v1,whsec_" prefix
  toleranceSec?: number;
}): boolean {
  const { payload, id, timestamp, signature, secret, toleranceSec = 300 } = args;
  if (!id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > toleranceSec) return false;
  let key: Buffer;
  try {
    key = Buffer.from(secret, "base64");
  } catch {
    return false;
  }
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${payload}`, "utf8").digest();
  // Header may carry several space-separated "v1,<sig>" entries.
  return signature.split(" ").some((entry) => {
    const sig = entry.startsWith("v1,") ? entry.slice(3) : entry;
    let got: Buffer;
    try {
      got = Buffer.from(sig, "base64");
    } catch {
      return false;
    }
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

export function renderOtpMessage(otp: string): string {
  const tpl = process.env.OTP_SMS_TEMPLATE || "Your JadePink OTP is {otp}. Valid for 5 minutes.";
  return tpl.replace("{otp}", otp);
}

/* ---------- Fast2SMS Quick-SMS (route=q — no DLT needed, spends free credit) ---------- */
export async function sendSmsViaFast2SMS(to: string, message: string): Promise<{ ok: boolean; detail: string }> {
  const key = process.env.FAST2SMS_API_KEY;
  if (!key) return { ok: false, detail: "FAST2SMS_API_KEY not set" };
  const digits = to.replace(/\D/g, "").slice(-10);
  const url =
    `https://www.fast2sms.com/dev/bulkV2?authorization=${encodeURIComponent(key)}` +
    `&route=q&flash=0&numbers=${encodeURIComponent(digits)}&message=${encodeURIComponent(message)}`;
  const res = await fetch(url, { method: "GET" });
  const body = await res.json().catch(() => ({}));
  if (res.ok && body?.return === true) return { ok: true, detail: "queued" };
  return { ok: false, detail: String(body?.message ?? `HTTP ${res.status}`).slice(0, 200) };
}
