/* Boutique hero — cloned from jadepink-flow, rebranded to JadePink.
   Two-column: editorial serif intro + glass-framed jewellery plate
   with floating product chip. Server component. */

import { BoutiqueImage } from "@/components/site/boutique-image";
import { Button } from "@/components/ui/button";

const TRUST = ["Heritage & luxury labels", "Young, experimental designers", "Open daily · 10:30 AM – 8 PM"];

export function Hero() {
  return (
    <section id="top" className="mx-auto max-w-6xl px-4 pt-12 pb-10 sm:px-8 sm:pt-20 lg:pt-24">
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-12 lg:gap-16">
        <div className="reveal" style={{ "--d": "60ms" } as React.CSSProperties}>
          <p className="text-xs font-medium tracking-[0.22em] uppercase text-brand">
            Multi-designer boutique · Thaltej, Ahmedabad
          </p>
          <h1 className="mt-4 max-w-[16ch] font-display text-[2.75rem] leading-[1.02] font-light tracking-[-0.02em] text-balance text-ink sm:text-6xl lg:text-7xl">
            Her boutique of pretty things.
          </h1>
          <p className="mt-6 max-w-[46ch] text-base leading-relaxed text-pretty text-ink/70 sm:text-lg">
            Flowy dresses, soft co-ord sets, delicate gold, silk hair ribbons and
            little gifts — heritage and luxury labels plus young, experimental
            designers, all under one roof.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button asChild variant="boutique" size="boutique" className="nudge">
              <a href="#collections">
                Explore the boutique
                <span className="nudge-target text-base leading-none" aria-hidden="true">
                  →
                </span>
              </a>
            </Button>
            <Button asChild variant="glass" size="boutique">
              <a href="#contact">Plan your visit</a>
            </Button>
          </div>
          <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-ink/65">
            {TRUST.map((label) => (
              <li key={label} className="flex items-center gap-2">
                <span className="size-1.5 shrink-0 rounded-full bg-gold" aria-hidden="true" />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <div className="reveal relative" style={{ "--d": "140ms" } as React.CSSProperties}>
          <div className="pointer-events-none absolute -top-6 -right-6 -z-10 size-40 rounded-full bg-gold/25 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-6 -left-6 -z-10 size-40 rounded-full bg-blush/40 blur-2xl" />
          <div className="glass-panel zoom-frame rounded-[1.5rem] p-3 ring-1 ring-shadow backdrop-blur-2xl">
            <BoutiqueImage
              src="/boutique/boutique-hero-jewellery.jpg"
              alt="Gold pendant and stackable rings on a pale marble tray at JadePink"
              width={912}
              height={1104}
              className="aspect-[4/5] w-full rounded-[1rem] object-cover outline-1 -outline-offset-1 outline-shadow"
              priority
            />
          </div>
          <div className="glass-panel-strong absolute -bottom-6 left-4 flex items-center gap-3 rounded-2xl px-4 py-3 ring-1 ring-shadow backdrop-blur-xl">
            <BoutiqueImage
              src="/boutique/boutique-aurora-chain.jpg"
              alt="Close crop of a delicate gold chain bracelet"
              width={96}
              height={96}
              loading="lazy"
              className="size-11 rounded-full object-cover outline-1 -outline-offset-1 outline-shadow"
            />
            <div>
              <p className="font-display text-base leading-tight font-medium text-ink">
                The bridal edit
              </p>
              <p className="tabular mt-0.5 text-xs text-ink/65">Handpicked · tried on with a stylist</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
