import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Cormorant_Garamond, Jost, Newsreader, Outfit, Playfair_Display } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { StoreProvider } from "@/lib/store";
import { THEME_INIT_SCRIPT } from "@/components/theme";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/* Jost for the boutique landing (scoped via .boutique -> --font-body). */
const jost = Jost({ variable: "--font-jost", subsets: ["latin"], display: "swap" });

/* Playfair Display — high-contrast luxury serif for headlines.
   Used for hero statements, section titles, and brand moments.
   Three weights only: keeps font payload small so first paint + route
   entries stay instant. */
const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

/* Cormorant Garamond — thin, airy fashion-voice serif.
   Used for kickers, captions, delicate supporting text. */
const lux = Cormorant_Garamond({
  variable: "--font-lux",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

/* Floor OS: Outfit for operational reading, Newsreader only for customer names. */
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://jadepink.com"),
  title: {
    default: "JadePink — Royal Elegance",
    template: "%s · JadePink",
  },
  description: "Considered clothing for real days — heritage and luxury labels plus young designers, trialled in store. Thaltej, Ahmedabad, open daily 10:30 AM–8 PM.",
  icons: {
    icon: "/logo.jpeg",
    shortcut: "/logo.jpeg",
    apple: "/logo.jpeg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0A0A1A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${lux.variable} ${jost.variable} ${outfit.variable} ${newsreader.variable} h-full antialiased`}>
      <head>
        {/* Pre-paint theme class: runs before first paint so dark-mode staff
            never flash light. next/script is the sanctioned path — a raw
            <script> in the React tree trips Next 16's script-tag error. */}
        <Script id="staff-theme" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-full">
        {/* Theme/tooltip/toast providers live in (admin)/layout — only the
            admin shell uses them, so public + ops routes skip that JS. */}
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
