/* JadePink hero — full-bleed editorial like Ogaan/Le Mill.
   Edge-to-edge photograph, bottom-left overlay: designer serif + mood line
   + SHOP NOW. Functional black scrim for legibility only. Server component. */

import { BoutiqueImage } from "@/components/site/boutique-image";

export function Hero() {
  return (
    <section id="top" aria-label="Featured" className="bg-white">
      <div className="reveal relative overflow-hidden">
        <BoutiqueImage
          src="/boutique/boutique-hero-jewellery.jpg"
          alt="Gold pendant and stackable rings on a pale marble tray at JadePink"
          width={1800}
          height={1100}
          sizes="100vw"
          className="h-[68vh] min-h-[480px] w-full object-cover sm:h-[76vh]"
          priority
        />
        {/* Functional scrim — legibility, not decoration */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent" />
        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-5 px-4 pb-10 sm:px-8 sm:pb-14">
            <p className="text-[11px] font-semibold tracking-[0.28em] text-white/80 uppercase">
              The bridal counter · Restocked Friday
            </p>
            <h1 className="max-w-[14ch] font-display text-5xl leading-[1.0] font-semibold tracking-[-0.01em] text-balance text-white sm:text-7xl">
              Aurora chain, tried on with a stylist.
            </h1>
            <div className="flex flex-wrap items-center gap-6">
              <a
                href="#new"
                className="inline-flex min-h-[48px] items-center bg-white px-7 text-[12px] font-semibold tracking-[0.2em] text-black uppercase hover:bg-black hover:text-white"
              >
                Shop now
              </a>
              <a
                href="#visit"
                className="text-[12px] font-semibold tracking-[0.2em] text-white uppercase underline underline-offset-8 hover:text-white/70"
              >
                Plan your visit
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Category rail — horizontal snap strip, Ogaan pattern */}
      <div className="border-b border-black/10">
        <div className="mx-auto flex max-w-[1400px] items-center gap-8 overflow-x-auto px-4 py-4 sm:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            ["Dresses", "#collections"],
            ["Co-ord sets", "#collections"],
            ["Kurtis", "#collections"],
            ["Jewellery", "#new"],
            ["Footwear", "#designers"],
            ["Bridal", "#visit"],
          ].map(([label, href]) => (
            <a
              key={label}
              href={href}
              className="shrink-0 text-[12px] font-medium tracking-[0.2em] text-black/60 uppercase hover:text-black hover:underline hover:underline-offset-8"
            >
              {label}
            </a>
          ))}
          <span className="ml-auto hidden shrink-0 text-[12px] tracking-[0.08em] text-black/40 sm:inline">
            G-8 Harmony Icon, Hebatpur Rd · Daily 10:30–20:00
          </span>
        </div>
      </div>
    </section>
  );
}
