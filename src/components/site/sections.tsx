/* JadePink sections — Ogaan / Le Mill grammar.
   White ground, black grotesk, sharp rectangles, thin rules, big air.
   No cream wash, no glass, no dark cards. Server components. */

import { BoutiqueImage } from "@/components/site/boutique-image";
import Link from "next/link";
import { NewsletterForm } from "@/components/site/newsletter-form";

function RowHeading({
  index,
  title,
  body,
  linkLabel,
  href,
}: {
  index: string;
  title: string;
  body: string;
  linkLabel?: string;
  href?: string;
}) {
  return (
    <div className="reveal mx-auto mb-10 max-w-2xl text-center">
      <div className="max-w-2xl">
        <p className="text-[11px] font-semibold tracking-[0.28em] text-black/50 uppercase">{index}</p>
        <h2 className="mt-3 font-display text-4xl leading-[1.04] font-semibold tracking-[-0.01em] text-balance text-black sm:text-5xl">
          {title}
        </h2>
        <p className="mx-auto mt-3 max-w-[56ch] text-[15px] leading-relaxed text-black/60">{body}</p>
      </div>
      {linkLabel && href ? (
        <a
          href={href}
          className="mt-4 inline-block shrink-0 border-b border-black pb-1 text-[12px] font-semibold tracking-[0.2em] text-black uppercase hover:border-[#651E2A] hover:text-[#651E2A]"
        >
          {linkLabel}
        </a>
      ) : null}
    </div>
  );
}

/* ---------- 01 · Shop by category: flat image strip ---------- */

const CATS = [
  { name: "Dresses", fabric: "Cotton · Silk", src: "/boutique/category-dresses.jpg", alt: "Blush pink tiered dress on a wooden hanger" },
  { name: "Co-ord sets", fabric: "Ivory · Blush", src: "/boutique/category-coord-sets.jpg", alt: "Folded ivory top and blush shorts co-ord set" },
  { name: "Kurtis", fabric: "Mint · Cream", src: "/boutique/category-kurtis.jpg", alt: "Stack of folded cotton kurtis" },
  { name: "Jewellery", fabric: "Gold · Silver", src: "/boutique/category-necklaces.jpg", alt: "Gold necklaces on a display stand" },
  { name: "Hair & silk", fabric: "Ribbons · Clips", src: "/boutique/category-hair-silk.jpg", alt: "Silk scrunchies and gold hair clips" },
  { name: "Home & scent", fabric: "Candles · Gifts", src: "/boutique/category-home-scent.jpg", alt: "Scented candle and wrapped soap" },
];

export function Categories() {
  return (
    <section id="collections" className="mx-auto max-w-[1400px] scroll-mt-32 px-4 pt-16 pb-4 sm:px-8 sm:pt-24">
      <RowHeading
        index="01 — Shop by category"
        title="Six tight edits. No endless aisles."
        body="If a rail is empty, it sold through. Ask what arrived Friday — the floor turns over every week."
        linkLabel="View just in"
        href="#new"
      />
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-6">
        {CATS.map((c, i) => (
          <a key={c.name} href="#new" className="reveal group" style={{ "--d": `${i * 50}ms` } as React.CSSProperties}>
            <div className="overflow-hidden bg-[#F4F2ED]">
              <BoutiqueImage
                src={c.src}
                alt={c.alt}
                width={600}
                height={760}
                loading="lazy"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                className="aspect-[3/4] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              />
            </div>
            <p className="mt-3 text-[14px] font-semibold text-black group-hover:underline group-hover:underline-offset-4">
              {c.name}
            </p>
            <p className="mt-0.5 text-[12.5px] tracking-[0.04em] text-black/50">{c.fabric}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

/* ---------- 02 · Just in: flat 4-up product grid ---------- */

const FAVOURITES = [
  { designer: "Studio rail", name: "Blush tiered dress", price: "₹12,450", src: "/boutique/product-blush-dress.jpg", alt: "Blush pink tiered cotton dress" },
  { designer: "Brashbug", name: "Aurora chain", price: "₹10,800", src: "/boutique/product-aurora-chain.jpg", alt: "Thin gold chain with moon pendant" },
  { designer: "Studio rail", name: "Rose silk duo", price: "₹2,900", src: "/boutique/product-rose-silk-duo.jpg", alt: "Blush silk scrunchie with gold clips" },
  { designer: "Diosaparis", name: "Stackable rings", price: "₹8,400", src: "/boutique/boutique-aurora-chain.jpg", alt: "Close crop of a delicate gold chain bracelet" },
];

export function Favourites() {
  return (
    <section id="new" className="mx-auto max-w-[1400px] scroll-mt-32 px-4 py-16 sm:px-8 sm:py-24">
      <RowHeading
        index="02 — Just in"
        title="This week on the rail."
        body="Pulled Friday. When a size goes, it goes — call the counter and we hold it till 8 PM."
        linkLabel="Ask in store"
        href="#visit"
      />
      <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4">
        {FAVOURITES.map((p, i) => (
          <a key={p.name} href="#visit" className="reveal group" style={{ "--d": `${i * 60}ms` } as React.CSSProperties}>
            <div className="overflow-hidden bg-[#F4F2ED]">
              <BoutiqueImage
                src={p.src}
                alt={p.alt}
                width={800}
                height={1000}
                loading="lazy"
                sizes="(max-width: 640px) 50vw, 25vw"
                className="aspect-[3/4] w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
              />
            </div>
            <p className="mt-3 text-[11px] font-semibold tracking-[0.2em] text-black/50 uppercase">{p.designer}</p>
            <p className="mt-1 text-[15px] font-medium text-black">{p.name}</p>
            <p className="mt-0.5 text-[14px] text-black tabular-nums">{p.price}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

/* ---------- 03 · Designers: A–Z index table, Le Mill style ---------- */

const DESIGNER_GROUPS = [
  { craft: "Clothing", names: ["Anuj Bhutani", "Avadh", "Chambray & Co", "Diya Mehta", "Kaveri", "Meghna Panchmatia", "Naina Seth", "Rishi Vibhuti", "Zeel Doshi Thakkar"] },
  { craft: "Footwear", names: ["Jutte", "Preet Kaur", "Vareli Bafna"] },
  { craft: "Jewellery", names: ["Aadikara", "Brashbug", "Diosaparis", "Geet Jewels", "Just Shraddha's", "Silver Shine"] },
];

export function Designers() {
  return (
    <section id="designers" aria-label="Designers" className="border-y border-black/10 bg-[#FAFAF8] scroll-mt-32">
      <div className="mx-auto max-w-[1400px] px-4 py-16 sm:px-8 sm:py-24">
        <RowHeading
          index="03 — Designers A–Z"
          title="Heritage names. First-season experiments."
          body="Established labels beside young designers, hung side by side. New names land every season."
          linkLabel="Meet them in store"
          href="#visit"
        />
        <div className="grid gap-10 md:grid-cols-3 md:gap-8">
          {DESIGNER_GROUPS.map((g) => (
            <div key={g.craft} className="reveal border-t-2 border-black pt-5">
              <p className="text-[11px] font-semibold tracking-[0.28em] text-black uppercase">{g.craft}</p>
              <ul className="mt-2 divide-y divide-black/10">
                {g.names.map((n) => (
                  <li key={n} className="flex items-baseline justify-between gap-4 py-2.5 text-[15px] text-black">
                    {n}
                    <span aria-hidden className="text-[12px] text-black/30">↗</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- 04 · Journal / editorial split tiles ---------- */

export function Reviews() {
  return (
    <section id="journal" aria-label="From the floor" className="mx-auto max-w-[1400px] scroll-mt-32 px-4 py-16 sm:px-8 sm:py-24">
      <RowHeading
        index="04 — From the floor"
        title="Notes, not campaigns."
        body="What the stylists actually say to walk-ins — bridal timelines, what fits petite frames, what restocks."
      />
      <div className="grid gap-4 md:grid-cols-2">
        <figure className="reveal grid sm:grid-cols-2 border border-black/10">
          <div className="overflow-hidden bg-[#F4F2ED]">
            <BoutiqueImage
              src="/boutique/boutique-aurora-chain.jpg"
              alt="Gold chain detail at the bridal counter"
              width={800}
              height={800}
              loading="lazy"
              className="aspect-square h-full w-full object-cover"
            />
          </div>
          <blockquote className="flex flex-col justify-between gap-6 p-7">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.24em] text-[#651E2A] uppercase">Bridal · 6 weeks out</p>
              <p className="mt-3 font-display text-[22px] leading-snug font-medium text-black">
                “Bridal to brunch — everything fits like it was made for me.”
              </p>
            </div>
            <figcaption className="text-[13px] text-black/55">Nirali P. · Verified · 4.9 across 2,300+ reviews</figcaption>
          </blockquote>
        </figure>
        <div className="reveal grid sm:grid-cols-2 border border-black/10 bg-black text-white">
          <div className="flex flex-col justify-between gap-6 p-7">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.24em] text-white/60 uppercase">Stylist note</p>
              <p className="mt-3 font-display text-[22px] leading-snug font-medium">
                Come at 11 AM on weekdays. The trial room is yours.
              </p>
              <p className="mt-3 text-[14px] leading-relaxed text-white/65">
                Evenings run bridal-heavy. Mornings mean unhurried drapes and honest opinions.
              </p>
            </div>
            <a href="#visit" className="text-[12px] font-semibold tracking-[0.2em] uppercase underline underline-offset-8 hover:text-white/70">
              Plan a visit
            </a>
          </div>
          <div className="overflow-hidden">
            <BoutiqueImage
              src="/boutique/category-dresses.jpg"
              alt="Dresses on the morning rail"
              width={800}
              height={800}
              loading="lazy"
              className="aspect-square h-full w-full object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 05 · Store + newsletter ---------- */

export function Lifestyle() {
  return (
    <section id="lifestyle" className="border-t border-black/10 scroll-mt-32">
      <div className="mx-auto grid max-w-[1400px] md:grid-cols-[1.1fr_0.9fr]">
        <div id="visit" className="reveal border-b border-black/10 px-4 py-14 sm:px-8 md:border-r md:border-b-0 sm:py-20 scroll-mt-32">
          <p className="text-[11px] font-semibold tracking-[0.28em] text-black/50 uppercase">05 — Our store</p>
          <h2 className="mt-3 font-display text-4xl leading-[1.04] font-semibold text-black sm:text-5xl">
            Thaltej, not a mall.
          </h2>
          <address className="mt-5 text-[15px] leading-relaxed text-black/70 not-italic">
            G-8 Harmony Icon, Hebatpur Road, near Baghban Party Plot,
            <br />
            Thaltej, Ahmedabad 380054
          </address>
          <div className="mt-7 grid grid-cols-3 divide-x divide-black/10 border-y border-black/10 text-center">
            <div className="py-4">
              <p className="text-[10.5px] font-semibold tracking-[0.2em] text-black/50 uppercase">Hours</p>
              <p className="mt-1 text-[13.5px] font-medium text-black tabular-nums">10:30–20:00</p>
            </div>
            <div className="py-4">
              <p className="text-[10.5px] font-semibold tracking-[0.2em] text-black/50 uppercase">Days</p>
              <p className="mt-1 text-[13.5px] font-medium text-black">All 7</p>
            </div>
            <div className="py-4">
              <p className="text-[10.5px] font-semibold tracking-[0.2em] text-black/50 uppercase">Trial</p>
              <p className="mt-1 text-[13.5px] font-medium text-black">With stylist</p>
            </div>
          </div>
          <div className="mt-7 flex flex-wrap gap-3">
            <a
              href="tel:+919081288988"
              className="inline-flex min-h-[48px] items-center bg-black px-7 text-[12px] font-semibold tracking-[0.2em] text-white uppercase hover:bg-[#651E2A]"
            >
              Call the store
            </a>
            <a
              href="https://www.instagram.com/jadepink_studio/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[48px] items-center border border-black/25 px-7 text-[12px] font-semibold tracking-[0.2em] text-black uppercase hover:border-black"
            >
              Instagram
            </a>
          </div>
          <p className="mt-5 text-[13.5px] text-black/55">
            <a href="mailto:shivankari@jadepink.com" className="underline underline-offset-4 hover:text-black">
              shivankari@jadepink.com
            </a>
            {" · "}
            <a href="tel:+919081288988" className="underline underline-offset-4 hover:text-black">
              +91 90812 88988
            </a>
          </p>
        </div>

        <div className="reveal bg-[#F4F2ED] px-4 py-14 sm:px-8 sm:py-20">
          <p className="text-[11px] font-semibold tracking-[0.28em] text-black/50 uppercase">The list</p>
          <h2 className="mt-3 font-display text-3xl leading-tight font-semibold text-black sm:text-4xl">
            Restocks, once a fortnight.
          </h2>
          <p className="mt-3 max-w-[40ch] text-[14.5px] leading-relaxed text-black/60">
            New rails and quiet restocks. One email, every two weeks. No daily noise.
          </p>
          <NewsletterForm />
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */

export function Footer() {
  return (
    <footer className="bg-black text-white">
      <div className="mx-auto max-w-[1400px] px-4 py-14 sm:px-8">
        <div className="grid gap-10 md:grid-cols-[1.2fr_2fr]">
          <div>
            <p className="font-display text-2xl font-semibold tracking-[0.08em] uppercase">JadePink</p>
            <p className="mt-1 text-[11px] tracking-[0.28em] text-white/50 uppercase">SJ Fashion · Thaltej</p>
            <p className="mt-4 max-w-[36ch] text-[13.5px] leading-relaxed text-white/60">
              A multi-designer boutique — heritage labels beside young experimental
              designers, under one roof in Ahmedabad.
            </p>
          </div>
          <nav className="grid grid-cols-2 gap-8 text-[13.5px] sm:grid-cols-4" aria-label="Footer links">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.24em] text-white/45 uppercase">Shop</p>
              <ul className="mt-3 space-y-2.5 text-white/75">
                <li><a href="#collections" className="hover:text-white hover:underline hover:underline-offset-4">Collections</a></li>
                <li><a href="#new" className="hover:text-white hover:underline hover:underline-offset-4">Just in</a></li>
                <li><a href="#designers" className="hover:text-white hover:underline hover:underline-offset-4">Designers</a></li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.24em] text-white/45 uppercase">Store</p>
              <ul className="mt-3 space-y-2.5 text-white/75">
                <li><a href="#visit" className="hover:text-white hover:underline hover:underline-offset-4">Visit</a></li>
                <li><a href="#journal" className="hover:text-white hover:underline hover:underline-offset-4">Journal</a></li>
                <li><a href="tel:+919081288988" className="hover:text-white hover:underline hover:underline-offset-4">+91 90812 88988</a></li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.24em] text-white/45 uppercase">Online</p>
              <ul className="mt-3 space-y-2.5 text-white/75">
                <li><a href="https://www.instagram.com/jadepink_studio/" target="_blank" rel="noreferrer" className="hover:text-white hover:underline hover:underline-offset-4">Instagram</a></li>
                <li><a href="mailto:shivankari@jadepink.com" className="hover:text-white hover:underline hover:underline-offset-4">Email</a></li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold tracking-[0.24em] text-white/45 uppercase">Staff</p>
              <ul className="mt-3 space-y-2.5 text-white/75">
                <li><Link href="/login" className="hover:text-white hover:underline hover:underline-offset-4">Sign in</Link></li>
              </ul>
            </div>
          </nav>
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-white/15 pt-5 text-[12px] tracking-[0.06em] text-white/50 sm:flex-row sm:justify-between">
          <p>© 2026 JadePink · SJ Fashion, Ahmedabad</p>
          <p>Open daily 10:30 AM – 8:00 PM</p>
        </div>
      </div>
    </footer>
  );
}
