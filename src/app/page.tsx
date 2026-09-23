import type { Metadata } from "next";
import { Navbar } from "@/components/site/navbar";
import { Hero } from "@/components/site/hero";
import {
  Categories,
  Designers,
  Favourites,
  Footer,
  Lifestyle,
  Reviews,
} from "@/components/site/sections";

import { SiteMotion } from "@/components/site/motion";

export const metadata: Metadata = {
  title: "JadePink — Multi-designer boutique · Thaltej, Ahmedabad",
  description:
    "JadePink (SJ Fashion) is a multi-designer boutique in Thaltej, Ahmedabad — heritage and luxury designer labels plus young, experimental designers. Clothing, footwear, jewellery, bridal. Open daily 10:30 AM–8 PM.",
  alternates: { canonical: "https://jadepink.com/" },
  openGraph: {
    type: "website",
    url: "https://jadepink.com/",
    siteName: "JadePink",
    title: "JadePink — Multi-designer boutique",
    description: "Unique, handpicked heritage and luxury labels in Thaltej, Ahmedabad. Designing your fashion, every day 10:30 AM–8 PM.",
  },
  twitter: {
    card: "summary_large_image",
    title: "JadePink — Multi-designer boutique",
    description: "Heritage, luxury and young experimental labels under one roof. Thaltej, Ahmedabad.",
  },
};

const STORE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "ClothingStore",
  name: "JadePink — A Multi Designer Store",
  address: {
    "@type": "PostalAddress",
    streetAddress: "G-8 Harmony Icon, near Baghban Party Plot, Hebatpur Road, Thaltej",
    addressLocality: "Ahmedabad",
    addressRegion: "Gujarat",
    postalCode: "380054",
    addressCountry: "IN",
  },
  telephone: "+91-90812-88988",
  email: "shivankari@jadepink.com",
  openingHours: "Mo-Su 10:30-20:00",
  aggregateRating: { "@type": "AggregateRating", ratingValue: "4.9", reviewCount: "2300" },
};

export default function PublicLanding() {
  return (
    <div className="min-h-dvh bg-white text-[#101010] antialiased">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-black focus:px-4 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STORE_JSONLD) }} />
      <SiteMotion />
      <Navbar />
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <Hero />
        <Categories />
        <Favourites />
        <Designers />
        <Reviews />
        <Lifestyle />
      </main>
      <Footer />
    </div>
  );
}
