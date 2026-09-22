import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct } from "@/features/catalogue/repository";
import { stockStatus } from "@/lib/inventory";
import { formatINR } from "@/lib/utils";
import { BackButton, Gallery } from "./gallery";

/* FC-facing product page: every photo on top, all details below.
   Lives in the (ops) shell so floor staff can open it from a scanned
   product name; commercials (cost/margin) stay on the manager-only
   /inventory/[id] page. Parent product id — variant size/colour is shown
   on the floor card that linked here. */

export default async function OpsProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getProduct(id);
  if (!p) notFound();

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
    ["Supplier", p.supplierName || "—"],
    ["HSN", p.hsnCode || "—"],
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
              <dd className={`min-w-0 text-right font-semibold text-[#211d18] ${k === "SKU" || k === "Barcode" || k === "HSN" ? "font-mono text-[13px]" : ""}`}>
                {v}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
