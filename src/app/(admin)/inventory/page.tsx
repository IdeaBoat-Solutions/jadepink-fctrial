"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { stockStatus } from "@/lib/inventory";
import type { Category, Product } from "@/lib/inventory";
import { formatINR } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { PaginationControls, usePageParam } from "@/components/pagination";

/* Products showcase over the LIVE catalogue (/api/products + /api/categories).
   Search / category / stock filter in SQL — the catalogue is ~900 rows and
   growing, so it is never fetched whole. Each row opens its detail page, which
   carries the "Purchased by" detail list of the users who bought that item. */

interface ProductsResponse {
  source: string;
  data: Product[];
  items?: Product[];
  total: number;
  totalPages: number;
  start: number;
  end: number;
}

function InventoryInner() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [cat, setCat] = useState("all");
  const [stock, setStock] = useState("all");
  const [cats, setCats] = useState<Category[]>([]);
  const [rows, setRows] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const { page, setPage } = usePageParam(`${debouncedQ}|${cat}|${stock}`);

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
      } catch { /* categories stay empty — filter still works */ }
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
      p.set("page", String(page));
      p.set("pageSize", String(DEFAULT_PAGE_SIZE));
      try {
        const res = await fetch(`/api/products?${p.toString()}`, { cache: "no-store" });
        const json: ProductsResponse = await res.json().catch(() => ({ data: [], total: 0 } as unknown as ProductsResponse));
        if (cancelled) return;
        if (!res.ok) throw new Error((json as { error?: string }).error ?? "Could not load products");
        const items = json.data ?? json.items ?? [];
        setRows(items);
        setTotal(json.total ?? items.length);
        setTotalPages(json.totalPages ?? 1);
        setStart(json.start ?? 0);
        setEnd(json.end ?? items.length);
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
  }, [debouncedQ, cat, stock, page]);

  const clearAll = () => { setQ(""); setCat("all"); setStock("all"); setPage(1); };

  return (
    <div className="staff-page">
      <PageHeader
        kicker="Catalogue"
        title="Products"
        sub={`${total} SKUs · search, filter, open for stock moves + purchase history.`}
        actions={<Button className="group min-h-[44px] bg-[var(--staff-brand)] text-white transition-all duration-150 hover:-translate-y-px hover:bg-[var(--staff-brand-deep)] active:translate-y-0" asChild><Link href="/inventory/new"><Plus data-icon="inline-start" className="transition-transform duration-150 group-hover:rotate-90" /> Add product</Link></Button>}
      />

      <Card className="shadow-[0_1px_2px_rgba(28,25,23,0.04)]">
        <CardContent className="flex flex-col gap-2 pt-4 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search name, SKU, barcode, brand, design…" className="min-h-[48px] rounded-xl pl-10 transition-all focus:ring-4 focus:ring-[var(--staff-brand)]/10" aria-label="Search inventory" />
            {q && (
              <button onClick={() => setQ("")} aria-label="Clear search" className="absolute right-2 top-1/2 grid min-h-[36px] w-9 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-95">✕</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 md:flex md:gap-2">
            <Select value={cat} onValueChange={(v) => { setCat(v); setPage(1); }}>
              <SelectTrigger aria-label="Filter by category" className="min-h-[48px] w-full rounded-xl md:w-[180px]"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name} ({c.productCount})</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={stock} onValueChange={(v) => { setStock(v); setPage(1); }}>
              <SelectTrigger aria-label="Filter by stock level" className="min-h-[48px] w-full rounded-xl md:w-[160px]"><SelectValue placeholder="Stock" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stock</SelectItem>
                <SelectItem value="in-stock">In stock</SelectItem>
                <SelectItem value="low-stock">Low stock</SelectItem>
                <SelectItem value="out-of-stock">Out of stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {err && (
        <p role="alert" className="rounded-xl border border-[#f0b6b9] bg-[#fdecec] px-4 py-3 text-[13.5px] font-medium text-[#7d1a1f]">{err}</p>
      )}

      {loading ? (
        <Card className="overflow-hidden">
          <CardContent className="flex flex-col divide-y p-0" aria-busy="true" aria-label="Loading products">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton-soft h-[76px]" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list. >=md: full table (both render the same paged rows). */}
          <Card className="overflow-hidden md:hidden">
            <CardContent className="flex flex-col divide-y p-0">
              {rows.map((p) => {
                const s = stockStatus(p);
                return (
                  <Link key={p.id} href={`/inventory/${p.id}`} className="group flex items-center justify-between gap-3 p-4 transition-colors hover:bg-muted/40 active:bg-muted/60">
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-semibold tracking-tight">{p.name}</span>
                      <span className="tnum block truncate text-[12px] text-muted-foreground">{p.sku} · {p.categoryName} · {p.supplierName}</span>
                      <span className="tnum mt-1 block text-[13px]">
                        <strong>{formatINR(p.price)}</strong>
                        <span className="text-muted-foreground"> · {p.stock} in stock</span>
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1.5">
                      <Badge variant={s === "out-of-stock" ? "destructive" : s === "low-stock" ? "secondary" : "default"}>
                        {s === "in-stock" ? "In stock" : s === "low-stock" ? "Low" : "Out"}
                      </Badge>
                      <span aria-hidden className="text-[13px] font-semibold text-muted-foreground transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-foreground">Open →</span>
                    </span>
                  </Link>
                );
              })}
              {!rows.length && (
                <div className="flex flex-col items-center gap-1.5 px-6 py-12 text-center">
                  <span aria-hidden className="empty-plate"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg></span>
                  <p className="mt-1 text-[15px] font-semibold">No SKUs match.</p>
                  <p className="text-[13.5px] text-muted-foreground">Try a shorter search or clear the filters.</p>
                  <button onClick={clearAll} className="mt-2 inline-flex min-h-[44px] items-center rounded-xl border px-4 text-[13.5px] font-semibold transition-all hover:-translate-y-px hover:border-foreground">Clear filters</button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="hidden overflow-hidden md:block">
            <CardContent className="p-0">
              <Table className="min-w-[620px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Stock</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => {
                    const s = stockStatus(p);
                    return (
                      <TableRow key={p.id} className="group transition-colors hover:bg-muted/40">
                        <TableCell>
                          <p className="font-semibold tracking-tight">{p.name}</p>
                          <p className="tnum text-[12px] text-muted-foreground">{p.sku} · {p.supplierName}</p>
                        </TableCell>
                        <TableCell>{p.categoryName}</TableCell>
                        <TableCell className="tnum text-right font-medium">{formatINR(p.price)}</TableCell>
                        <TableCell className="tnum text-right font-semibold">{p.stock}</TableCell>
                        <TableCell>
                          <Badge variant={s === "out-of-stock" ? "destructive" : s === "low-stock" ? "secondary" : "default"}>
                            {s === "in-stock" ? "In stock" : s === "low-stock" ? "Low" : "Out"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="outline" size="sm" className="min-h-[36px] transition-all duration-150 group-hover:border-foreground" asChild><Link href={`/inventory/${p.id}`}>Open</Link></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!rows.length && (
                    <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">No SKUs match. Clear filters.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <PaginationControls
            page={page} totalPages={totalPages} total={total}
            start={start} end={end} onPage={setPage}
          />
        </>
      )}
    </div>
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<div aria-busy="true" aria-label="Loading" className="skeleton-soft h-[420px] rounded-2xl" />}>
      <InventoryInner />
    </Suspense>
  );
}
