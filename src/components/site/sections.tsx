import Link from "next/link";
import Image from "next/image";

/* JadePink boutique sections — mirrors jadepink.com:
   categories, about, designers, gallery, events, clients, visit.
   Deep navy + gold, serif display, ornamental dividers. Server components. */

/* ---------- Ornament divider (the boutique "separator" motif) ---------- */

function Ornament() {
  return (
    <div aria-hidden className="flex items-center justify-center gap-3">
      <span className="h-[1px] w-14 bg-gradient-to-r from-transparent to-[var(--color-gold)]" />
      <span className="inline-block size-[7px] rotate-45 border border-[var(--color-gold)]" />
      <span className="h-[1px] w-14 bg-gradient-to-l from-transparent to-[var(--color-gold)]" />
    </div>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 text-[10px] font-semibold tracking-[0.3em] uppercase text-[var(--color-gold)]">
      {children}
    </p>
  );
}

/* ---------- Ticker ---------- */

export function Marquee({ items }: { items: string[] }) {
  const row = [...items, ...items];
  return (
    <div className="overflow-hidden border-y border-[var(--color-gold-border)] bg-[var(--color-royal)]/40 py-3.5" aria-label="Store notes">
      <div className="sl-ticker-track">
        {row.map((t, i) => (
          <span
            key={i}
            aria-hidden={i >= items.length}
            className="flex items-center whitespace-nowrap pr-10 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-gold)]"
          >
            {t}
            <span aria-hidden className="ml-10 text-[var(--color-gold-light)]">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Categories: clothing / footwear / jewellery ---------- */

const CRAFTS = [
  {
    name: "Clothing",
    line: "Where each pick is designed like it was tailor-made for you",
    seed: "jadepink-craft-clothing",
  },
  {
    name: "Footwear",
    line: "With this footwear the world will actually be at the tip of your toe",
    seed: "jadepink-craft-footwear",
  },
  {
    name: "Jewellery",
    line: "A spiffy range of rings for the most kissable hands in town",
    seed: "jadepink-craft-jewellery",
  },
];

export function Categories() {
  return (
    <section id="categories" aria-labelledby="categories-h" className="relative scroll-mt-24">
      <div className="mx-auto max-w-[1280px] px-6 py-20 sm:px-8 lg:px-12">
        <header data-sl-reveal className="sl-reveal mx-auto max-w-[52ch] text-center">
          <Kicker>Shop with us for unique</Kicker>
          <h2 id="categories-h" className="font-display text-[32px] text-[var(--color-ink)] sm:text-[48px] sm:leading-[1.1]">
            Multi-designer <em>boutique</em>
          </h2>
          <div className="mt-5"><Ornament /></div>
        </header>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {CRAFTS.map((c, i) => (
            <article
              key={c.name}
              data-sl-reveal
              className="sl-reveal group text-center"
              style={{ "--sl-delay": `${Math.min(i * 60, 180)}ms` } as React.CSSProperties}
            >
              <div className="sl-plate relative mx-auto aspect-[4/5] max-w-[360px]">
                <Image
                  src={`https://picsum.photos/seed/${c.seed}/720/900`}
                  alt={`${c.name} at JadePink`}
                  fill
                  sizes="(max-width: 768px) 100vw, 360px"
                />
              </div>
              <h3 className="font-display mt-5 text-[24px] text-[var(--color-ink)]">{c.name}</h3>
              <div className="mt-3"><Ornament /></div>
              <p className="mx-auto mt-3 max-w-[34ch] text-[14px] leading-relaxed text-[var(--color-muted)]">{c.line}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- About: JadePink / SJ Fashion ---------- */

const HOUSE_NOTES = [
  {
    title: "Bridal Range",
    body: "Handpicked, season's favourite bridal range — tried on with a stylist, not pulled off a rail alone.",
  },
  {
    title: "Everyday Chic",
    body: "Kurtas, tops, dresses, formals and casuals. Your quick style pitstop before a party or a brunch date — accessories to go with it.",
  },
];

export function About() {
  return (
    <section id="about" aria-labelledby="about-h" className="relative scroll-mt-24 border-t border-[var(--color-gold-border)]">
      <div className="mx-auto max-w-[1280px] px-6 py-20 sm:px-8 lg:px-12">
        <div className="grid items-start gap-12 lg:grid-cols-12">
          <div data-sl-reveal className="sl-reveal lg:col-span-5">
            <div className="lg:sticky lg:top-24">
              <Kicker>SJ Fashion presents</Kicker>
              <h2 id="about-h" className="font-display text-[40px] leading-[1.05] text-[var(--color-ink)] sm:text-[56px]">
                Jade<em>Pink</em>
              </h2>
              <div className="mt-5 flex justify-start"><Ornament /></div>
              <p className="mt-5 max-w-[46ch] text-[15px] leading-[1.75] text-[var(--color-muted)]">
                Fashion obsessed. Die-hard stylists. We are a multi-designer boutique —
                shop with us for a unique, handpicked range of heritage and luxury
                designer labels and young, experimental designer labels.
              </p>
              <p className="mt-3 max-w-[46ch] text-[15px] leading-[1.75] text-[var(--color-muted)]">
                Owned by Shivankari Prateek Singhi — Jade Pink is the registered,
                operating store name of the house.
              </p>
            </div>
          </div>
          <div className="lg:col-span-7">
            <div className="grid gap-5 sm:grid-cols-2">
              {HOUSE_NOTES.map((n, i) => (
                <article
                  key={n.title}
                  data-sl-reveal
                  className="sl-reveal border border-[var(--color-gold-border)] bg-[var(--color-paper)] p-7"
                  style={{ "--sl-delay": `${Math.min(i * 60, 120)}ms` } as React.CSSProperties}
                >
                  <h3 className="font-display text-[22px] text-[var(--color-ink)]">{n.title}</h3>
                  <div className="mt-3 flex justify-start"><Ornament /></div>
                  <p className="mt-3 text-[14px] leading-relaxed text-[var(--color-muted)]">{n.body}</p>
                </article>
              ))}
            </div>
            <div data-sl-reveal className="sl-reveal sl-plate relative mt-5 aspect-[16/8]">
              <Image
                src="https://picsum.photos/seed/jadepink-atelier-rail/1280/640"
                alt="Designer rails inside the JadePink boutique"
                fill
                sizes="(max-width: 1024px) 100vw, 720px"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Designers ---------- */

const DESIGNER_GROUPS = [
  {
    craft: "For Clothing",
    names: ["Diya Mehta", "Meghna Panchmatia", "Avadh", "Naina Seth", "Kaveri", "Zeel Doshi Thakkar", "Label Osa", "Upasana Gupta", "Eedum", "Seams", "Sisa", "Adara"],
  },
  {
    craft: "For Footwear",
    names: ["Vareli Bafna", "Preet Kaur", "Jutte"],
  },
  {
    craft: "For Jewellery",
    names: ["Brashbug", "Diosaparis", "Silver Shine", "Geet Jewels", "Just Shraddha's", "Ltd Edition", "Aadikara"],
  },
];

export function Designers() {
  return (
    <section id="designers" aria-labelledby="designers-h" className="relative scroll-mt-24 border-t border-[var(--color-gold-border)]">
      <div className="mx-auto max-w-[1280px] px-6 py-20 sm:px-8 lg:px-12">
        <header data-sl-reveal className="sl-reveal mx-auto max-w-[56ch] text-center">
          <Kicker>Our designers</Kicker>
          <h2 id="designers-h" className="font-display text-[32px] text-[var(--color-ink)] sm:text-[48px] sm:leading-[1.1]">
            Heritage, luxury <em>&amp;</em> young experiments
          </h2>
          <div className="mt-5"><Ornament /></div>
        </header>
        <div className="mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-3">
          {DESIGNER_GROUPS.map((g, i) => (
            <article
              key={g.craft}
              data-sl-reveal
              className="sl-reveal border border-[var(--color-gold-border)] bg-[var(--color-paper)] p-7"
              style={{ "--sl-delay": `${Math.min(i * 60, 120)}ms` } as React.CSSProperties}
            >
              <h3 className="font-display text-[20px] text-[var(--color-gold-dark)]">{g.craft}</h3>
              <ul className="mt-4 space-y-2.5">
                {g.names.map((n) => (
                  <li key={n} className="flex items-baseline gap-2.5 text-[14.5px] text-[var(--color-ink)]">
                    <span aria-hidden className="inline-block size-[5px] shrink-0 rotate-45 border border-[var(--color-gold)]" />
                    {n}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <p data-sl-reveal className="sl-reveal mt-8 text-center text-[13px] tracking-[0.04em] text-[var(--color-muted)]">
          Plus Anuj Bhutani, Rishi Vibhuti, Chambray &amp; Co, BhuSattva, Pinki Sinha — and new labels every season.
        </p>
      </div>
    </section>
  );
}

/* ---------- Our designs gallery ---------- */

const LOOKS = [
  { by: "Diya Mehta", seed: "jadepink-look-diya-1" },
  { by: "Naina Seth", seed: "jadepink-look-naina-1" },
  { by: "Kaveri", seed: "jadepink-look-kaveri-1" },
  { by: "Kaveri", seed: "jadepink-look-kaveri-2" },
  { by: "Meghna Panchmatia", seed: "jadepink-look-meghna-1" },
  { by: "Meghna Panchmatia", seed: "jadepink-look-meghna-2" },
  { by: "Avadh", seed: "jadepink-look-avadh-1" },
  { by: "Avadh", seed: "jadepink-look-avadh-2" },
];

export function Gallery() {
  return (
    <section id="designs" aria-labelledby="designs-h" className="relative scroll-mt-24 border-t border-[var(--color-gold-border)]">
      <div className="mx-auto max-w-[1280px] px-6 py-20 sm:px-8 lg:px-12">
        <header data-sl-reveal className="sl-reveal mx-auto max-w-[56ch] text-center">
          <Kicker>Our designs</Kicker>
          <h2 id="designs-h" className="font-display text-[32px] text-[var(--color-ink)] sm:text-[48px] sm:leading-[1.1]">
            Shop her latest, <em>only</em> at JadePink
          </h2>
          <div className="mt-5"><Ornament /></div>
        </header>
        <div className="mt-12 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
          {LOOKS.map((l, i) => (
            <figure
              key={l.seed}
              data-sl-reveal
              className="sl-reveal group"
              style={{ "--sl-delay": `${Math.min(i * 40, 200)}ms` } as React.CSSProperties}
            >
              <div className="sl-plate relative aspect-[3/4]">
                <Image
                  src={`https://picsum.photos/seed/${l.seed}/600/800`}
                  alt={`Design by ${l.by}, stocked at JadePink`}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 280px"
                />
              </div>
              <figcaption className="mt-3 text-center">
                <p className="text-[13px] font-semibold text-[var(--color-ink)]">By {l.by}</p>
                <p className="mt-0.5 text-[12px] text-[var(--color-muted)]">Shop the collection only at JadePink</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Events ---------- */

const EVENTS = [
  { title: "The Dress Edit", note: "A weekend rail of occasion dresses, styled on you.", tag: "Latest fashion" },
  { title: "Jewellery Trunk Show", note: "One-of-a-kind rings and ear pieces, straight from the makers.", tag: "Latest fashion" },
  { title: "Accessory Days", note: "Potlis, belts and finishing touches for festive season.", tag: "Latest fashion" },
  { title: "Footwear Pop-up", note: "Juttis and heels you won't find on any shelf nearby.", tag: "Latest fashion" },
];

export function Events() {
  return (
    <section id="events" aria-labelledby="events-h" className="relative scroll-mt-24 border-t border-[var(--color-gold-border)]">
      <div className="mx-auto max-w-[1280px] px-6 py-20 sm:px-8 lg:px-12">
        <header data-sl-reveal className="sl-reveal mx-auto max-w-[56ch] text-center">
          <Kicker>Events</Kicker>
          <h2 id="events-h" className="font-display text-[32px] text-[var(--color-ink)] sm:text-[48px] sm:leading-[1.1]">
            A modern boutique <em>with</em> vintage charm
          </h2>
          <div className="mt-5"><Ornament /></div>
        </header>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {EVENTS.map((e, i) => (
            <article
              key={e.title}
              data-sl-reveal
              className="sl-reveal border border-[var(--color-gold-border)] bg-[var(--color-paper)] p-7"
              style={{ "--sl-delay": `${Math.min(i * 60, 180)}ms` } as React.CSSProperties}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--color-gold)]">{e.tag}</p>
              <h3 className="font-display mt-2 text-[22px] text-[var(--color-ink)]">{e.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--color-muted)]">{e.note}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------- Happy clients ---------- */

export function Reviews() {
  return (
    <section id="clients" aria-labelledby="clients-h" className="relative scroll-mt-24 border-t border-[var(--color-gold-border)]">
      <div className="mx-auto max-w-[1280px] px-6 py-20 text-center sm:px-8 lg:px-12">
        <div data-sl-reveal className="sl-reveal mx-auto max-w-[56ch]">
          <Kicker>Our happy clients</Kicker>
          <h2 id="clients-h" className="font-display text-[32px] text-[var(--color-ink)] sm:text-[44px]">
            Awesome collection. <em>Must visit.</em>
          </h2>
          <div className="mt-5"><Ornament /></div>
          <blockquote className="font-lux mt-6 text-[22px] italic leading-relaxed text-[var(--color-ink)] sm:text-[26px]">
            “Bridal to brunch — everything fits like it was made for me. I don&apos;t shop anywhere else in Ahmedabad now.”
          </blockquote>
          <p className="mt-4 text-[13px] font-semibold uppercase tracking-[0.2em] text-[var(--color-gold)]">Nirali Pandya</p>
        </div>
      </div>
    </section>
  );
}

/* ---------- Visit ---------- */

export function Visit() {
  return (
    <section id="visit" aria-labelledby="visit-h" className="relative scroll-mt-24 border-t border-[var(--color-gold-border)]">
      <div className="mx-auto max-w-[1280px] px-6 py-20 sm:px-8 lg:px-12">
        <div className="grid gap-10 lg:grid-cols-12">
          <div data-sl-reveal className="sl-reveal lg:col-span-6">
            <Kicker>Contact us</Kicker>
            <h2 id="visit-h" className="font-display text-[32px] text-[var(--color-ink)] sm:text-[48px] sm:leading-[1.1]">
              Come, <em>try it on</em>
            </h2>
            <div className="mt-5 flex justify-start"><Ornament /></div>
            <address className="mt-6 text-[15px] not-italic leading-[1.8] text-[var(--color-muted)]">
              <strong className="text-[var(--color-ink)]">JadePink — A Multi Designer Store</strong>
              <br />
              SJ Fashion · G-8 Harmony Icon,
              <br />
              near Baghban Party Plot, Hebatpur Road,
              <br />
              Thaltej, Ahmedabad, Gujarat — 380054
            </address>
            <dl className="mt-5 space-y-2 text-[15px] text-[var(--color-muted)]">
              <div className="flex gap-3">
                <dt className="w-20 shrink-0 font-semibold text-[var(--color-ink)]">Hours</dt>
                <dd>10:30 AM – 8:00 PM, every day</dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-20 shrink-0 font-semibold text-[var(--color-ink)]">Phone</dt>
                <dd><a href="tel:+919081288988" className="hover:text-[var(--color-gold)]">+91 90812 88988</a></dd>
              </div>
              <div className="flex gap-3">
                <dt className="w-20 shrink-0 font-semibold text-[var(--color-ink)]">Email</dt>
                <dd><a href="mailto:shivankari@jadepink.com" className="hover:text-[var(--color-gold)]">shivankari@jadepink.com</a></dd>
              </div>
            </dl>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="https://www.instagram.com/jadepink_studio/" target="_blank" rel="noreferrer" className="sl-btn sl-btn-gold">
                @jadepink_studio
              </a>
              <a href="https://www.facebook.com/jadepinkthestudio/" target="_blank" rel="noreferrer" className="sl-btn sl-btn-ghost">
                Facebook
              </a>
            </div>
          </div>
          <div data-sl-reveal className="sl-reveal lg:col-span-6">
            <div className="sl-plate relative aspect-[4/3] lg:aspect-auto lg:h-full lg:min-h-[420px]">
              <Image
                src="https://picsum.photos/seed/jadepink-storefront-thaltej/1000/800"
                alt="The JadePink boutique storefront in Thaltej, Ahmedabad"
                fill
                sizes="(max-width: 1024px) 100vw, 560px"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-gold-border)] bg-[var(--color-royal)]">
      <div className="mx-auto grid max-w-[1280px] gap-10 px-6 py-14 sm:px-8 md:grid-cols-[1.6fr_1fr_1fr_1fr] lg:px-12">
        <div>
          <p className="text-[18px] font-bold tracking-[0.2em] text-[var(--color-gold)]">
            JADE<span className="font-display italic">PINK</span>
          </p>
          <p className="mt-3 max-w-[34ch] text-[13.5px] leading-relaxed text-white/60">
            A multi-designer boutique — heritage and luxury labels, young experimental
            designers, all under one roof in Thaltej, Ahmedabad.
          </p>
        </div>
        <nav aria-label="Boutique">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--color-gold)]">Boutique</p>
          <ul className="mt-4 space-y-2.5 text-[14px] text-white/70">
            <li><Link href="#about" className="hover:text-[var(--color-gold-light)]">About us</Link></li>
            <li><Link href="#designers" className="hover:text-[var(--color-gold-light)]">Our designers</Link></li>
            <li><Link href="#designs" className="hover:text-[var(--color-gold-light)]">Our designs</Link></li>
            <li><Link href="#events" className="hover:text-[var(--color-gold-light)]">Events</Link></li>
          </ul>
        </nav>
        <nav aria-label="Visit">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--color-gold)]">Visit</p>
          <ul className="mt-4 space-y-2.5 text-[14px] text-white/70">
            <li><Link href="#visit" className="hover:text-[var(--color-gold-light)]">Thaltej, Ahmedabad</Link></li>
            <li><a href="tel:+919081288988" className="hover:text-[var(--color-gold-light)]">+91 90812 88988</a></li>
            <li><a href="mailto:shivankari@jadepink.com" className="hover:text-[var(--color-gold-light)]">shivankari@jadepink.com</a></li>
          </ul>
        </nav>
        <nav aria-label="Follow">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[var(--color-gold)]">Follow</p>
          <ul className="mt-4 space-y-2.5 text-[14px] text-white/70">
            <li><a href="https://www.instagram.com/jadepink_studio/" target="_blank" rel="noreferrer" className="hover:text-[var(--color-gold-light)]">Instagram</a></li>
            <li><a href="https://www.facebook.com/jadepinkthestudio/" target="_blank" rel="noreferrer" className="hover:text-[var(--color-gold-light)]">Facebook</a></li>
            <li><Link href="/login" className="hover:text-[var(--color-gold-light)]">Staff sign in</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-2 px-6 py-5 text-[12.5px] text-white/45 sm:px-8 lg:px-12">
          <p>© JadePink · SJ Fashion. All rights reserved.</p>
          <p>#unique #luxury_designer #best_fashion #lifestyle</p>
        </div>
      </div>
    </footer>
  );
}
