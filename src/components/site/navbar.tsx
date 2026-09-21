/* Slim translucent top nav, royal luxury style.
   Gold accents on deep navy — premium fashion store feel. */

import Link from "next/link";

const LINKS = [
  { href: "#about", label: "About" },
  { href: "#designers", label: "Designers" },
  { href: "#designs", label: "Our designs" },
  { href: "#events", label: "Events" },
  { href: "#visit", label: "Contact" },
];

export function Navbar() {
  return (
    <header className="sl-nav fixed inset-x-0 top-0 z-40">
      <nav aria-label="Primary" className="mx-auto flex h-[64px] max-w-[1280px] items-center px-6 sm:px-8 lg:px-12">
        <Link href="#top" aria-label="JadePink home" className="text-[18px] font-bold tracking-[0.2em] text-[var(--color-gold)]">
          JADE<span className="font-display italic text-[var(--color-gold-light)]">PINK</span>
        </Link>

        <div className="mx-auto hidden items-center gap-10 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="relative text-[13px] font-medium tracking-[0.12em] text-[var(--color-ink)]/70 uppercase transition-colors hover:text-[var(--color-gold)] before:absolute before:left-0 before:-bottom-1 before:h-[1px] before:w-0 before:bg-[var(--color-gold)] before:transition-all before:duration-300 hover:before:w-full"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-4 sm:gap-6">
          <Link
            href="/login"
            className="sl-btn sl-btn-gold h-[44px] min-h-[44px] px-5 text-[12px] font-semibold tracking-[0.1em] uppercase rounded-none border border-[var(--color-gold)] text-[var(--color-royal)] hover:bg-[var(--color-gold)] hover:text-white transition-all duration-300"
          >
            Sign in
          </Link>
        </div>
      </nav>

      {/* Mobile anchor row: single line, horizontally scrollable */}
      <nav aria-label="Sections" className="border-t border-[var(--color-gold-border)] md:hidden">
        <div className="flex gap-6 overflow-x-auto px-6 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="shrink-0 text-[12px] font-medium tracking-[0.12em] text-white/50 uppercase hover:text-[var(--color-gold)]"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
