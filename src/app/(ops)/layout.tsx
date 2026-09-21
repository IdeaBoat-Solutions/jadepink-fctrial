"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/today", label: "Today" },
  { href: "/floor", label: "Live floor" },
  { href: "/customers", label: "Customers" },
];

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut, toasts, online, pushToast, createWalkIn } = useStore();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.replace("/login");
  }, [user, router]);

  if (!user) return <div className="flex min-h-dvh items-center justify-center text-[14px] text-[#78716c]">Checking sign-in…</div>;

  const newWalkIn = async () => {
    const v = await createWalkIn();
    if (!v) return;
    pushToast("Walk-in recorded", "Now identify the customer.");
    router.push(`/walk-in?visit=${v.id}`);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[#faf8f6]">
      {!online && (
        <p role="alert" className="bg-[#7a4a00] px-4 py-2 text-center text-[13.5px] font-semibold text-white">
          Connection lost. Your changes haven&apos;t been saved — input is preserved.
        </p>
      )}

      <header className="ops-header sticky top-0 z-30 border-b border-[#e8dfd6] bg-[#faf8f6]/95 shadow-[0_1px_0_rgba(28,25,23,0.02)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 sm:gap-x-4 sm:gap-y-2 sm:px-6 sm:py-3">
          <Link href="/today" className="group flex items-baseline gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-[#f3eeea]" aria-label="JadePink home">
            <span className="text-[17px] font-bold tracking-[0.14em] text-[#1c1917] transition-colors group-hover:text-[#b4234d]">JADEPINK</span>
            <span className="hidden text-[11px] font-medium tracking-[0.08em] text-[#a8a29e] lg:inline">FLOOR OS</span>
          </Link>

          <nav aria-label="Primary" className="order-3 flex w-full flex-nowrap gap-1 overflow-x-auto sm:order-2 sm:w-auto">
            {TABS.map((t) => {
              const active = pathname === t.href || (t.href !== "/today" && pathname.startsWith(t.href));
              return (
                <Link
                  key={t.href} href={t.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative inline-flex min-h-[40px] items-center rounded-xl px-3.5 text-[14px] font-semibold transition-all duration-150 active:scale-[0.97]",
                    active ? "bg-[#1c1917] text-white shadow-[0_4px_12px_-4px_rgba(28,25,23,0.5)]" : "text-[#57534e] hover:-translate-y-px hover:bg-[#f3eeea] hover:text-[#1c1917]"
                  )}
                >
                  {t.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:order-3">
            <span className="hidden items-center gap-1.5 text-[13px] text-[#78716c] md:inline-flex" title="Signed in">
              <span aria-hidden className="live-dot inline-block size-1.5 rounded-full bg-[#177245] text-[#177245]" />
              {user.name} · {user.role === "manager" ? "Manager" : "FC"}
            </span>
            <button
              onClick={newWalkIn}
              className="btn-sheen inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#b4234d] px-4 text-[14.5px] font-bold text-white shadow-[0_4px_14px_-4px_rgba(180,35,77,0.6)] transition-all duration-150 hover:-translate-y-px hover:bg-[#93183d] active:translate-y-0 active:scale-[0.98]"
            >
              <span aria-hidden className="text-[18px] leading-none">+</span> New walk-in
            </button>
            <button onClick={signOut} className="inline-flex min-h-[40px] items-center rounded-lg px-2.5 text-[13px] font-semibold text-[#78716c] transition-colors hover:bg-[#f3eeea] hover:text-[#1c1917] active:scale-[0.97]" title="Sign out">
              Exit
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 sm:px-6 sm:py-6">{children}</main>

      {/* Toasts: immediate acknowledgement, aria-live, never blocking */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[max(1.25rem,env(safe-area-inset-bottom))] z-50 mx-auto flex w-full max-w-md flex-col gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} className="ui-rise pointer-events-auto flex items-start gap-2.5 rounded-2xl border border-white/10 bg-[#1c1917]/95 px-4 py-3 text-white shadow-[0_16px_40px_-12px_rgba(28,25,23,0.6)] backdrop-blur">
            <span aria-hidden className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#177245] text-[12px] font-bold text-white">✓</span>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold tracking-tight">{t.title}</p>
              {t.body && <p className="mt-0.5 text-[13px] leading-relaxed text-white/70">{t.body}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
