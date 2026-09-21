import Link from "next/link";
import Image from "next/image";

/* Hero: boutique banner. Full-bleed elegant image, serif headline,
   the way the real JadePink banner reads: "Designing your Fashion". */

const STATS = [
  { value: "40+", label: "designer labels" },
  { value: "3", label: "clothing · footwear · jewellery" },
  { value: "10:30–8", label: "open every day" },
] as const;

export function Hero() {
  return (
    <section id="top" aria-label="JadePink introduction" className="relative">
      {/* Full-bleed boutique banner */}
      <div className="relative mx-auto aspect-[4/5] w-full max-w-[1280px] sm:aspect-[16/10]">
        <Image
          src="https://picsum.photos/seed/jadepink-boutique-banner/1600/1200"
          alt="Inside the JadePink multi-designer boutique, rails of heritage and luxury labels"
          fill
          priority
          sizes="(max-width: 640px) 100vw, 1280px"
          className="object-cover"
        />
        {/* Elegant gradient overlay */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-[var(--color-royal)]/70 via-[var(--color-royal)]/30 to-[var(--color-royal)]/5" />
        <div className="absolute inset-x-0 bottom-0 p-8 pb-12 text-center sm:p-16 sm:pb-20">
          {/* Elegant kicker */}
          <p className="mb-4 text-[11px] font-semibold tracking-[0.25em] uppercase text-[var(--color-gold)]">
            Multi-designer boutique · Ahmedabad
          </p>
          {/* Serif headline */}
          <h1 className="font-display mx-auto max-w-[14ch] text-center text-[48px] leading-[1.1] text-white sm:text-[78px] sm:leading-[1.05]">
            Designing
            <br />
            <em className="italic text-[var(--color-gold-light)]">your</em> Fashion
          </h1>
          {/* Delicate supporting text */}
          <p className="mx-auto mt-5 max-w-[38ch] text-center text-[15px] leading-[1.7] text-white/75 sm:mt-6 sm:text-[17px]">
            Unique, handpicked heritage and luxury labels — plus young,
            experimental designers. Walk in any day.
          </p>
          {/* Gold accent line */}
          <div className="mx-auto mt-6 h-[1px] w-16 bg-gradient-to-r from-transparent via-[var(--color-gold)] to-transparent" />
          {/* Elegant CTA buttons */}
          <div className="mt-8 flex flex-col items-center justify-center gap-4 min-[420px]:flex-row sm:mt-10">
            <Link href="#designers" className="sl-btn sl-btn-gold w-full min-[420px]:w-auto">
              Explore the designers
            </Link>
            <Link href="#visit" className="sl-btn sl-btn-ghost w-full border border-white/20 text-white min-[420px]:w-auto">
              Plan your visit
            </Link>
          </div>
        </div>
      </div>

      {/* Elegant stats strip */}
      <dl className="mx-auto grid grid-cols-3 border-b border-[var(--color-gold-border)] px-6 py-10 text-center sm:px-8 sm:py-12 lg:px-12">
        {STATS.map((s) => (
          <div key={s.label} data-sl-reveal className="sl-reveal">
            <dd className="font-display text-[32px] text-[var(--color-gold)] sm:text-[44px]">{s.value}</dd>
            <dt className="mt-1 text-[11px] font-medium tracking-[0.15em] uppercase text-[var(--color-ink)]/50 sm:text-[12.5px]">{s.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
