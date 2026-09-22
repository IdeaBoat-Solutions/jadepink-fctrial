/* Floating glass pill nav — cloned from jadepink-flow.
   Sticky, rounded-full, backdrop-blur. Server component. */

import { Button } from "@/components/ui/button";

const LINKS = [
  { href: "#collections", label: "Collections" },
  { href: "#collections", label: "Clothing" },
  { href: "#new", label: "Jewellery" },
  { href: "#lifestyle", label: "Lifestyle" },
  { href: "#contact", label: "Visit" },
];

export function Navbar() {
  return (
    <header className="sticky top-0 z-30 px-4 pt-4 sm:px-8 sm:pt-5">
      <div className="mx-auto max-w-6xl">
        <div className="glass-panel-strong reveal flex items-center justify-between gap-4 rounded-full px-4 py-2.5 ring-1 ring-shadow backdrop-blur-2xl sm:px-5">
          <a
            href="#top"
            className="group flex shrink-0 items-center gap-2.5 rounded-full"
            aria-label="JadePink home"
          >
            <span className="grid size-7 place-items-center rounded-full bg-brand/10 transition-colors duration-200 group-hover:bg-brand/20">
              <span className="size-2 rounded-full bg-brand transition-transform duration-200 group-hover:scale-125" />
            </span>
            <span className="font-display text-xl leading-none font-medium tracking-[-0.01em] text-ink">
              JadePink
            </span>
          </a>

          <nav
            className="hidden items-center gap-6 text-[0.9375rem] leading-none text-ink/65 md:flex lg:gap-8"
            aria-label="Main navigation"
          >
            {LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="link-line py-1 transition-colors duration-200 hover:text-brand"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <Button asChild variant="boutique" size="boutique" className="nudge shrink-0">
            <a href="#collections">
              Shop now
              <span className="nudge-target text-base leading-none" aria-hidden="true">
                →
              </span>
            </a>
          </Button>
        </div>

        {/* Mobile anchor row: single line, horizontally scrollable */}
        <nav aria-label="Sections" className="mt-2 md:hidden">
          <div className="glass-panel flex gap-6 overflow-x-auto rounded-full px-5 py-2.5 ring-1 ring-shadow [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className="shrink-0 text-[12px] font-medium tracking-[0.12em] text-ink/65 uppercase hover:text-brand"
              >
                {l.label}
              </a>
            ))}
          </div>
        </nav>
      </div>
    </header>
  );
}
