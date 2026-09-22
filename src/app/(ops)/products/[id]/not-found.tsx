import Link from "next/link";

/* Scanned a barcode (or followed a link) for a product that no longer
   exists — deleted, or a mistyped id. Calm, one screen, two doors out:
   back to the catalogue, or back to whatever came before. */
export default function OpsProductNotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="rounded-xl border border-[#e9e2d8] bg-white p-8 text-center sm:p-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#7a736a]">
          Product not found
        </p>
        <h1 className="mt-2 text-[22px] font-bold tracking-tight text-[#211d18]">
          This style isn&apos;t on file.
        </h1>
        <p className="mx-auto mt-2 max-w-[44ch] text-[14px] leading-relaxed text-[#57534e]">
          It may have been removed from the catalogue, or the barcode
          didn&apos;t scan cleanly. Check the code and try again.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Link
            href="/products"
            className="inline-flex min-h-[44px] items-center rounded-lg bg-[#23403a] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#1a312c]"
          >
            Back to products
          </Link>
          <Link
            href="/today"
            className="inline-flex min-h-[44px] items-center rounded-lg border border-[#d6c9bb] px-5 text-[14px] font-semibold text-[#211d18] transition-colors hover:border-[#211d18]"
          >
            Back to floor
          </Link>
        </div>
      </div>
    </div>
  );
}
