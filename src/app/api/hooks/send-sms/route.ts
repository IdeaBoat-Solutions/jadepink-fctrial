import { NextResponse } from "next/server";
import { renderOtpMessage, sendSmsViaFast2SMS, toE164IN, verifyWebhookSignature } from "@/lib/otp";

/* Supabase Auth "Send SMS" hook -> Fast2SMS Quick-SMS (free credit, no DLT).
   Dashboard > Authentication > Hooks > Send SMS hook points here.
   Supabase POSTs { user: { phone }, sms: { otp } } signed with Standard
   Webhooks headers; we deliver and answer empty-200 (any non-200 makes
   Supabase report the OTP send as failed). Secret format: v1,whsec_<base64>. */
export async function POST(req: Request) {
  const secret = (process.env.SEND_SMS_HOOK_SECRET || "").replace("v1,whsec_", "");
  const payload = await req.text();

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: { message: "SEND_SMS_HOOK_SECRET not set" } }, { status: 500 });
    }
    console.warn("[send-sms hook] SEND_SMS_HOOK_SECRET unset — skipping signature check (dev only)");
  } else {
    const ok = verifyWebhookSignature({
      payload,
      id: req.headers.get("webhook-id"),
      timestamp: req.headers.get("webhook-timestamp"),
      signature: req.headers.get("webhook-signature"),
      secret,
    });
    if (!ok) return NextResponse.json({ error: { message: "Bad webhook signature" } }, { status: 401 });
  }

  const body = JSON.parse(payload || "{}") as { user?: { phone?: string }; sms?: { otp?: string } };
  const phone = body?.user?.phone ? toE164IN(body.user.phone) : null;
  const otp = body?.sms?.otp;
  if (!phone || !otp) {
    return NextResponse.json({ error: { message: "Hook payload missing phone/otp" } }, { status: 400 });
  }

  // Dev without provider key: log so the flow stays testable, still 200.
  if (!process.env.FAST2SMS_API_KEY) {
    console.log(`[send-sms hook] DEV OTP for ${phone}: ${otp}`);
    return NextResponse.json({});
  }

  const sent = await sendSmsViaFast2SMS(phone, renderOtpMessage(otp));
  if (!sent.ok) {
    return NextResponse.json({ error: { message: `SMS provider failed: ${sent.detail}` } }, { status: 500 });
  }
  return NextResponse.json({});
}
