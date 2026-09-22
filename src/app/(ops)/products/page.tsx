"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { useStore } from "@/lib/store";
import { stockStatus } from "@/lib/inventory";
import type { Category, Product } from "@/lib/inventory";
import { formatINR } from "@/lib/utils";
import { PaginationControls, usePageParam } from "@/components/pagination";

/* Products catalogue — every product with ALL its details (image, SKU,
   barcode, brand, design, category, supplier, price/MRP, stock, sizes,
   colours, HSN), server search plus client filters. Reads the same live
   catalogue as Inventory (/api/products); detail lives on /inventory/[id]. */

const FETCH_SIZE = 1000;
const GRID_SIZE = 24;

type SortKey = "newest" | "price-asc" | "price-desc" | "stock-desc" | "name";

const SORT_LABEL: Record<SortKey, string> = {
  newest: "Newest first",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  "stock-desc": "Stock: high to low",
  name: "Name A–Z",
};

function distinct(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map((v) => (v ?? "").trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "en-IN"),
  );
}

function ProductsInner() {
  const { user } = useStore();
  /* Detail + Add live in the manager-only admin shell — FCs get the full
     card details inline instead of a link that would bounce them to /today. */
  const isManager = user?.role === "manager";
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [cat, setCat] = useState("all");
  const [stock, setStock] = useState("all");
  const [supplier, setSupplier] = useState("all");
  const [brand, setBrand] = useState("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [cats, setCats] = useState<Category[]>([]);
  const [rows, setRows] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const resetKey = `${debouncedQ}|${cat}|${stock}|${supplier}|${brand}|${minPrice}|${maxPrice}|${sort}`;
  const { page, setPage } = usePageParam(resetKey);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/categories", { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!cancelled && Array.isArray(json.data)) setCats(json.data);
      } catch { /* filter still works without categories */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErr("");
      const p = new URLSearchParams();
      if (debouncedQ) p.set("q", debouncedQ);
      if (cat !== "all") p.set("category", cat);
      if (stock !== "all") p.set("stock", stock);
      p.set("page", "1");
      p.set("pageSize", String(FETCH_SIZE));
      try {
        const res = await fetch(`/api/products?${p.toString()}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({ data: [] }));
        if (cancelled) return;
        if (!res.ok) throw new Error(json.error ?? "Could not load products");
        setRows(Array.isArray(json.data) ? json.data : []);
      } catch (e) {
        if (!cancelled) {
          setRows([]);
          setErr(e instanceof Error ? e.message : "Could not load products");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [debouncedQ, cat, stock]);

  const suppliers = useMemo(() => distinct(rows.map((r) => r.supplierName)), [rows]);
  const brands = useMemo(() => distinct(rows.map((r) => r.brandName)), [rows]);

  const filtered = useMemo(() => {
    const lo = minPrice === "" ? -Infinity : Number(minPrice);
    const hi = maxPrice === "" ? Infinity : Number(maxPrice);
    const out = rows.filter((r) => {
      if (supplier !== "all" && r.supplierName !== supplier) return false;
      if (brand !== "all" && (r.brandName ?? "") !== brand) return false;
      if (Number.isFinite(lo) && r.price < lo) return false;
      if (Number.isFinite(hi) && r.price > hi) return false;
      return true;
    });
    switch (sort) {
      case "price-asc": out.sort((a, b) => a.price - b.price); break;
      case "price-desc": out.sort((a, b) => b.price - a.price); break;
      case "stock-desc": out.sort((a, b) => b.stock - a.stock); break;
      case "name": out.sort((a, b) => a.name.localeCompare(b.name, "en-IN")); break;
      default: break; // newest — server already orders by updated_at desc
    }
    return out;
  }, [rows, supplier, brand, minPrice, maxPrice, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / GRID_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = filtered.length === 0 ? 0 : (safePage - 1) * GRID_SIZE + 1;
  const end = Math.min(filtered.length, safePage * GRID_SIZE);
  const visible = filtered.slice((safePage - 1) * GRID_SIZE, safePage * GRID_SIZE);

  const hasFilters =
    q !== "" || cat !== "all" || stock !== "all" || supplier !== "all" ||
    brand !== "all" || minPrice !== "" || maxPrice !== "";
  const clearAll = () => {
    setQ(""); setCat("all"); setStock("all"); setSupplier("all");
    setBrand("all"); setMinPrice(""); setMaxPrice(""); setPage(1);
  };

  return (
    <div className="staff-page">
      <PageHeader
        kicker="Catalogue"
        title="Products"
        sub={`${filtered.length} styles · search, filter, open for full detail.`}
        actions={isManager ? <Button className="group min-h-[44px] bg-[#b4234d] text-white transition-all duration-150 hover:-translate-y-px hover:bg-[#93183d] active:translate-y-0" asChild><Link href="/inventory/new"><Plus data-icon="inline-start" className="transition-transform duration-150 group-hover:rotate-90" /> Add product</Link></Button> : undefined}
      />

      <Card className="shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
        <CardContent className="flex flex-col gap-2 pt-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Search name, SKU, barcode, brand, design…"
              className="min-h-[48px] rounded-xl pl-10 transition-all focus:ring-4 focus:ring-[#b4234d]/10"
              aria-label="Search products"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 grid min-h-[36px] w-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95">✕</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
            <Select value={cat} onValueChange={(v) => { setCat(v); setPage(1); }}>
              <SelectTrigger className="min-h-[48px] w-full rounded-xl" aria-label="Category"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.productCount})</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={supplier} onValueChange={(v) => { setSupplier(v); setPage(1); }}>
              <SelectTrigger className="min-h-[48px] w-full rounded-xl" aria-label="Supplier"><SelectValue placeholder="Supplier" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All suppliers</SelectItem>
                {suppliers.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={brand} onValueChange={(v) => { setBrand(v); setPage(1); }}>
              <SelectTrigger className="min-h-[48px] w-full rounded-xl" aria-label="Brand"><SelectValue placeholder="Brand" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All brands</SelectItem>
                {brands.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={stock} onValueChange={(v) => { setStock(v); setPage(1); }}>
              <SelectTrigger className="min-h-[48px] w-full rounded-xl" aria-label="Stock"><SelectValue placeholder="Stock" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stock</SelectItem>
                <SelectItem value="in-stock">In stock</SelectItem>
                <SelectItem value="low-stock">Low stock</SelectItem>
                <SelectItem value="out-of-stock">Out of stock</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="min-h-[48px] w-full rounded-xl" aria-label="Sort"><SelectValue placeholder="Sort" /></SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => <SelectItem key={k} value={k}>{SORT_LABEL[k]}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Input
                value={minPrice}
                onChange={(e) => { setMinPrice(e.target.value.replace(/[^0-9]/g, "")); setPage(1); }}
                placeholder="Min ₹"
                inputMode="numeric"
                aria-label="Minimum price"
                className="tnum min-h-[48px] rounded-xl"
              />
              <Input
                value={maxPrice}
                onChange={(e) => { setMaxPrice(e.target.value.replace(/[^0-9]/g, "")); setPage(1); }}
                placeholder="Max ₹"
                inputMode="numeric"
                aria-label="Maximum price"
                className="tnum min-h-[48px] rounded-xl"
              />
            </div>
          </div>
          {hasFilters && (
            <button onClick={clearAll} className="inline-flex min-h-[44px] items-center self-start rounded-xl border px-4 text-[13.5px] font-semibold transition-all hover:-translate-y-px hover:border-foreground">
              Clear all filters
            </button>
          )}
        </CardContent>
      </Card>

      {err && (
        <p role="alert" className="rounded-xl border border-[#f0b6b9] bg-[#fdecec] px-4 py-3 text-[13.5px] font-medium text-[#7d1a1f]">{err}</p>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Loading products">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="skeleton-soft h-[280px] rounded-2xl" style={{ animationDelay: `${i * 100}ms` }} />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card className="overflow-hidden">
          <CardContent className="flex flex-col items-center gap-1.5 px-6 py-12 text-center">
            <span aria-hidden className="empty-plate"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg></span>
            <p className="mt-1 text-[15px] font-semibold">No styles match.</p>
            <p className="text-[13.5px] text-muted-foreground">Try a shorter search or clear the filters.</p>
            <button onClick={clearAll} className="mt-2 inline-flex min-h-[44px] items-center rounded-xl border px-4 text-[13.5px] font-semibold transition-all hover:-translate-y-px hover:border-foreground">Clear filters</button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((p) => {
              const s = stockStatus(p);
              const cls = "group overflow-hidden rounded-2xl border bg-card transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-16px_rgba(28,25,23,0.35)]";
              const body = (
                <>
                  <div className="flex gap-3 p-4">
                    {p.imageUrl || p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- catalogue photos come from per-project storage hosts
                      <img src={p.imageUrl ?? p.image} alt="" loading="lazy" decoding="async" className="size-20 shrink-0 rounded-xl border object-cover" />
                    ) : (
                      <span aria-hidden className="grid size-20 shrink-0 place-items-center rounded-xl bg-muted text-[24px] font-bold text-muted-foreground">{(p.name || "?").charAt(0)}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold tracking-tight">{p.name}</p>
                      <p className="tnum truncate font-mono text-[12px] text-muted-foreground">{p.sku}</p>
                      <p className="tnum mt-1 text-[16px] font-semibold tracking-tight">
                        {formatINR(p.price)}
                        {p.mrp > p.price && <span className="ml-1.5 text-[12px] font-normal text-muted-foreground line-through">{formatINR(p.mrp)}</span>}
                      </p>
                      <div className="mt-1.5">
                        <Badge variant={s === "out-of-stock" ? "destructive" : s === "low-stock" ? "secondary" : "default"}>
                          {s === "in-stock" ? `In stock · ${p.stock}` : s === "low-stock" ? `Low · ${p.stock}` : "Out of stock"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t bg-muted/30 px-4 py-3 text-[12.5px]">
                    <Detail label="Category" value={p.categoryName} />
                    <Detail label="Supplier" value={p.supplierName} />
                    <Detail label="Brand" value={p.brandName} />
                    <Detail label="Design" value={p.designNo} />
                    <Detail label="Barcode" value={p.barcode} mono />
                    <Detail label="Size · Colour" value={[p.sizes.join(", "), p.colors.join(", ")].filter(Boolean).join(" · ")} />
                    <Detail label="HSN" value={p.hsnCode} mono />
                    <Detail label="Cost" value={p.cost > 0 ? formatINR(p.cost) : ""} tnum />
                  </dl>
                </>
              );
              return isManager ? (
                <Link key={p.id} href={`/inventory/${p.id}`} className={cls}>
                  {body}
                </Link>
              ) : (
                <article key={p.id} className={cls}>
                  {body}
                </article>
              );
            })}
          </div>
          <PaginationControls
            page={safePage} totalPages={totalPages} total={filtered.length}
            start={start} end={end} onPage={setPage}
          />
        </>
      )}
    </div>
  );
}

function Detail({ label, value, mono, tnum }: { label: string; value?: string | null; mono?: boolean; tnum?: boolean }) {
  if (!value) return <div><dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="text-muted-foreground">—</dd></div>;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={`truncate font-medium ${mono ? "font-mono" : ""} ${tnum ? "tnum" : ""}`} title={value}>{value}</dd>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <Suspense fallback={<div aria-busy="true" aria-label="Loading" className="skeleton-soft h-[420px] rounded-2xl" />}>
      <ProductsInner />
    </Suspense>
  );
}
