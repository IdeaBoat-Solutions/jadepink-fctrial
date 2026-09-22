"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { RouteFocus } from "@/components/layout/route-focus";
import { cn } from "@/lib/utils";

type Role = "fc" | "manager";

const FC_NAV = [
  { href: "/today", label: "Dashboard" },
  { href: "/visits", label: "My visits" },
  { href: "/customers", label: "Customers" },
  { href: "/products", label: "Products" },
] as const;

const MANAGER_NAV = [
  { href: "/today", label: "Dashboard" },
  { href: "/floor", label: "Live floor" },
  { href: "/customers", label: "Customers" },
  { href: "/products", label: "Products" },
  { href: "/team", label: "Sales team" },
  { href: "/activity", label: "Reports" },
] as const;

export function FloorShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut, toasts, online, dismissToast, pushToast, createWalkIn } = useStore();
  const role: Role = user?.role === "manager" ? "manager" : "fc";
  const nav = role === "manager" ? MANAGER_NAV : FC_NAV;
  const [creating, setCreating] = useState(false);
  const first = user?.name?.split(" ")[0] || "Staff";

  const newWalkIn = async () => {
    if (creating) return;
    setCreating(true);
    const v = await createWalkIn();
    setCreating(false);
    if (!v) {
      pushToast("Could not record the walk-in", "Check your connection and try again.");
      return;
    }
    pushToast("Walk-in recorded", "Identify the customer next.");
    router.push(`/visits/${v.id}`);
  };

  return (
    <div className="floor-os">
      <a href="#main-content" className="fp-skip">Skip to work</a>
      <div className="floor-shell">
        <aside className="floor-rail" aria-label="Store navigation">
          <Link href="/today" className="mb-5 flex items-center gap-2.5 px-1.5">
            <span className="grid size-8 place-items-center bg-[var(--fp-ink)] text-[13px] font-semibold text-white">JP</span>
            <span className="floor-brand-copy leading-none">
              <span className="block text-[12px] font-semibold tracking-[0.16em]">JADEPINK</span>
              <span className="mt-1 block text-[11px] text-[var(--fp-muted)]">Ahmedabad</span>
            </span>
          </Link>
          <nav className="flex flex-1 flex-col gap-0.5">
            {nav.map((item) => {
              const active = pathname === item.href || (item.href !== "/today" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-10 items-center gap-2 rounded-md px-2.5 text-[13.5px] font-medium text-[var(--fp-muted)] hover:bg-[var(--fp-ink-soft)] hover:text-[var(--fp-ink)]",
                    active && "bg-[var(--fp-ink-soft)] font-semibold text-[var(--fp-ink)] shadow-[inset_2px_0_0_var(--fp-brand)]",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <button
            onClick={() => void newWalkIn()}
            disabled={creating}
            className="mt-3 min-h-11 rounded-lg border border-[var(--fp-line-strong)] px-3 text-[13.5px] font-semibold text-[var(--fp-ink)] hover:border-[var(--fp-ink)] disabled:opacity-60"
          >
            {creating ? "Recording…" : "New walk-in"}
          </button>
          <div className="floor-rail-foot mt-3 border-t border-[var(--fp-line)] pt-3">
            <p className="truncate px-1 text-[12.5px] font-medium">{first}</p>
            <p className="px-1 text-[11.5px] text-[var(--fp-muted)]">{role === "manager" ? "Store manager" : "Sales"}</p>
          </div>
        </aside>

        <div className="floor-main">
          {!online && (
            <p role="alert" className="bg-[var(--fp-wait)] px-4 py-2 text-center text-[13.5px] font-semibold text-white">
              Connection lost. Your last action may not have saved. Input on this screen is kept.
            </p>
          )}
          <header className="floor-top">
            <p className="truncate text-[13px] text-[var(--fp-muted)]">
              JadePink · Ahmedabad
              <span className="mx-2 text-[var(--fp-line-strong)]">/</span>
              <span className="text-[var(--fp-ink)]">{role === "manager" ? "Store" : "My work"}</span>
            </p>
            <div className="flex items-center gap-3">
              <span className="hidden text-[13px] text-[var(--fp-muted)] sm:inline">{user?.name}</span>
              <button onClick={() => void signOut()} className="min-h-9 rounded-md px-2 text-[13px] font-semibold text-[var(--fp-muted)] hover:text-[var(--fp-ink)]">
                Sign out
              </button>
            </div>
          </header>
          <main id="main-content" tabIndex={-1} className="floor-work focus:outline-none">
            <RouteFocus />
            {children}
          </main>
        </div>
      </div>

      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 mx-auto flex w-full max-w-md flex-col gap-2 px-4">
        {toasts.map((t) => (
          <div key={t.id} className="fp-rise pointer-events-auto flex items-start gap-3 border border-[var(--fp-ink)] bg-[var(--fp-ink)] px-4 py-3 text-white">
            <span aria-hidden className="mt-1 size-1.5 shrink-0 bg-[#8dcea8]" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">{t.title}</p>
              {t.body && <p className="mt-0.5 text-[13px] leading-relaxed text-white/70">{t.body}</p>}
            </div>
            <button onClick={() => dismissToast(t.id)} aria-label={`Dismiss ${t.title}`} className="min-h-8 px-1 text-[12px] font-semibold text-white/60 hover:text-white">
              Close
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
