import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { listOrders } from "@/features/catalogue/repository";
import type { OrderStatus } from "@/lib/inventory";
import { formatINR, formatDateIN } from "@/lib/utils";
import { DEFAULT_PAGE_SIZE, parsePage } from "@/lib/pagination";
import { PaginationControls } from "@/components/pagination";

const VARIANT: Record<OrderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "secondary", confirmed: "default", shipped: "default", delivered: "outline", cancelled: "destructive",
};

/* Server-paginated against real orders: ?page= is read on the server, controls
   are plain Links — no client JS for paging on this table. */
export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: raw } = await searchParams;
  const page = parsePage(raw);
  const { items, total, totalPages, start, end } = await listOrders({ page, pageSize: DEFAULT_PAGE_SIZE }).catch(() => ({
    items: [], page: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0, totalPages: 1, start: 0, end: 0,
  }));

  return (
    <div className="staff-page">
      <PageHeader
        kicker="Sales"
        title="Orders"
        sub={`${total} orders · walk-in, instagram, website.`}
        actions={<Button className="min-h-[44px] bg-[#b4234d] text-white transition-all duration-150 hover:-translate-y-px hover:bg-[#93183d] active:translate-y-0" asChild><Link href="/today">New walk-in sale</Link></Button>}
      />
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
                <details className="mt-2.5 rounded-xl border border-dashed bg-muted/30 px-3 py-2">
                  <summary className="cursor-pointer text-[13px] font-semibold">Items purchased ({pcs})</summary>
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

      <Card className="hidden overflow-hidden md:block">
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
                          <span className="tnum shrink-0 text-muted-foreground">{formatINR(it.qty * it.price)}</span>
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
                <TableRow><TableCell colSpan={6} className="py-12 text-center text-muted-foreground">No orders yet.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <PaginationControls
        page={page} totalPages={totalPages} total={total}
        start={start} end={end}
        hrefBase="/orders"
      />
      <p className="text-[13px] text-muted-foreground">Served from Supabase by /api/orders. Status transitions: pending → confirmed → shipped → delivered.</p>
    </div>
  );
}
