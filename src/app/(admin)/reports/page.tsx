import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { getStockSummary, listOrders } from "@/features/catalogue/repository";
import { formatINR } from "@/lib/utils";

/* Reports aggregate real orders + stock. All queries degrade to empty rather
   than throwing, so the page renders its empty states when nothing is imported. */
export default async function ReportsPage() {
  const [stock, orders] = await Promise.all([
    getStockSummary().catch(() => null),
    listOrders({ page: 1, pageSize: 1000 }).catch(() => null),
  ]);

  const live = (orders?.items ?? []).filter((o) => o.status !== "cancelled");
  const revenue = live.reduce((s, o) => s + o.total, 0);
  const units = stock?.units ?? 0;
  const stockValue = stock?.value ?? 0;
  const orderCount = orders?.total ?? 0;

  const byChannel = Map.groupBy(live, (o) => o.channel);
  const channelTotals = [...byChannel.values()].map((l) => l.reduce((s, o) => s + o.total, 0));
  const maxChannel = channelTotals.length ? Math.max(...channelTotals) : 0;

  return (
    <div className="staff-page">
      <PageHeader kicker="Sales" title="Reports" sub="Channel mix, stock valuation, sell-through starters." />
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { label: "Revenue", value: formatINR(revenue), note: "excl. cancelled" },
          { label: "Stock value (cost)", value: formatINR(stockValue), note: `${units} units on hand` },
          { label: "Avg order value", value: formatINR(Math.round(revenue / Math.max(1, live.length))), note: `${orderCount} orders` },
        ].map((c) => (
          <Card key={c.label} className="group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-16px_rgba(28,25,23,0.3)]">
            <CardHeader><CardTitle className="text-[13px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{c.label}</CardTitle></CardHeader>
            <CardContent><p className="tnum text-[26px] font-semibold tracking-tight">{c.value}</p><p className="mt-0.5 text-[13px] text-muted-foreground">{c.note}</p></CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle>Orders by channel</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2">
          {!byChannel.size && (
            <p className="px-1 py-6 text-center text-[13.5px] text-muted-foreground">
              No orders recorded yet. Channel mix fills in as walk-in sales close.
            </p>
          )}
          {[...byChannel.entries()].map(([ch, list]) => {
            const total = list.reduce((s, o) => s + o.total, 0);
            return (
              <div key={ch} className="group rounded-xl border px-3.5 py-3 transition-all duration-150 hover:-translate-y-px hover:border-foreground/40 hover:shadow-[0_8px_18px_-12px_rgba(28,25,23,0.4)]">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="text-[14px] font-semibold capitalize tracking-tight">{ch}</span>
                  <span className="tnum text-[13px] text-muted-foreground">{list.length} orders · {formatINR(total)}</span>
                </div>
                <div aria-hidden className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-[#b4234d] transition-[width] duration-500" style={{ width: `${Math.max(6, Math.round((total / Math.max(1, maxChannel)) * 100))}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
