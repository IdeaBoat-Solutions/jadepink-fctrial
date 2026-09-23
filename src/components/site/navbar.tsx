/* JadePink masthead — Ogaan/Le Mill pattern.
   Announcement micro-bar + centered wordmark row + uppercase nav row.
   Flat white, hairlines, no pill, no glass, no blur. */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

const PUBLIC_LINKS = [
  { href: "#collections", label: "Collections" },
  { href: "#new", label: "Just in" },
  { href: "#designers", label: "Designers" },
  { href: "#journal", label: "Journal" },
  { href: "#visit", label: "Our store" },
];

const FC_LINKS = [
  { href: "/today", label: "Today" },
  { href: "/floor", label: "Floor" },
  { href: "/customers", label: "Customers" },
];

const MANAGER_LINKS = [
  { href: "/today", label: "Today" },
  { href: "/floor", label: "Floor" },
  { href: "/dashboard", label: "Dashboard" },
];

export function Navbar() {
  const { user, profile, signOut, loadingSession } = useStore();
  const router = useRouter();
  const signedIn = !!user;
  const isManager = user?.role === "manager";
  const links = isManager ? MANAGER_LINKS : FC_LINKS;
  const navLinks = signedIn ? links : !loadingSession ? PUBLIC_LINKS : [];

  const onSignOut = () => {
    void Promise.resolve(signOut()).then(() => router.push("/"));
  };

  return (
    <header className="sticky top-0 z-30 bg-white">
      <div className="bg-[#101010] text-white">
        <p className="mx-auto max-w-[1400px] truncate px-4 py-2 text-center text-[11px] font-medium tracking-[0.22em] uppercase sm:px-8">
          Thaltej, Ahmedabad · Open daily 10:30 AM – 8:00 PM · +91 90812 88988
        </p>
      </div>

      <div className="border-b border-black/10">
        <div className="mx-auto grid max-w-[1400px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 py-4 sm:px-8">
          <div className="hidden text-[12px] tracking-[0.08em] text-black/60 md:block">
            {signedIn ? (
              <span className="truncate">{profile?.name ?? user.name}</span>
            ) : (
              <a href="https://www.instagram.com/jadepink_studio/" target="_blank" rel="noreferrer" className="hover:text-black">
                Instagram →
              </a>
            )}
          </div>
          <a
            href={signedIn ? "/today" : "#top"}
            aria-label="JadePink home"
            className="justify-self-center text-center"
          >
            <span className="block font-display text-[30px] leading-none font-semibold tracking-[0.08em] text-black uppercase">
              JadePink
            </span>
            <span className="mt-1 block text-[10px] font-medium tracking-[0.34em] text-black/55 uppercase">
              Multi-designer store
            </span>
          </a>
          <div className="flex items-center justify-end gap-5 text-[12px] font-medium tracking-[0.14em] uppercase">
            {signedIn ? (
              <>
                <button onClick={onSignOut} className="hidden text-black/60 hover:text-black sm:inline">
                  Sign out
                </button>
                <Link href={isManager ? "/dashboard" : "/today"} className="bg-[#651E2A] px-4 py-2.5 text-white hover:bg-black">
                  {isManager ? "Dashboard" : "Today"}
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="hidden text-black/60 hover:text-black sm:inline">
                  Sign in
                </Link>
                <a href="#visit" className="bg-black px-4 py-2.5 text-white hover:bg-[#651E2A]">
                  Visit
                </a>
              </>
            )}
          </div>
        </div>
      </div>

      <nav aria-label="Main navigation" className="border-b border-black/10">
        <div className="mx-auto flex max-w-[1400px] items-center justify-center gap-8 overflow-x-auto px-4 [scrollbar-width:none] sm:px-8 [&::-webkit-scrollbar]:hidden">
          {navLinks.map((l) =>
            l.href.startsWith("#") ? (
              <a
                key={l.label}
                href={l.href}
                className="flex min-h-[44px] shrink-0 items-center text-[12px] font-medium tracking-[0.2em] text-black/70 uppercase hover:text-black hover:underline hover:underline-offset-8"
              >
                {l.label}
              </a>
            ) : (
              <Link
                key={l.label}
                href={l.href}
                className="flex min-h-[44px] shrink-0 items-center text-[12px] font-medium tracking-[0.2em] text-black/70 uppercase hover:text-black hover:underline hover:underline-offset-8"
              >
                {l.label}
              </Link>
            ),
          )}
        </div>
      </nav>
    </header>
  );
}
