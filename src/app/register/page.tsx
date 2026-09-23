"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PrimaryButton, TextInput, Field } from "@/components/ui";
import { FULL_NAME_ERROR, isFullName, normalizeName } from "@/lib/domain";
import { cn } from "@/lib/utils";

type Me = { user: { id: string; email?: string } | null; profile: { name: string; role: string } | null };

export default function RegisterPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"FC" | "STORE_MANAGER">("FC");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/staff/me").then((r) => r.json()).then(setMe).catch(() => setMe({ user: null, profile: null }));
  }, []);

  const canRegister = !!me?.user && !!me?.profile && ["STORE_MANAGER", "ADMIN", "MANAGEMENT"].includes(me.profile.role);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setDone("");
    const cleanName = normalizeName(name);
    if (!isFullName(cleanName)) { setError(FULL_NAME_ERROR); return; }
    setBusy(true);
    try {
      const res = await fetch("/api/staff/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: cleanName, email, password, role, phone }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.message || "Could not register staff."); return; }
      setDone(`${json.data.name} (${json.data.role === "STORE_MANAGER" ? "Store Manager" : "Salesperson / FC"}) registered — they can sign in at /login.`);
      setName(""); setEmail(""); setPhone(""); setPassword(""); setRole("FC");
    } finally {
      setBusy(false);
    }
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
          <p className="font-display mt-4 text-[52px] font-light leading-[1.04] tracking-tight">
            Grow<br /><em className="font-light">the team.</em>
          </p>
          <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/70">
            Managers add new floor staff here. The new member signs in with
            their email and password — role decides what they can touch.
          </p>
          <ol className="mt-8 space-y-2.5 border-t border-white/15 pt-6 text-[13.5px]">
            {[
              ["01", "Salesperson / FC — floor workflow, trials, billing"],
              ["02", "Store Manager — live floor, reassign, catalogue"],
            ].map(([n, t]) => (
              <li key={n} className="flex gap-3">
                <span className="font-display text-white/45">{n}</span>
                <span className="text-white/80">{t}</span>
              </li>
            ))}
          </ol>
        </div>
        <p className="text-[12.5px] text-white/40">Thaltej, Ahmedabad · Managers only</p>
      </div>

      <main className="flex flex-1 items-center justify-center bg-[#faf8f6] px-4 py-8 sm:px-6">
        <div className="w-full max-w-sm rounded-2xl border border-[#e8dfd6] bg-white p-5 sm:p-7">
          <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-[#78716c] lg:hidden">JadePink · Internal</p>
          <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-[#1c1917]">Register staff</h1>
          <p className="mt-1 text-[14px] text-[#78716c]">
            {me === null ? "Checking your session…" : me?.user ? `Signed in as ${me.profile?.name ?? me.user.email}` : "Managers only"}
          </p>

          {me !== null && !me.user && (
            <div className="mt-5 rounded-lg border border-dashed border-[#d6c9bb] bg-[#faf8f6] p-4 text-[13.5px] leading-relaxed text-[#57534e]">
              Sign in as a Store Manager first, then come back here.
              <Link href="/login" className="mt-3 block text-center text-[14px] font-semibold text-[var(--staff-brand)] hover:underline">
                Go to sign in →
              </Link>
            </div>
          )}

          {me?.user && !canRegister && (
            <div role="alert" className="mt-5 rounded-xl border border-[#f0b6b9] bg-[#fdecec] px-4 py-3.5">
              <p className="text-[14px] font-semibold text-[#7d1a1f]">Managers only.</p>
              <p className="mt-1 text-[13.5px] leading-relaxed text-[#7d1a1f]/90">
                Your account ({me.profile?.role}) can&apos;t register staff. Ask Smit to add them.
              </p>
              <button onClick={() => router.push("/today")} className="mt-2 min-h-[40px] rounded-lg bg-white px-3 text-[13.5px] font-semibold text-[#7d1a1f] ring-1 ring-[#f0b6b9] hover:bg-[#fff7f7]">
                Back to floor
              </button>
            </div>
          )}

          {canRegister && (
            <form onSubmit={submit} className="mt-5 flex flex-col gap-4" aria-label="Register staff">
              {error && <p role="alert" className="rounded-lg border border-[#f0b6b9] bg-[#fdecec] px-3 py-2.5 text-[13.5px] font-medium text-[#7d1a1f]">{error}</p>}
              {done && <p role="status" className="rounded-lg border border-[#bfe3cd] bg-[#e6f4ec] px-3 py-2.5 text-[13.5px] font-medium text-[#177245]">{done}</p>}
              <Field label="Full name" htmlFor="reg-name" hint="First name + surname — two staff members often share a first name.">
                <TextInput id="reg-name" autoComplete="name" placeholder="e.g. Aakash Shah" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              </Field>
              <Field label="Staff email" htmlFor="reg-email">
                <TextInput id="reg-email" type="email" autoComplete="email" placeholder="name@jadepink.in" value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Mobile number" htmlFor="reg-phone" hint="Optional — enables OTP sign-in for this staff member.">
                <TextInput id="reg-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 · 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </Field>
              <Field label="Temporary password" htmlFor="reg-password" hint="Min 8 characters. They change it later in Authentication.">
                <TextInput id="reg-password" type="password" autoComplete="new-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <fieldset>
                <legend className="text-[13px] font-semibold text-[#44403c]">Role</legend>
                <div
                  className="mt-1.5 grid grid-cols-2 gap-2"
                  role="radiogroup"
                  aria-label="Role"
                  onKeyDown={(e) => {
                    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                    e.preventDefault();
                    const next = role === "FC" ? "STORE_MANAGER" : "FC";
                    setRole(next);
                    e.currentTarget.querySelector<HTMLButtonElement>(`button[data-role="${next}"]`)?.focus();
                  }}
                >
                  {(["FC", "STORE_MANAGER"] as const).map((r) => (
                    <button
                      key={r} type="button" role="radio" aria-checked={role === r} tabIndex={role === r ? 0 : -1} data-role={r} onClick={() => setRole(r)}
                      className={cn(
                        "min-h-[52px] rounded-lg border px-3 text-left transition-colors",
                        role === r ? "border-[var(--staff-brand)] bg-[#fdf0f4]" : "border-[#d6c9bb] bg-white hover:border-[#1c1917]"
                      )}
                    >
                      <span className="block text-[14px] font-semibold">{r === "FC" ? "Salesperson" : "Manager"}</span>
                      <span className="block text-[12px] text-[#78716c]">{r === "FC" ? "Floor workflow" : "Floor + reassign"}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <PrimaryButton type="submit" disabled={busy}>{busy ? "Registering…" : "Register staff →"}</PrimaryButton>
              <Link href="/today" className="text-center text-[13px] font-medium text-[#78716c] hover:text-[#1c1917]">
                Back to floor
              </Link>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
