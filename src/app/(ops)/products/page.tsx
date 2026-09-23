"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { useStore } from "@/lib/store";
import { listBrands, listCategories, listProducts } from "@/lib/api";
import { stockStatus } from "@/lib/inventory";
import type { Category, Product } from "@/lib/inventory";
import { formatINR } from "@/lib/utils";
import { PaginationControls, usePageParam } from "@/components/pagination";

/* Products catalogue — server search + server paging over the live catalogue
   (/api/products). Every filter lives in the URL so refresh, back and share
   keep the exact grid. Detail lives on /inventory/[id] for managers,
   /products/[id] for FCs. */

const PAGE_SIZE = 24;

type SortKey = "newest" | "price-asc" | "price-desc" | "stock-desc" | "name";

const SORT_LABEL: Record<SortKey, string> = {
  newest: "Newest first",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  "stock-desc": "Stock: high to low",
  name: "Name A–Z",
};

const SORTS: SortKey[] = ["newest", "price-asc", "price-desc", "stock-desc", "name"];

function ProductsInner() {
  const { user } = useStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  /* Detail lives on /inventory/[id] for managers, /products/[id] for FCs. */
  const isManager = user?.role === "manager";
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [debouncedQ, setDebouncedQ] = useState(() => (searchParams.get("q") ?? "").trim());
  const [cat, setCat] = useState(() => searchParams.get("category") ?? "all");
  const [stock, setStock] = useState(() => searchParams.get("stock") ?? "all");
  const [brand, setBrand] = useState(() => searchParams.get("brand") ?? "all");
  const [sort, setSort] = useState<SortKey>(() => {
    const s = searchParams.get("sort");
    return (SORTS as string[]).includes(s ?? "") ? (s as SortKey) : "newest";
  });
  const [cats, setCats] = useState<Category[]>([]);
  const [brands, setBrands] = useState<string[]>([]);
  const [rows, setRows] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const resetKey = `${debouncedQ}|${cat}|${stock}|${brand}|${sort}`;
  const { page, setPage } = usePageParam(resetKey);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [c, b] = await Promise.all([listCategories(), listBrands()]);
      if (cancelled) return;
      if (c.ok && Array.isArray(c.data.data)) setCats(c.data.data);
      if (b.ok && Array.isArray(b.data.data)) setBrands(b.data.data);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErr("");
      try {
        const r = await listProducts({
          q: debouncedQ,
          category: cat,
          stock,
          brand,
          sort,
          page,
          pageSize: PAGE_SIZE,
        });
        if (cancelled) return;
        if (!r.ok) throw new Error(r.message);
        setRows(r.data.data ?? []);
        setTotal(r.data.total ?? 0);
        setTotalPages(r.data.totalPages ?? 1);
        setStart(r.data.start ?? 0);
        setEnd(r.data.end ?? 0);
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
  }, [debouncedQ, cat, stock, brand, sort, page]);

  /* All filters in the URL — refresh, back and share keep the exact grid. */
  const syncing = useRef(false);
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    let changed = false;
    const setOrDelete = (k: string, v: string) => {
      if (v === "" || v === "all" || (k === "sort" && v === "newest")) {
        if (params.has(k)) { params.delete(k); changed = true; }
      } else if (params.get(k) !== v) { params.set(k, v); changed = true; }
    };
    setOrDelete("q", debouncedQ);
    setOrDelete("category", cat);
    setOrDelete("stock", stock);
    setOrDelete("brand", brand);
    setOrDelete("sort", sort);
    /* Drop retired filters (supplier, min/max price) from legacy shared URLs. */
    for (const k of ["supplier", "minPrice", "maxPrice"]) {
      if (params.has(k)) { params.delete(k); changed = true; }
    }
    if (!changed) return;
    syncing.current = true;
    router.replace(params.toString() ? `${pathname}?${params.toString()}` : pathname, { scroll: false });
    window.setTimeout(() => { syncing.current = false; }, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, cat, stock, brand, sort]);

  /* Adopt back/forward navigation. */
  useEffect(() => {
    if (syncing.current) return;
    const get = (k: string, fb: string) => searchParams.get(k) ?? fb;
    const uq = get("q", "");
    const uc = get("category", "all");
    const us = get("stock", "all");
    const ub = get("brand", "all");
    const uso = get("sort", "newest");
    if (uq !== q) setQ(uq);
    if (uc !== cat) setCat(uc);
    if (us !== stock) setStock(us);
    if (ub !== brand) setBrand(ub);
    if (uso !== sort && (SORTS as string[]).includes(uso)) setSort(uso as SortKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const hasFilters =
    q !== "" || cat !== "all" || stock !== "all" || brand !== "all";
  const activeFilterCount =
    (cat !== "all" ? 1 : 0) + (stock !== "all" ? 1 : 0) + (brand !== "all" ? 1 : 0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const clearAll = () => {
    setQ(""); setDebouncedQ(""); setCat("all"); setStock("all");
    setBrand("all"); setSort("newest"); setPage(1);
  };

  return (
    <div className="staff-page">
      <PageHeader
        kicker="Catalogue"
        title="Products"
        sub={`${total} styles · search, filter, open for full detail.`}
        trail={[{ label: "Products" }]}
        actions={isManager ? <Button className="group min-h-[44px] bg-[var(--fp-brand)] text-white transition-all duration-150 hover:-translate-y-px hover:bg-[var(--fp-brand-deep)] active:translate-y-0" asChild><Link href="/inventory/new"><Plus data-icon="inline-start" className="transition-transform duration-150 group-hover:rotate-90" /> Add product</Link></Button> : undefined}
      />

      <Card className="shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
        <CardContent className="flex flex-col gap-2 pt-4">
          <div className="relative">
            <Search aria-hidden className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="Search name, SKU, barcode, brand, design…"
              className="min-h-[48px] rounded-xl pl-10 transition-all focus:ring-4 focus:ring-[var(--staff-brand)]/10"
              aria-label="Search products"
            />
            {q && (
              <button onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 grid min-h-[44px] w-11 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95">✕</button>
            )}
          </div>
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              aria-controls="products-filters"
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border border-[#d6c9bb] bg-white px-4 text-[13.5px] font-semibold transition-colors hover:border-[#1c1917] active:scale-[0.98]"
            >
              {filtersOpen ? "Hide filters" : "Filters"}
              {activeFilterCount > 0 && (
                <span aria-label={`${activeFilterCount} filters active`} className="tnum grid min-h-[22px] min-w-[22px] place-items-center rounded-full bg-[#1c1917] px-1 text-[12px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
              <span aria-hidden className={`transition-transform ${filtersOpen ? "rotate-180" : ""}`}>▾</span>
            </button>
            {activeFilterCount > 0 && (
              <button onClick={clearAll} className="inline-flex min-h-[44px] items-center rounded-xl px-3 text-[13.5px] font-semibold text-[#78716c] hover:text-[#1c1917]">
                Clear
              </button>
            )}
          </div>
          <div id="products-filters" className={`${filtersOpen ? "grid" : "hidden"} grid-cols-1 gap-2 sm:grid-cols-2 md:grid md:grid-cols-2 xl:grid-cols-4`}>
            <Select value={cat} onValueChange={(v) => { setCat(v); setPage(1); }}>
              <SelectTrigger className="min-h-[48px] w-full rounded-xl" aria-label="Category"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.productCount})</SelectItem>)}
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
            <Select value={sort} onValueChange={(v) => { setSort(v as SortKey); setPage(1); }}>
              <SelectTrigger className="min-h-[48px] w-full rounded-xl" aria-label="Sort"><SelectValue placeholder="Sort" /></SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => <SelectItem key={k} value={k}>{SORT_LABEL[k]}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {hasFilters && (
            <button onClick={clearAll} className="hidden min-h-[44px] items-center self-start rounded-xl border px-4 text-[13.5px] font-semibold transition-all hover:-translate-y-px hover:border-foreground md:inline-flex">
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
      ) : rows.length === 0 ? (
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
            {rows.map((p) => {
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
                    <Detail label="Brand" value={p.brandName} />
                    <Detail label="Size · Colour" value={[p.sizes.join(", "), p.colors.join(", ")].filter(Boolean).join(" · ")} />
                  </dl>
                </>
              );
              return isManager ? (
                <Link key={p.id} href={`/inventory/${p.id}`} className={cls} aria-label={`Open ${p.name} details`}>
                  {body}
                </Link>
              ) : (
                <Link key={p.id} href={`/products/${p.id}`} className={cls} aria-label={`Open ${p.name} details`}>
                  {body}
                </Link>
              );
            })}
          </div>
          <PaginationControls
            page={page} totalPages={totalPages} total={total}
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
