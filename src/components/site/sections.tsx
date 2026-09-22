/* Boutique sections — cloned from jadepink-flow, rebranded to JadePink.
   Promises, six drawers, week's favourites, designers, review,
   newsletter + visit cards, glass footer. Server components. */

import { BoutiqueImage } from "@/components/site/boutique-image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NewsletterForm } from "@/components/site/newsletter-form";

/* ---------- Promises ---------- */

function Promise({
  title,
  body,
  tone,
  delay,
}: {
  title: string;
  body: string;
  tone: "brand" | "gold" | "blush";
  delay: number;
}) {
  const colorClass = {
    brand: "bg-brand/10 [&_span]:bg-brand",
    gold: "bg-gold/15 [&_span]:bg-gold",
    blush: "bg-blush/30 [&_span]:bg-brand",
  }[tone];

  return (
    <div
      className="glass-panel reveal group flex items-center gap-4 rounded-2xl p-5 ring-1 ring-shadow backdrop-blur-xl"
      style={{ "--d": `${delay}ms` } as React.CSSProperties}
    >
      <div
        className={
          "grid size-11 shrink-0 place-items-center rounded-full transition-transform duration-200 group-hover:scale-105 " +
          colorClass
        }
      >
        <span className="size-2.5 rounded-full" />
      </div>
      <div>
        <p className="font-medium tracking-[0.01em] text-ink">{title}</p>
        <p className="mt-1 text-sm text-ink/65">{body}</p>
      </div>
    </div>
  );
}

export function Promises() {
  return (
    <section aria-label="Boutique promises" className="mx-auto max-w-6xl px-4 py-12 sm:px-8 sm:py-16">
      <div className="grid gap-4 sm:grid-cols-3">
        <Promise title="Handpicked labels" body="Heritage, luxury + young experiments." tone="brand" delay={0} />
        <Promise title="Styled in store" body="Tried on with a stylist, not alone." tone="gold" delay={80} />
        <Promise title="Gift wrapped" body="Ribbon, note, no charge." tone="blush" delay={160} />
      </div>
    </section>
  );
}

/* ---------- Section heading ---------- */

function SectionHeading({
  title,
  body,
  linkLabel,
  href,
}: {
  title: string;
  body: string;
  linkLabel?: string;
  href?: string;
}) {
  return (
    <div className="reveal mb-8 flex items-center justify-between gap-6">
      <div>
        <h2 className="font-display text-3xl leading-tight font-light tracking-[-0.02em] text-ink sm:text-4xl">
          {title}
        </h2>
        <p className="mt-2 max-w-[48ch] text-sm leading-relaxed text-ink/65">{body}</p>
      </div>
      {linkLabel && href ? (
        <a
          href={href}
          className="nudge hidden shrink-0 items-center gap-1.5 pb-1 text-sm text-brand transition-colors duration-200 hover:text-ink sm:inline-flex"
        >
          {linkLabel}
          <span className="nudge-target text-base leading-none" aria-hidden="true">
            →
          </span>
        </a>
      ) : null}
    </div>
  );
}

/* ---------- Drawers / categories ---------- */

const DRAWERS = [
  { name: "Dresses", src: "/boutique/category-dresses.jpg", alt: "Blush pink tiered dress on a wooden hanger against a cream wall" },
  { name: "Co-ord sets", src: "/boutique/category-coord-sets.jpg", alt: "Folded ivory top and blush pink shorts co-ord set on linen" },
  { name: "Kurtis & tops", src: "/boutique/category-kurtis.jpg", alt: "Stack of folded cotton kurtis in mint, blush and cream" },
  { name: "Jewellery", src: "/boutique/category-necklaces.jpg", alt: "Gold necklaces on a pale display stand" },
  { name: "Hair & silk", src: "/boutique/category-hair-silk.jpg", alt: "Blush silk scrunchies and gold hair clips on linen" },
  { name: "Home & scent", src: "/boutique/category-home-scent.jpg", alt: "Scented candle and wrapped soap on soft linen" },
];

export function Categories() {
  return (
    <section id="collections" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-12 sm:px-8 sm:py-16">
      <SectionHeading
        title="Shop the drawers"
        body="Dresses, kurtis, jewels and little extras — six little worlds."
        linkLabel="See the favourites"
        href="#new"
      />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {DRAWERS.map((category, index) => (
          <a
            href="#new"
            key={category.name}
            className="glass-panel lift zoom-frame reveal group rounded-[1.25rem] p-2.5 ring-1 ring-shadow backdrop-blur-xl"
            style={{ "--d": `${index * 60}ms` } as React.CSSProperties}
          >
            <BoutiqueImage
              src={category.src}
              alt={category.alt}
              width={768}
              height={896}
              loading="lazy"
              className="aspect-[3/4] w-full rounded-[0.85rem] object-cover outline-1 -outline-offset-1 outline-shadow"
            />
            <p className="px-1 pt-3 pb-1 text-sm font-medium tracking-[0.01em] text-ink transition-colors duration-200 group-hover:text-brand">
              {category.name}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}

/* ---------- Week's favourites ---------- */

const FAVOURITES = [
  {
    name: "Blush tiered dress",
    detail: "Soft cotton · ₹12,450",
    src: "/boutique/product-blush-dress.jpg",
    alt: "Blush pink tiered cotton dress hanging on a wooden hanger",
  },
  {
    name: "Aurora chain",
    detail: "18k gold · ₹10,800",
    src: "/boutique/product-aurora-chain.jpg",
    alt: "Thin gold chain necklace with a small moon pendant on pale silk",
  },
  {
    name: "Rose silk duo",
    detail: "Scrunchie + clip · ₹2,900",
    src: "/boutique/product-rose-silk-duo.jpg",
    alt: "Blush silk scrunchie with gold hair clips on linen",
  },
];

export function Favourites() {
  return (
    <section id="new" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-12 sm:px-8 sm:py-16">
      <SectionHeading
        title="This week's favourites"
        body="Fresh from the rail and the jewellery box."
      />
      <div className="grid gap-5 sm:grid-cols-3">
        {FAVOURITES.map((product, index) => (
          <a
            href="#contact"
            key={product.name}
            className="glass-panel lift zoom-frame nudge reveal group rounded-[1.25rem] p-3 ring-1 ring-shadow backdrop-blur-xl"
            style={{ "--d": `${index * 80}ms` } as React.CSSProperties}
          >
            <BoutiqueImage
              src={product.src}
              alt={product.alt}
              width={816}
              height={816}
              loading="lazy"
              className="aspect-square w-full rounded-[1rem] object-cover outline-1 -outline-offset-1 outline-shadow"
            />
            <div className="flex items-start justify-between gap-3 px-1 pt-4 pb-1">
              <div>
                <p className="font-medium tracking-[0.01em] text-ink transition-colors duration-200 group-hover:text-brand">
                  {product.name}
                </p>
                <p className="tabular mt-1 text-sm text-ink/65">{product.detail}</p>
              </div>
              <span
                className="nudge-target mt-0.5 shrink-0 text-lg text-ink/25 transition-colors duration-200 group-hover:text-brand"
                aria-hidden="true"
              >
                →
              </span>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}

/* ---------- Designers (JadePink truth, boutique skin) ---------- */

const DESIGNER_GROUPS = [
  {
    craft: "For Clothing",
    names: ["Diya Mehta", "Meghna Panchmatia", "Avadh", "Naina Seth", "Kaveri", "Zeel Doshi Thakkar"],
  },
  {
    craft: "For Footwear",
    names: ["Vareli Bafna", "Preet Kaur", "Jutte"],
  },
  {
    craft: "For Jewellery",
    names: ["Brashbug", "Diosaparis", "Silver Shine", "Geet Jewels", "Just Shraddha's", "Aadikara"],
  },
];

export function Designers() {
  return (
    <section id="designers" aria-label="JadePink designers" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-12 sm:px-8 sm:py-16">
      <SectionHeading
        title="Heritage, luxury & young experiments"
        body="A multi-designer boutique — labels you love, plus new names every season."
        linkLabel="Meet them in store"
        href="#contact"
      />
      <div className="grid gap-4 sm:grid-cols-3">
        {DESIGNER_GROUPS.map((g, i) => (
          <div
            key={g.craft}
            className="glass-panel reveal rounded-[1.25rem] p-6 ring-1 ring-shadow backdrop-blur-xl"
            style={{ "--d": `${i * 70}ms` } as React.CSSProperties}
          >
            <p className="text-xs font-medium tracking-[0.22em] uppercase text-brand">{g.craft}</p>
            <ul className="mt-4 space-y-2.5">
              {g.names.map((n) => (
                <li key={n} className="flex items-baseline gap-2.5 text-sm text-ink">
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-gold" />
                  {n}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="reveal mt-6 text-center text-[13px] tracking-[0.02em] text-ink/65">
        Plus Anuj Bhutani, Rishi Vibhuti, Chambray &amp; Co, BhuSattva, Pinki Sinha — and more every season.
      </p>
    </section>
  );
}

/* ---------- Review ---------- */

export function Reviews() {
  return (
    <section aria-label="Customer review" className="mx-auto max-w-6xl px-4 py-12 sm:px-8 sm:py-16">
      <figure className="glass-panel reveal mx-auto max-w-3xl rounded-[1.75rem] p-8 text-center ring-1 ring-shadow backdrop-blur-2xl sm:p-12">
        <div className="flex items-center justify-center gap-1.5 text-gold" aria-label="Rated five out of five">
          {[0, 1, 2, 3, 4].map((star) => (
            <span key={star} className="text-base leading-none" aria-hidden="true">
              ★
            </span>
          ))}
        </div>
        <blockquote className="mx-auto mt-6 max-w-[38ch] font-display text-2xl leading-[1.35] font-light tracking-[-0.01em] text-balance text-ink sm:text-[1.75rem]">
          “Bridal to brunch — everything fits like it was made for me. I don&apos;t
          shop anywhere else in Ahmedabad now.”
        </blockquote>
        <figcaption className="mt-8 flex items-center justify-center gap-3">
          <BoutiqueImage
            src="/boutique/customer-priya.jpg"
            alt="Portrait of Priya, a verified boutique customer"
            width={96}
            height={96}
            loading="lazy"
            className="size-11 rounded-full object-cover outline-1 -outline-offset-1 outline-shadow"
          />
          <div className="text-left">
            <p className="text-sm font-medium text-ink">Nirali P.</p>
            <p className="mt-0.5 text-sm text-ink/65">Verified customer · Ahmedabad</p>
          </div>
        </figcaption>
      </figure>
    </section>
  );
}

/* ---------- Newsletter + visit ---------- */

export function Lifestyle() {
  return (
    <section id="lifestyle" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-12 sm:px-8 sm:py-16">
      <div className="grid gap-5 md:grid-cols-2 md:gap-8">
        <div className="glass-panel reveal flex flex-col rounded-[1.5rem] p-6 ring-1 ring-shadow backdrop-blur-xl sm:p-8">
          <h2 className="font-display text-2xl leading-tight font-light tracking-[-0.01em] text-ink sm:text-3xl">
            Stay in the drawer
          </h2>
          <p className="mt-3 max-w-[42ch] text-sm leading-relaxed text-pretty text-ink/65">
            New dresses, quiet restocks and styling notes, once a fortnight. No noise.
          </p>
          <NewsletterForm />
        </div>

        <div
          id="contact"
          className="glass-panel reveal flex scroll-mt-24 flex-col rounded-[1.5rem] p-6 ring-1 ring-shadow backdrop-blur-xl sm:p-8"
          style={{ "--d": "100ms" } as React.CSSProperties}
        >
          <h2 className="font-display text-2xl leading-tight font-light tracking-[-0.01em] text-ink sm:text-3xl">
            Come find us
          </h2>
          <p className="mt-3 max-w-[42ch] text-sm leading-relaxed text-pretty text-ink/65">
            G-8 Harmony Icon, Hebatpur Road, Thaltej, Ahmedabad — open every day,
            10:30 AM to 8 PM. Call{" "}
            <a href="tel:+919081288988" className="link-line text-brand">
              +91 90812 88988
            </a>{" "}
            or write to{" "}
            <a href="mailto:shivankari@jadepink.com" className="link-line text-brand">
              shivankari@jadepink.com
            </a>
            .
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="boutique" size="boutique" className="nudge">
              <a href="https://www.instagram.com/jadepink_studio/" target="_blank" rel="noreferrer">
                Order &amp; contact
                <span className="nudge-target text-base leading-none" aria-hidden="true">
                  →
                </span>
              </a>
            </Button>
            <Button asChild variant="glass" size="boutique">
              <a href="tel:+919081288988">Call the store</a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */

export function Footer() {
  return (
    <footer className="mx-auto max-w-6xl px-4 pt-8 pb-10 sm:px-8 sm:pt-12 sm:pb-12">
      <div className="glass-panel rounded-[1.5rem] p-6 ring-1 ring-shadow backdrop-blur-xl sm:p-8">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-xl font-medium tracking-[-0.01em] text-ink">
              JadePink
            </p>
            <p className="mt-2 max-w-[38ch] text-sm leading-relaxed text-ink/65">
              A multi-designer boutique — heritage and luxury labels, young
              experimental designers, all under one roof in Thaltej, Ahmedabad.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-ink/70" aria-label="Footer links">
            <a href="#collections" className="link-line transition-colors duration-200 hover:text-brand">
              Collections
            </a>
            <a href="#designers" className="link-line transition-colors duration-200 hover:text-brand">
              Designers
            </a>
            <a href="#new" className="link-line transition-colors duration-200 hover:text-brand">
              Jewellery
            </a>
            <a href="#contact" className="link-line transition-colors duration-200 hover:text-brand">
              Contact
            </a>
            <Link href="/login" className="link-line transition-colors duration-200 hover:text-brand">
              Staff sign in
            </Link>
          </nav>
        </div>
        <div className="mt-8 border-t border-ink/10 pt-5 text-xs tracking-[0.02em] text-ink/65">
          © 2026 JadePink · SJ Fashion — Made for delicate gifting
        </div>
      </div>
    </footer>
  );
}
