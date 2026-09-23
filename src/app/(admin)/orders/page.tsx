"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { PaginationControls, usePageParam } from "@/components/pagination";
import { useApi } from "@/hooks/use-api";
import { createOrder, listOrdersPage, listProducts, type Paged } from "@/lib/api";
import { normalizeMobile, isValidMobileIN } from "@/lib/domain";
import type { Order, OrderStatus, Product } from "@/lib/inventory";
import { formatINR, formatDateIN } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { usePageTitle } from "@/hooks/use-page-title";

/* Live order book: GET /api/orders (paged + status filter) behind the same
   card/table markup the server version had, plus manual order entry via
   POST /api/orders for remote sales (instagram / website / meta-lead) —
   floor billing writes its own orders through the record_sale RPC, so this
   form covers the channels that never touch the floor. */

const VARIANT: Record<OrderStatus, "outline" | "secondary" | "default" | "success" | "destructive"> = {
  pending: "outline", confirmed: "secondary", shipped: "default", delivered: "success", cancelled: "destructive",
};

const STATUSES: Array<OrderStatus | "all"> = ["all", "pending", "confirmed", "shipped", "delivered", "cancelled"];

type Line = { productId: string; name: string; price: number; qty: number };

function OrdersInner() {
  usePageTitle("Orders");
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<OrderStatus | "all">(() => {
    const s = searchParams.get("status");
    return (STATUSES as string[]).includes(s ?? "") ? (s as OrderStatus | "all") : "all";
  });
  const { page, setPage } = usePageParam(status);
  const { data: paged, loading, error, reload } = useApi(
    `orders|${page}|${status}`,
    () => listOrdersPage(page, DEFAULT_PAGE_SIZE, status),
  );

  const items: Order[] = paged?.data ?? [];
  const total = paged?.total ?? 0;
  const totalPages = paged?.totalPages ?? 1;
  const start = paged?.start ?? 0;
  const end = paged?.end ?? 0;

  /* Status in URL (?status=) — refresh/back/share keeps the filtered book. */
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (status === "all") params.delete("status");
    else params.set("status", status);
    const cur = searchParams.get("status") ?? "all";
    if (cur === status) return;
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  /* ---------- Manual order form ---------- */
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<Order["channel"]>("walk-in");
  const [pq, setPq] = useState("");
  const [hits, setHits] = useState<Product[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState("");

  // Debounced product search for the picker (same 250ms rhythm as the catalogue).
  useEffect(() => {
    const q = pq.trim();
    if (q.length < 2) { setHits([]); return; }
    let cancelled = false;
    const t = window.setTimeout(() => {
      void (async () => {
        const r = await listProducts({ q, pageSize: 8 });
        if (!cancelled && r.ok) setHits(r.data.data ?? []);
      })();
    }, 250);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [pq]);

  const addLine = (p: Product) => {
    setLines((cur) =>
      cur.some((l) => l.productId === p.id)
        ? cur.map((l) => (l.productId === p.id ? { ...l, qty: l.qty + 1 } : l))
        : [...cur, { productId: p.id, name: p.name, price: p.price, qty: 1 }]
    );
    setPq("");
    setHits([]);
  };

  const setQty = (productId: string, qty: number) =>
    setLines((cur) => cur.flatMap((l) => (l.productId === productId ? (qty <= 0 ? [] : [{ ...l, qty }]) : [l])));

  const previewTotal = lines.reduce((s, l) => s + l.price * l.qty, 0);

  const submit = async () => {
    setFormErr("");
    if (name.trim().length < 2) { setFormErr("Enter the customer's name (2+ characters)."); return; }
    if (!isValidMobileIN(phone)) { setFormErr("Enter a valid 10-digit Indian mobile number."); return; }
    if (lines.length === 0) { setFormErr("Add at least one product to the order."); return; }
    setBusy(true);
    const r = await createOrder({
      customerName: name.trim(),
      customerPhone: normalizeMobile(phone),
      channel,
      items: lines.map((l) => ({ productId: l.productId, qty: l.qty })),
    });
    setBusy(false);
    if (r.ok) {
      toast.success(`Order ${r.data.code} recorded`, {
        description: `${formatINR(r.data.total)} · ${r.data.items.length} line${r.data.items.length === 1 ? "" : "s"} · ${channel}`,
      });
      setOpen(false);
      setName(""); setPhone(""); setChannel("walk-in"); setPq(""); setHits([]); setLines([]); setFormErr("");
      reload();
    } else {
      setFormErr(r.message);
    }
  };

  return (
    <div className="staff-page">
      <PageHeader
        kicker="Sales"
        title="Orders"
        sub={`${total} orders · walk-in, instagram, website.`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setFormErr(""); }}>
              <DialogTrigger asChild>
                <Button className="group min-h-[44px] bg-[var(--staff-brand)] text-white transition-all duration-150 hover:-translate-y-px hover:bg-[var(--staff-brand-deep)] active:translate-y-0">
                  New order
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Record a manual order</DialogTitle>
                  <DialogDescription>
                    For remote sales (DM, website). Floor billing lands here on its own — use this for
                    orders taken outside the store.
                  </DialogDescription>
                </DialogHeader>
                <form
                  className="flex flex-col gap-3"
                  onSubmit={(e) => { e.preventDefault(); void submit(); }}
                >
                  <label htmlFor="order-name" className="text-[13px] font-semibold text-muted-foreground">Customer name</label>
                  <Input id="order-name" value={name} onChange={(e) => { setName(e.target.value); setFormErr(""); }} placeholder="Priya Shah" autoComplete="off" />
                  <label htmlFor="order-phone" className="text-[13px] font-semibold text-muted-foreground">Mobile</label>
                  <Input id="order-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setFormErr(""); }} placeholder="98765 43210" className="tnum" />
                  <label htmlFor="order-channel" className="text-[13px] font-semibold text-muted-foreground">Channel</label>
                  <Select value={channel} onValueChange={(v) => setChannel(v as Order["channel"])}>
                    <SelectTrigger id="order-channel" aria-label="Channel" className="min-h-[44px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="walk-in">Walk-in</SelectItem>
                      <SelectItem value="instagram">Instagram</SelectItem>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="meta-lead">Meta lead</SelectItem>
                    </SelectContent>
                  </Select>
                  <label htmlFor="order-product" className="text-[13px] font-semibold text-muted-foreground">Products</label>
                  <Input id="order-product" value={pq} onChange={(e) => setPq(e.target.value)} placeholder="Search name, SKU, barcode…" autoComplete="off" />
                  {hits.length > 0 && (
                    <ul className="max-h-40 overflow-y-auto rounded-xl border">
                      {hits.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => addLine(p)}
                            className="flex min-h-[44px] w-full items-center justify-between gap-3 px-3 text-left text-[14px] transition-colors hover:bg-muted"
                          >
                            <span className="min-w-0 truncate">{p.name} <span className="tnum text-[12px] text-muted-foreground">{p.sku}</span></span>
                            <span className="tnum shrink-0 font-semibold">{formatINR(p.price)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {lines.length > 0 && (
                    <ul className="flex flex-col gap-2 rounded-xl border p-2">
                      {lines.map((l) => (
                        <li key={l.productId} className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 text-[14px]">
                          <span className="min-w-0 flex-1 basis-32 truncate">{l.name}</span>
                          <span className="flex shrink-0 items-center gap-1.5">
                            <span className="tnum text-[13px] text-muted-foreground">{formatINR(l.price)}</span>
                            <button type="button" aria-label={`Decrease quantity of ${l.name}`} onClick={() => setQty(l.productId, l.qty - 1)} className="grid min-h-[44px] min-w-[44px] place-items-center rounded-lg border transition-colors hover:border-foreground"><Minus className="size-4" /></button>
                            <span className="tnum w-6 text-center font-semibold">{l.qty}</span>
                            <button type="button" aria-label={`Increase quantity of ${l.name}`} onClick={() => setQty(l.productId, l.qty + 1)} className="grid min-h-[44px] min-w-[44px] place-items-center rounded-lg border transition-colors hover:border-foreground"><Plus className="size-4" /></button>
                          </span>
                        </li>
                      ))}
                      <li className="flex justify-between border-t pt-2 text-[14px] font-semibold">
                        <span>Total (preview)</span>
                        <span className="tnum">{formatINR(previewTotal)}</span>
                      </li>
                    </ul>
                  )}
                  {formErr && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-[13.5px] font-medium text-destructive">{formErr}</p>}
                  <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="outline" className="min-h-[44px]" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
                    <Button type="submit" disabled={busy} className="min-h-[44px] bg-[var(--staff-brand)] text-white hover:bg-[var(--staff-brand-deep)]">{busy ? "Saving…" : "Create order"}</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            <Button variant="outline" className="min-h-[44px]" asChild>
              <Link href="/today">New walk-in sale</Link>
            </Button>
          </div>
        }
      />

      {/* Status filter — aria-pressed toggle buttons (no fake tab semantics). */}
      <div role="group" aria-label="Filter orders by status" className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => { setStatus(s); setPage(1); }}
            className={`min-h-[44px] rounded-lg border px-3.5 text-[13px] font-semibold capitalize transition-colors ${
              status === s
                ? "border-foreground bg-foreground text-background"
                : "border-stone-400 bg-white text-muted-foreground hover:border-foreground hover:text-foreground"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && !paged && (
        <div role="alert" className="staff-banner-error flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3.5">
          <div>
            <p className="text-[14px] font-semibold">Couldn&apos;t load orders.</p>
            <p className="mt-0.5 text-[13.5px] opacity-90">{error}</p>
          </div>
          <Button variant="outline" size="sm" className="min-h-[40px]" onClick={reload}>Try again</Button>
        </div>
      )}

      {loading && !paged ? (
        <Card className="overflow-hidden">
          <CardContent className="flex flex-col divide-y p-0" aria-busy="true" aria-label="Loading orders">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton-soft h-[76px]" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Mobile: card list with expandable purchased-item detail. */}
          <Card className="overflow-hidden md:hidden">
            <CardContent className="flex flex-col divide-y p-0">
              {items.map((o) => {
                const pcs = o.items.reduce((s, i) => s + i.qty, 0);
                return (
                  <div key={o.id} className="group p-4 transition-colors hover:bg-muted/40">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[15px] font-semibold tracking-tight">{o.code}</p>
                        <p className="mt-0.5 text-[12px] text-muted-foreground">{o.channel}{o.fcName ? ` · ${o.fcName}` : ""}</p>
                      </div>
                      <Badge variant={VARIANT[o.status]}>{o.status}</Badge>
                    </div>
                    <div className="mt-2.5 flex items-end justify-between gap-3 border-t border-dashed pt-2.5">
                      <div className="min-w-0 text-[13px]">
                        <p className="truncate font-medium">{o.customerName}</p>
                        <p className="tnum truncate text-[12px] text-muted-foreground">{o.customerPhone}</p>
                        <p className="tnum text-[12px] text-muted-foreground">{pcs} pcs · {formatDateIN(o.createdAt)}</p>
                      </div>
                      <p className="tnum shrink-0 text-[16px] font-semibold tracking-tight">{formatINR(o.total)}</p>
                    </div>
                    <details className="group/details mt-2.5 rounded-xl border border-dashed bg-muted/30 px-3 py-2">
                      <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-2 text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
                        Items purchased ({pcs})
                        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open/details:rotate-180" />
                      </summary>
                      <ul className="mt-2 flex flex-col divide-y divide-dashed">
                        {o.items.map((it, idx) => (
                          <li key={`${it.productId}-${idx}`} className="flex items-center justify-between gap-3 py-1.5 text-[13px]">
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{it.productName}</span>
                              <span className="tnum block text-[12px] text-muted-foreground">{it.qty} × {formatINR(it.price)}</span>
                            </span>
                            <span className="tnum shrink-0 font-semibold">{formatINR(it.qty * it.price)}</span>
                          </li>
                        ))}
                        {!o.items.length && <li className="py-1.5 text-[13px] text-muted-foreground">No line items on file.</li>}
                      </ul>
                    </details>
                  </div>
                );
              })}
              {!total && (
                <div className="flex flex-col items-center gap-1.5 px-6 py-12 text-center">
                  <span aria-hidden className="empty-plate"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 7h15l-1.5 9h-12z" /><path d="M6 7 5 3H2" /><circle cx="9" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /></svg></span>
                  <p className="mt-1 text-[15px] font-semibold">No orders yet.</p>
                  <p className="text-[13.5px] text-muted-foreground">Walk-in sales land here the moment they close.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="hidden overflow-x-auto md:block">
            <CardContent className="p-0">
              <Table className="min-w-[720px]">
                <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Customer</TableHead><TableHead>Items purchased</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead>Placed</TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.map((o) => (
                    <TableRow key={o.id} className="align-top transition-colors hover:bg-muted/40">
                      <TableCell className="font-semibold tracking-tight">{o.code}<p className="text-[12px] font-normal text-muted-foreground">{o.channel}{o.fcName ? ` · ${o.fcName}` : ""}</p></TableCell>
                      <TableCell><span className="font-medium">{o.customerName}</span><p className="tnum text-[12px] text-muted-foreground">{o.customerPhone}</p></TableCell>
                      <TableCell>
                        <ul className="flex min-w-[220px] flex-col gap-1">
                          {o.items.map((it, idx) => (
                            <li key={`${it.productId}-${idx}`} className="flex items-baseline justify-between gap-3 text-[13px]">
                              <span className="min-w-0 truncate font-medium">{it.productName} <span className="tnum font-normal text-muted-foreground">× {it.qty}</span></span>
                              <span className="tnum text-muted-foreground">{formatINR(it.qty * it.price)}</span>
                            </li>
                          ))}
                          {!o.items.length && <li className="text-[13px] text-muted-foreground">No line items.</li>}
                        </ul>
                        <p className="tnum mt-1 text-[12px] text-muted-foreground">{o.items.reduce((s, i) => s + i.qty, 0)} pcs</p>
                      </TableCell>
                      <TableCell className="tnum text-right font-semibold">{formatINR(o.total)}</TableCell>
                      <TableCell><Badge variant={VARIANT[o.status]}>{o.status}</Badge></TableCell>
                      <TableCell className="text-[13px] text-muted-foreground">{formatDateIN(o.createdAt)}</TableCell>
                    </TableRow>
                  ))}
                  {!total && (
                    <TableRow><TableCell colSpan={6} className="py-12 text-center">
                      <span aria-hidden className="empty-plate mx-auto"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 7h15l-1.5 9h-12z" /><path d="M6 7 5 3H2" /><circle cx="9" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /></svg></span>
                      <p className="mt-2 text-[15px] font-semibold">No orders{status !== "all" ? ` with status “${status}”` : " yet"}.</p>
                      <p className="mt-0.5 text-[13.5px] text-muted-foreground">Walk-in sales land here the moment they close.</p>
                      {status !== "all" && (
                        <button onClick={() => { setStatus("all"); setPage(1); }} className="mt-2 inline-flex min-h-[44px] items-center rounded-xl border px-4 text-[13.5px] font-semibold transition-all hover:-translate-y-px hover:border-foreground">Show all</button>
                      )}
                    </TableCell></TableRow>
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

export default function OrdersPage() {
  return (
    <Suspense fallback={<div aria-busy="true" aria-label="Loading orders" className="skeleton-soft h-[420px] rounded-2xl" />}>
      <OrdersInner />
    </Suspense>
  );
}
