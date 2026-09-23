"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { PrimaryButton, TextInput, Field } from "@/components/ui";
import { cn } from "@/lib/utils";

const SUPABASE_CONFIGURED =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type Method = "password" | "otp";

function storeRole(role?: string): "fc" | "manager" {
  return role === "STORE_MANAGER" || role === "ADMIN" || role === "MANAGEMENT" ? "manager" : "fc";
}

export default function LoginPage() {
  const { signIn, user } = useStore();
  const router = useRouter();

  const [method, setMethod] = useState<Method>("password");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Email + password
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // OTP
  const [mobile, setMobile] = useState("");
  const [step, setStep] = useState<"mobile" | "code">("mobile");
  const [code, setCode] = useState("");

  /* Managers own the store (dashboard); salespeople own their customers (today).
     Same rule as src/lib/policy.ts. */
  const landingFor = (r: "fc" | "manager") => (r === "manager" || r === "fc" ? "/today" : "/today");

  useEffect(() => {
    if (user) router.replace(landingFor(user.role));
  }, [user, router]);

  if (user) {
    return null;
  }

  const normMobile = () => {
    const digits = (mobile || "").replace(/\D/g, "");
    return digits.length > 10 ? digits.slice(-10) : digits;
  };

  /** Load the profile and enter the app with the StoreProvider contract. */
  const finishSignIn = async (fallbackName: string) => {
    const me = await fetch("/api/staff/me").then((r) => r.json()).catch(() => null);
    const name: string = me?.profile?.name || fallbackName;
    const role = storeRole(me?.profile?.role);
    signIn(name, role);
    router.push(landingFor(role));
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error || "Email or password is incorrect.");
        return;
      }
      await finishSignIn(email.trim());
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const norm = normMobile();
    if (!/^[6-9]\d{9}$/.test(norm)) {
      setError("Enter a valid 10-digit mobile number (Indian number).");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "phone", phone: norm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error || "Could not send the code. Try again."); return; }
      setStep("code");
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(code.trim())) { setError("Enter the 6-digit code sent to your mobile."); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "phone", phone: normMobile(), token: code.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error || "Wrong code. Check and try again."); return; }
      await finishSignIn(normMobile());
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="floor-os grid min-h-dvh lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.1fr)]">
      <aside className="hidden flex-col justify-between border-r border-[var(--fp-line)] px-10 py-8 lg:flex">
        <p className="text-[12px] font-semibold tracking-[0.16em]">JADEPINK · AHMEDABAD</p>
        <div>
          <p className="fp-name text-[40px] leading-[1.05]">The floor is open.</p>
          <p className="mt-3 max-w-[28ch] text-[15px] leading-relaxed text-[var(--fp-muted)]">
            Sign in, find the customer, and stay on the same visit until billing.
          </p>
        </div>
        <Link href="/" className="text-[13px] font-semibold text-[var(--fp-muted)]">jadepink.com</Link>
      </aside>

      <main className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <p className="text-[12px] font-semibold tracking-[0.16em] text-[var(--fp-muted)] lg:hidden">JADEPINK</p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-[14px] text-[var(--fp-muted)]">Sales floor and store management</p>

          {SUPABASE_CONFIGURED ? (
            <>
              <div role="group" aria-label="Sign-in method" className="mt-5 grid grid-cols-2 gap-1 rounded-lg bg-[#f3eeea] p-1">
                {(["password", "otp"] as const).map((m) => (
                  <button
                    key={m} type="button" aria-pressed={method === m}
                    onClick={() => { setMethod(m); setError(""); }}
                    className={cn(
                      "min-h-[44px] rounded-md text-[13.5px] font-semibold transition-colors",
                      method === m ? "bg-white text-[#1c1917] shadow-sm" : "text-[#57534e] hover:text-[#1c1917]"
                    )}
                  >
                    {m === "password" ? "Email + password" : "OTP code"}
                  </button>
                ))}
              </div>

              {error && (
                <p role="alert" className="ui-fade mt-3 rounded-lg border border-[#f0b6b9] bg-[#fdecec] px-3 py-2.5 text-[13.5px] font-medium text-[#7d1a1f]">
                  {error}
                </p>
              )}

              {method === "password" ? (
                <form onSubmit={submitPassword} className="mt-4 flex flex-col gap-4" aria-label="Sign in with email and password">
                  <Field label="Staff email" htmlFor="login-email" hint="Use the email your manager registered.">
                    <TextInput
                      id="login-email" type="email" autoComplete="username" placeholder="name@jadepink.in"
                      value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} aria-invalid={!!error}
                      autoFocus
                    />
                  </Field>
                  <Field label="Password" htmlFor="login-password">
                    <div className="relative">
                      <TextInput
                        id="login-password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="••••••••"
                        value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} aria-invalid={!!error}
                        className="pr-16"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-pressed={showPassword}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="absolute top-1/2 right-2 flex min-h-[44px] -translate-y-1/2 items-center rounded-lg px-2.5 text-[13px] font-semibold text-[#78716c] transition-colors hover:bg-[#f3eeea] hover:text-[#1c1917] active:scale-95"
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                  </Field>
                  <PrimaryButton type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in →"}</PrimaryButton>
                </form>
              ) : step === "mobile" ? (
                <form onSubmit={sendOtp} className="mt-4 flex flex-col gap-4" aria-label="Request one-time code">
                  <Field label="Mobile number" htmlFor="login-mobile" hint="10-digit Indian mobile. We'll text you a 6-digit code — no password needed.">
                    <TextInput id="login-mobile" autoComplete="tel" inputMode="tel" placeholder="+91 · 98765 43210" value={mobile} onChange={(e) => { setMobile(e.target.value); setError(""); }} aria-invalid={!!error} autoFocus />
                  </Field>
                  <PrimaryButton type="submit" disabled={busy}>{busy ? "Sending code…" : "Send code →"}</PrimaryButton>
                </form>
              ) : (
                <form onSubmit={verifyCode} className="mt-4 flex flex-col gap-4" aria-label="Enter one-time code">
                  <Field label="6-digit code" htmlFor="login-code" hint={`Sent to +91 ${normMobile()}. Valid for a few minutes.`}>
                    <TextInput id="login-code" autoComplete="one-time-code" inputMode="numeric" maxLength={6} placeholder="••••••" value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }} aria-invalid={!!error} autoFocus />
                  </Field>
                  <PrimaryButton type="submit" disabled={busy}>{busy ? "Verifying…" : "Verify & sign in →"}</PrimaryButton>
                  <div className="flex items-center justify-between gap-2 text-[13px]">
                    <button type="button" onClick={() => { setStep("mobile"); setCode(""); setError(""); }} className="flex min-h-[44px] items-center font-semibold text-[var(--staff-brand)] hover:underline">
                      ← Use a different number
                    </button>
                    <button type="button" onClick={sendOtp} disabled={busy} className="flex min-h-[44px] items-center font-semibold text-[#57534e] hover:underline disabled:opacity-50">
                      Resend code
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-[#d6c9bb] bg-[#faf8f6] p-4 text-[13.5px] leading-relaxed text-[#57534e]">
              <p className="font-semibold text-[#1c1917]">Sign-in isn&apos;t configured.</p>
              <p className="mt-1">
                Ask your manager to set up the store connection, then sign in here with your staff email and password.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
