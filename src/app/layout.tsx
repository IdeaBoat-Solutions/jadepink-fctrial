import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Cormorant_Garamond, Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/store";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/* Inter for the premium public site (scoped via .site-light). */
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });

/* Playfair Display — high-contrast luxury serif for headlines.
   Used for hero statements, section titles, and brand moments. */
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

/* Cormorant Garamond — thin, airy fashion-voice serif.
   Used for kickers, captions, delicate supporting text. */
const lux = Cormorant_Garamond({
  variable: "--font-lux",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://jadepink.com"),
  title: {
    default: "JadePink — Royal Elegance",
    template: "%s · JadePink",
  },
  description: "Considered clothing for real days — designed in Mumbai, trialled in store. Bandra Flagship, open daily 11–9.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0A0A1A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${lux.variable} ${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
        {/* Theme/tooltip/toast providers live in (admin)/layout — only the
            admin shell uses them, so public + ops routes skip that JS. */}
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
