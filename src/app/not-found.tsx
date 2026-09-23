import type { Metadata } from "next";
import Link from "next/link";

/* Root 404: unknown URLs (e.g. /dashbord) land here inside the root layout,
   so globals.css tokens are available. Calm, human, one way back to work. */
export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-[#faf8f6] px-4 py-16">
      <div className="w-full max-w-sm text-center">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#78716c]">
          Page not found
        </p>
        <h1 className="mt-2 text-[28px] font-semibold tracking-tight text-[#1c1917]">
          Nothing lives at this address.
        </h1>
        <p className="mx-auto mt-2 max-w-[42ch] text-[14px] leading-relaxed text-[#78716c]">
          The link may be mistyped, or the page moved. Your visits, customers,
          and stock are untouched.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/today"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[#8e3a4e] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#722f3f]"
          >
            Back to today
          </Link>
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[#d6c9bb] bg-white px-5 text-[14px] font-semibold text-[#1c1917] transition-colors hover:border-[#1c1917]"
          >
            Boutique home
          </Link>
        </div>
      </div>
    </main>
  );
}
