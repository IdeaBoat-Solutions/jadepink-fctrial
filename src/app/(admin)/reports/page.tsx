import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { getStockSummary, listOrders, listRecentBilledItems } from "@/features/catalogue/repository";
import { formatINR, formatDateIN, formatChannel } from "@/lib/utils";

/* Reports aggregate real orders + stock. All queries degrade to empty rather
   than throwing, so the page renders its empty states when nothing is imported. */
export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const [stock, orders, billed] = await Promise.all([
    getStockSummary().catch(() => null),
    listOrders({ page: 1, pageSize: 1000 }).catch(() => null),
    listRecentBilledItems(20).catch(() => []),
  ]);

  const live = (orders?.items ?? []).filter((o) => o.status !== "cancelled");
  const revenue = live.reduce((s, o) => s + o.total, 0);
  const units = stock?.units ?? 0;
  const stockValue = stock?.value ?? 0;

  const byChannel = Map.groupBy(live, (o) => o.channel);
  const channelTotals = [...byChannel.values()].map((l) => l.reduce((s, o) => s + o.total, 0));
  const maxChannel = channelTotals.length ? Math.max(...channelTotals) : 0;

  return (
    <div className="staff-page">
      <PageHeader kicker="Sales" title="Reports" sub="Where money came from, and what your stock is worth." />
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { label: "Money in", value: formatINR(revenue), note: "cancelled sales left out" },
          { label: "Stock worth (at cost)", value: formatINR(stockValue), note: `${units} pieces on the shelf` },
          { label: "Average bill", value: formatINR(Math.round(revenue / Math.max(1, live.length))), note: `${formatINR(revenue)} ÷ ${live.length} bills` },
        ].map((c) => (
          <Card key={c.label}>
            <CardHeader><CardTitle className="text-[13px] font-medium text-muted-foreground">{c.label}</CardTitle></CardHeader>
            <CardContent><p className="tnum text-[26px] font-semibold tracking-tight">{c.value}</p><p className="mt-0.5 text-[13px] text-muted-foreground">{c.note}</p></CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Where sales came from</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          {!byChannel.size && (
            <div className="flex flex-col items-center px-6 py-10 text-center">
              <span aria-hidden className="empty-plate"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></svg></span>
              <p className="mt-2 text-[14px] font-semibold">No sales yet.</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">This fills in as counter bills close.</p>
              <a href="/today" className="mt-3 inline-flex min-h-[44px] items-center rounded-xl border px-4 text-[13.5px] font-semibold transition-all hover:-translate-y-px hover:border-foreground">Open today&apos;s counter</a>
            </div>
          )}
          {[...byChannel.entries()].map(([ch, list]) => {
            const total = list.reduce((s, o) => s + o.total, 0);
            return (
              <div key={ch} className="rounded-xl border px-3.5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="text-[14px] font-semibold tracking-tight">{formatChannel(ch)}</span>
                  <span className="tnum text-[13px] text-muted-foreground">{list.length} bills · {formatINR(total)}</span>
                </div>
                <div aria-hidden className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-[var(--staff-brand)]" style={{ width: `${Math.max(6, Math.round((total / Math.max(1, maxChannel)) * 100))}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Recently billed items</CardTitle></CardHeader>
        <CardContent className="p-0">
          {!billed.length ? (
            <p className="px-4 py-6 text-center text-[13.5px] text-muted-foreground">
              Nothing billed yet. Pieces marked billed on the floor land here with their bill, customer and FC.
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {billed.map((b, i) => (
                <li key={`${b.orderId}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13.5px] transition-colors hover:bg-muted/40">
                  <span className="min-w-0">
                    <span className="block truncate font-semibold tracking-tight">{b.productName}</span>
                    <span className="tnum block truncate text-[12px] text-muted-foreground">
                      {b.orderCode} · {b.customerName}{b.fcName ? ` · FC ${b.fcName}` : ""} · {formatDateIN(b.orderedAt)}
                    </span>
                  </span>
                  <span className="tnum shrink-0 font-semibold">{b.qty} × {formatINR(b.price)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
