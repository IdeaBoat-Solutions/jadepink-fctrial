"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getProductDetail, type ProductDetailLive } from "@/lib/api";
import { stockStatus } from "@/lib/inventory";
import { formatINR } from "@/lib/utils";
import { BackButton, Gallery } from "./gallery";

/* FC-facing product page: every photo on top, selling details below.
   Loads GET /api/products/[id] for the product. Commercials (cost/margin),
   supplier/reorder and the stock ledger stay on the manager-only
   /inventory/[id] page — floor staff get price, sizes/colours, availability
   and tag identifiers (SKU/barcode/design) to match the physical piece.
   Parent product id — variant size/colour is shown on the floor card that
   linked here. */

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "missing" }
  | { status: "ready"; data: ProductDetailLive };

export default function OpsProductPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    void (async () => {
      const r = await getProductDetail(id);
      if (cancelled) return;
      if (r.ok) setState({ status: "ready", data: r.data });
      else if (r.code === "PRODUCT_NOT_FOUND") setState({ status: "missing" });
      else setState({ status: "error", message: r.message });
    })();
    return () => { cancelled = true; };
  }, [id, attempt]);

  if (state.status === "loading") {
    return (
      <div className="mx-auto w-full max-w-2xl" aria-busy="true" aria-label="Loading product">
        <div className="skeleton-soft h-11 w-40 rounded-lg" />
        <div className="skeleton-soft mt-4 h-8 w-2/3 rounded-lg" />
        <div className="skeleton-soft mt-3 aspect-[4/3] w-full rounded-xl" />
        <div className="mt-4 flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-soft h-9 rounded-lg" style={{ animationDelay: `${i * 90}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  if (state.status === "missing" || state.status === "error") {
    const missing = state.status === "missing";
    return (
      <div className="mx-auto w-full max-w-2xl">
        <BackButton />
        <div className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-[#e9e2d8] bg-white p-5">
          <h1 className="text-[20px] font-bold tracking-tight text-[#211d18]">
            {missing ? "Product not found." : "Couldn't load this product."}
          </h1>
          <p className="text-[14px] text-[#57534e]">
            {missing
              ? "It may have been removed from the catalogue. Check the SKU with a manager."
              : state.message}
          </p>
          <div className="flex gap-2">
            {!missing && (
              <button
                onClick={() => setAttempt((a) => a + 1)}
                className="inline-flex min-h-[44px] items-center rounded-lg bg-[#f1ece4] px-4 text-[13.5px] font-bold text-[#211d18] transition-colors hover:bg-[#e7dfd3]"
              >
                Try again
              </button>
            )}
            <Link
              href="/products"
              className="inline-flex min-h-[44px] items-center rounded-lg border border-[#d6c9bb] px-4 text-[13.5px] font-bold text-[#57534e] transition-colors hover:border-[#211d18] hover:text-[#211d18]"
            >
              All products
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const p = state.data.product;
  const s = stockStatus(p);
  const images = (p.imageUrls ?? []).filter(Boolean);
  const stockLabel = s === "in-stock" ? `In stock · ${p.stock}` : s === "low-stock" ? `Low · ${p.stock}` : "Out of stock";

  const facts: Array<[string, string]> = [
    ["Price", `${formatINR(p.price)}${p.mrp > p.price ? ` · MRP ${formatINR(p.mrp)}` : ""}`],
    ["Sizes", p.sizes.join(", ") || "—"],
    ["Colours", p.colors.join(", ") || "—"],
    ["SKU", p.sku],
    ["Barcode", p.barcode || "—"],
    ["Category", p.categoryName || "—"],
    ["Brand", p.brandName || "—"],
    ["Design", p.designNo || "—"],
  ];

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex flex-wrap items-center gap-2">
        <BackButton />
        <Link
          href="/products"
          className="inline-flex min-h-[44px] items-center rounded-lg px-4 text-[13.5px] font-bold text-[#57534e] transition-colors hover:bg-[#f1ece4]"
        >
          All products
        </Link>
      </div>

      <div className="mt-4 rounded-xl border border-[#e9e2d8] bg-white p-4 sm:p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#7a736a]">
          {p.sku} · {p.categoryName || "Catalogue"}
        </p>
        <h1 className="mt-1 text-[24px] font-bold leading-tight tracking-tight text-[#211d18]">{p.name}</h1>
        <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-[#f1ece4] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-[#57534e]">
          <span aria-hidden className={`size-1.5 rounded-full ${s === "out-of-stock" ? "bg-[#b23a48]" : s === "low-stock" ? "bg-[#9a5b00]" : "bg-[#1c6b46]"}`} />
          {stockLabel}
        </p>

        <div className="mt-4">
          <Gallery images={images} name={p.name} />
        </div>

        <dl className="mt-4 divide-y divide-[#f1ece4] border-t border-[#f1ece4]">
          {facts.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 py-2.5 text-[14px]">
              <dt className="shrink-0 text-[#7a736a]">{k}</dt>
              <dd className={`min-w-0 text-right font-semibold text-[#211d18] ${k === "SKU" || k === "Barcode" ? "font-mono text-[13px]" : ""}`}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
