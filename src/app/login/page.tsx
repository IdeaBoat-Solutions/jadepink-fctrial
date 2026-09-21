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

  // OTP
  const [mobile, setMobile] = useState("");
  const [step, setStep] = useState<"mobile" | "code">("mobile");
  const [code, setCode] = useState("");

  // Demo fallback (works before Supabase is wired)
  const [demoName, setDemoName] = useState("");
  const [demoRole, setDemoRole] = useState<"fc" | "manager">("fc");

  useEffect(() => {
    if (user) router.replace("/today");
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
    signIn(name, storeRole(me?.profile?.role));
    router.push("/today");
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

  const submitDemo = (e: React.FormEvent) => {
    e.preventDefault();
    const n = demoName.trim() || "Riya";
    if (demoName.trim() && demoName.trim().length < 2) { setError("Enter your first name as the team knows you."); return; }
    signIn(n, demoRole);
    router.push("/today");
  };

  return (
    <div className="flex min-h-dvh">
      <div className="dot-grid-dark hidden w-[44%] flex-col justify-between bg-[#1c1917] p-10 text-white lg:flex">
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-white/60">JadePink · Internal</p>
          <Link href="/" className="text-[13px] font-medium text-white/55 transition-colors hover:text-white">
            ← jadepink.com
          </Link>
        </div>
        <div>
          <h1 className="font-display mt-4 text-[52px] font-light leading-[1.04] tracking-tight">
            Style<br /><em className="font-light">meets you.</em>
          </h1>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/70">
            The store operations portal. Walk-in to billing, one calm workflow —
            built for the floor, not the back office.
          </p>
          <ol className="mt-8 space-y-2.5 border-t border-white/15 pt-6 text-[13.5px]">
            {[
              ["01", "Walk-in recorded the second she arrives"],
              ["02", "Customer found by mobile in seconds"],
              ["03", "FC assigned, visit started, trial begins"],
            ].map(([n, t]) => (
              <li key={n} className="flex gap-3">
                <span className="font-display text-white/45">{n}</span>
                <span className="text-white/80">{t}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <main className="flex flex-1 items-center justify-center bg-[#faf8f6] p-6">
        <div className="w-full max-w-sm rounded-2xl border border-[#e8dfd6] bg-white p-7">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#78716c] lg:hidden">JadePink · Internal</p>
          <h2 className="mt-1 text-[22px] font-semibold tracking-tight text-[#1c1917]">Sign in</h2>
          <p className="mt-1 text-[14px] text-[#78716c]">Sales portal · Store management</p>

          {SUPABASE_CONFIGURED ? (
            <>
              <div role="tablist" aria-label="Sign-in method" className="mt-5 grid grid-cols-2 gap-1 rounded-lg bg-[#f3eeea] p-1">
                {(["password", "otp"] as const).map((m) => (
                  <button
                    key={m} type="button" role="tab" aria-selected={method === m}
                    onClick={() => { setMethod(m); setError(""); }}
                    className={cn(
                      "min-h-[40px] rounded-md text-[13.5px] font-semibold transition-colors",
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
                    />
                  </Field>
                  <Field label="Password" htmlFor="login-password">
                    <TextInput
                      id="login-password" type="password" autoComplete="current-password" placeholder="••••••••"
                      value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} aria-invalid={!!error}
                    />
                  </Field>
                  <PrimaryButton type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in →"}</PrimaryButton>
                </form>
              ) : step === "mobile" ? (
                <form onSubmit={sendOtp} className="mt-4 flex flex-col gap-4" aria-label="Request one-time code">
                  <Field label="Mobile number" htmlFor="login-mobile" hint="10-digit Indian mobile. We'll text you a 6-digit code — no password needed.">
                    <TextInput id="login-mobile" autoComplete="tel" inputMode="tel" placeholder="+91 · 98765 43210" value={mobile} onChange={(e) => { setMobile(e.target.value); setError(""); }} aria-invalid={!!error} />
                  </Field>
                  <PrimaryButton type="submit" disabled={busy}>{busy ? "Sending code…" : "Send code →"}</PrimaryButton>
                </form>
              ) : (
                <form onSubmit={verifyCode} className="mt-4 flex flex-col gap-4" aria-label="Enter one-time code">
                  <Field label="6-digit code" htmlFor="login-code" hint={`Sent to +91 ${normMobile()}. Valid for a few minutes.`}>
                    <TextInput id="login-code" autoComplete="one-time-code" inputMode="numeric" maxLength={6} placeholder="••••••" value={code} onChange={(e) => { setCode(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }} aria-invalid={!!error} />
                  </Field>
                  <PrimaryButton type="submit" disabled={busy}>{busy ? "Verifying…" : "Verify & sign in →"}</PrimaryButton>
                  <div className="flex items-center justify-between text-[13px]">
                    <button type="button" onClick={() => { setStep("mobile"); setCode(""); setError(""); }} className="font-semibold text-[#b4234d] hover:underline">
                      ← Use a different number
                    </button>
                    <button type="button" onClick={sendOtp} disabled={busy} className="font-semibold text-[#57534e] hover:underline disabled:opacity-50">
                      Resend code
                    </button>
                  </div>
                </form>
              )}
            </>
          ) : (
            <form onSubmit={submitDemo} className="mt-5 flex flex-col gap-4" aria-label="Sign in (demo mode)">
              <div className="rounded-lg border border-dashed border-[#d6c9bb] bg-[#faf8f6] p-3 text-[12.5px] leading-relaxed text-[#78716c]">
                Supabase isn&apos;t connected yet — demo mode. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> +{" "}
                <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to <code>.env</code>, then this screen becomes email + password / OTP.
                See <code>supabase/README.md</code>.
              </div>
              <Field label="Your first name" htmlFor="login-name" error={error || undefined} hint={error ? undefined : "Use the name the floor knows you by."}>
                <TextInput id="login-name" autoComplete="given-name" placeholder="e.g. Riya" value={demoName} onChange={(e) => { setDemoName(e.target.value); setError(""); }} aria-invalid={!!error} />
              </Field>
              <fieldset>
                <legend className="text-[13px] font-semibold text-[#44403c]">Sign in as</legend>
                <div className="mt-1.5 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Role">
                  {(["fc", "manager"] as const).map((r) => (
                    <button
                      key={r} type="button" role="radio" aria-checked={demoRole === r} onClick={() => setDemoRole(r)}
                      className={demoRole === r ? "min-h-[52px] rounded-lg border border-[#b4234d] bg-[#fdf0f4] px-3 text-left" : "min-h-[52px] rounded-lg border border-[#d6c9bb] bg-white px-3 text-left hover:border-[#1c1917]"}
                    >
                      <span className="block text-[14px] font-semibold">{r === "fc" ? "Salesperson" : "Manager"}</span>
                      <span className="block text-[12px] text-[#78716c]">{r === "fc" ? "Floor workflow" : "Live floor + reassign"}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <PrimaryButton type="submit">Sign in →</PrimaryButton>
              <p className="text-center text-[12px] text-[#a8a29e]">Demo build · data stays on this device until Supabase is connected</p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
