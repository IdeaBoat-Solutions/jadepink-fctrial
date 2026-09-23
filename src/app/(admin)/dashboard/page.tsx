"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Boxes, IndianRupee, Package, ShoppingCart, Tags, TriangleAlert, Truck, Users, BarChart3, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { RevenueChartSkeleton } from "@/components/admin/revenue-chart";
import { useApi } from "@/hooks/use-api";
import { getDashboard, getVisitFunnel, type FunnelMetricsLive } from "@/lib/api";
import { useStore } from "@/lib/store";
import { formatINR } from "@/lib/utils";

const EMPTY_FUNNEL: FunnelMetricsLive = {
  footfall: 0, trials: 0, billedVisits: 0, billedPieces: 0, billedValue: 0,
  footfallToTrialPct: null, trialToBillPct: null, footfallConversionPct: null,
  billedValuePerVisitor: 0,
};

/* Manager overview, top-down: today's floor first (what needs me right now),
   then money + stock KPIs, revenue chart beside the FULL restock list
   (out-of-stock first — nothing hidden behind a slice), then jump links.
   Live store data (GET /api/dashboard) behind skeletons; floor counts come
   from the live store so no second fetch is needed. */
const RevenueChart = dynamic(
  () => import("@/components/admin/revenue-chart").then((m) => m.RevenueChart),
  { loading: () => <RevenueChartSkeleton />, ssr: false }
);

function stockOf(p: { stock: number; lowStockAt: number | null }): "in-stock" | "low-stock" | "out-of-stock" {
  if (p.stock <= 0) return "out-of-stock";
  if (p.lowStockAt != null && p.stock <= p.lowStockAt) return "low-stock";
  return "in-stock";
}

const JUMP_LINKS = [
  { href: "/today", label: "Open floor", desc: "Live visits, assign FCs", icon: ShoppingCart },
  { href: "/inventory", label: "Inventory", desc: "Catalogue with filters", icon: Tags },
  { href: "/inventory/categories", label: "Categories", desc: "Browse styles by category", icon: Package },
  { href: "/orders", label: "Orders", desc: "Sales by channel", icon: Wallet },
  { href: "/customers", label: "Customers", desc: "Directory + history", icon: Users },
  { href: "/reports", label: "Reports", desc: "Channel mix, billed items", icon: BarChart3 },
  { href: "/suppliers", label: "Suppliers", desc: "Reorder + ratings", icon: Truck },
] as const;

export default function DashboardPage() {
  const { data, loading, error, reload } = useApi("dashboard", getDashboard);
  const { todayCounts, visits, profile } = useStore();
  const storeId = profile?.storeId ?? "";
  const funnel = useApi<FunnelMetricsLive>(`funnel|${storeId}`, () =>
    storeId ? getVisitFunnel(storeId) : Promise.resolve({ ok: true, data: EMPTY_FUNNEL })
  );
  const completed = visits.filter((v) => v.status === "COMPLETED").length;

  const attention = (data?.lowStock ?? []).slice().sort((a, b) => {
    const rank = (s: number) => (s <= 0 ? 0 : 1);
    return rank(a.stock) - rank(b.stock) || a.stock - b.stock;
  });
  const outCount = attention.filter((p) => p.stock <= 0).length;

  return (
    <div className="staff-page">
      <PageHeader
        kicker="Store overview · live"
        title="Dashboard"
        sub="Today's floor first, then money and stock — one glance."
        actions={
          <Button className="group min-h-[44px] bg-[var(--staff-brand)] text-white transition-all duration-150 hover:-translate-y-px hover:bg-[var(--staff-brand-deep)] active:translate-y-0" asChild><Link href="/today">Open floor <ArrowRight data-icon="inline-end" className="transition-transform duration-150 group-hover:translate-x-0.5" /></Link></Button>
        }
      />

      {error && !data && (
        <div role="alert" className="staff-banner-error flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3.5">
          <div>
            <p className="text-[14px] font-semibold">Couldn&apos;t load store data.</p>
            <p className="mt-0.5 text-[13.5px] opacity-90">{error}</p>
          </div>
          <Button variant="outline" size="sm" className="min-h-[40px]" onClick={reload}>Try again</Button>
        </div>
      )}

      {/* Today on the floor — needs-me-now numbers, always on screen */}
      <section aria-label="Today on the floor">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Walk-ins today", value: String(todayCounts.walkIns), href: "/today" },
            { label: "Active visits", value: String(todayCounts.active), href: "/floor" },
            { label: "Awaiting assignment", value: String(todayCounts.awaiting), href: "/floor", warn: todayCounts.awaiting > 0 },
            { label: "Completed today", value: String(completed), href: "/today" },
          ].map((s) => (
            <Link
              key={s.label}
              href={s.href}
              className={`group flex items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(28,25,23,0.04)] transition-all duration-150 hover:-translate-y-px active:translate-y-0 ${"warn" in s && s.warn ? "border-warn/50 bg-warn-bg hover:border-warn" : "border-[var(--staff-line)] hover:border-[var(--staff-ink)]"}`}
            >
              <span>
                <span className={`tnum block text-[26px] font-semibold leading-none tracking-tight ${"warn" in s && s.warn ? "text-warn" : "text-[var(--staff-ink)]"}`}>{s.value}</span>
                <span className="mt-1 block text-[12.5px] font-medium text-[var(--staff-muted)]">{s.label}</span>
              </span>
              <span aria-hidden className="text-[16px] font-bold text-[var(--staff-line-strong)] transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--staff-ink)]">→</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Today's conversion funnel — GET /api/visits/funnel, computed from
          live visits + visit_products, never invented client-side. */}
      <section aria-label="Today's funnel">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-1">
            <CardTitle>Today&apos;s funnel</CardTitle>
            <p className="text-[13px] text-muted-foreground">Footfall → trial → bill</p>
          </CardHeader>
          <CardContent aria-busy={funnel.loading && !funnel.data}>
            {funnel.error && !funnel.data && (
              <p className="text-[13.5px] text-muted-foreground">Funnel unavailable right now — the numbers above are unaffected.</p>
            )}
            {funnel.data ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "Footfall", value: String(funnel.data.footfall), note: "visits today" },
                  { label: "Trials", value: String(funnel.data.trials), note: funnel.data.footfallToTrialPct != null ? `${funnel.data.footfallToTrialPct}% of footfall` : "no trials yet" },
                  { label: "Billed visits", value: String(funnel.data.billedVisits), note: funnel.data.trialToBillPct != null ? `${funnel.data.trialToBillPct}% of trials` : "nothing billed yet" },
                  { label: "Billed value", value: formatINR(funnel.data.billedValue), note: `${funnel.data.billedPieces} piece${funnel.data.billedPieces === 1 ? "" : "s"} billed` },
                ].map((f) => (
                  <div key={f.label} className="rounded-xl border border-[var(--staff-line)] bg-white px-4 py-3.5">
                    <p className="tnum text-[26px] font-semibold leading-none tracking-tight text-[var(--staff-ink)]">{f.value}</p>
                    <p className="mt-1 block text-[12.5px] font-medium text-[var(--staff-muted)]">{f.label}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">{f.note}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skeleton-soft h-[92px] rounded-2xl" style={{ animationDelay: `${i * 110}ms` }} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Money + stock KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy={loading && !data}>
        {data ? (
          [
            { label: "Revenue · all time", value: formatINR(data.kpis.revenue), icon: IndianRupee, note: `${data.kpis.orders} orders`, href: "/orders" },
            { label: "Stock value", value: formatINR(data.kpis.stockValue), icon: Wallet, note: `${data.kpis.units} units · ${data.kpis.skus} SKUs`, href: "/inventory" },
            { label: "Units on hand", value: String(data.kpis.units), icon: Boxes, note: `${data.kpis.skus} SKUs live`, href: "/inventory" },
            { label: "Attention needed", value: String(data.kpis.low + data.kpis.out), icon: TriangleAlert, note: `${data.kpis.out} out · ${data.kpis.low} low — open restock list`, warn: data.kpis.low + data.kpis.out > 0, href: "/inventory?stock=low-stock" },
          ].map((k) => (
            <Link key={k.label} href={k.href} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Card className="h-full transition-all duration-150 hover:-translate-y-px hover:shadow-[0_8px_18px_-12px_rgba(28,25,23,0.4)]">
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-[13px] font-medium text-muted-foreground">{k.label}</CardTitle>
                <span className={`grid size-7 place-items-center rounded-lg ${"warn" in k && k.warn ? "bg-warn-bg text-warn" : "bg-muted text-muted-foreground"}`}><k.icon className="size-4" /></span>
              </CardHeader>
              <CardContent>
                <p className={`tnum text-[26px] font-semibold tracking-tight ${"warn" in k && k.warn ? "text-warn" : ""}`}>{k.value}</p>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">{k.note} <span aria-hidden>→</span></p>
              </CardContent>
            </Card>
            </Link>
          ))
        ) : (
          [0, 1, 2, 3].map((i) => (
            <Card key={i} aria-hidden={!loading}>
              <CardHeader className="pb-1"><div className="skeleton-soft h-4 w-28 rounded-md" /></CardHeader>
              <CardContent>
                <div className="skeleton-soft h-8 w-24 rounded-md" style={{ animationDelay: `${i * 110}ms` }} />
                <div className="skeleton-soft mt-2 h-3.5 w-20 rounded-md" style={{ animationDelay: `${i * 110}ms` }} />
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Revenue by day</CardTitle>
            <p className="text-[13px] text-muted-foreground">Live orders aggregated by the dashboard API.</p>
          </CardHeader>
          <CardContent>
            {data ? <RevenueChart data={data.revenue} /> : <RevenueChartSkeleton />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle>
              Needs restock
              {attention.length > 0 && (
                <Badge variant="secondary" className="tnum ml-2 align-middle">
                  {attention.length}{outCount > 0 && ` · ${outCount} out`}
                </Badge>
              )}
            </CardTitle>
            <Button variant="link" size="sm" className="group min-h-[44px]" asChild><Link href="/inventory">View all <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5">→</span></Link></Button>
          </CardHeader>
          <CardContent>
            {data ? (
              attention.length ? (
                <div className="flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-0.5">
                  {attention.map((p) => {
                    const s = stockOf(p);
                    return (
                      <Link key={p.id} href={`/inventory/${p.id}`} className="group flex shrink-0 items-center justify-between gap-2 rounded-xl border px-3 py-2.5 transition-all duration-150 hover:-translate-y-px hover:border-foreground hover:shadow-[0_8px_18px_-12px_rgba(28,25,23,0.4)] active:translate-y-0">
                        <span className="min-w-0">
                          <span className="block truncate text-[14px] font-semibold">{p.name}</span>
                          <span className="tnum block text-[12px] text-muted-foreground">{p.sku} · {p.stock} left</span>
                        </span>
                        <Badge variant={s === "out-of-stock" ? "destructive" : "warning"}>
                          {s === "out-of-stock" ? "Out" : "Low"}
                        </Badge>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-xl bg-muted/50 px-4 py-6 text-center text-[13.5px] text-muted-foreground">Stock is healthy — nothing needs reorder.</p>
              )
            ) : (
              [0, 1, 2].map((i) => (
                <div key={i} className="skeleton-soft h-[58px] rounded-xl" style={{ animationDelay: `${i * 120}ms` }} />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Jump links — organised doors to every module, no filler */}
      <section aria-label="Jump to a module">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {JUMP_LINKS.map((j) => (
            <Link
              key={j.href}
              href={j.href}
              className="group flex items-center gap-3 rounded-2xl border border-[var(--staff-line)] bg-white px-4 py-3 transition-all duration-150 hover:-translate-y-px hover:border-[var(--staff-ink)] hover:shadow-[0_8px_18px_-12px_rgba(28,25,23,0.4)] active:translate-y-0"
            >
              <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f3eeea] text-[#57534e] transition-colors duration-150 group-hover:bg-[var(--staff-ink)] group-hover:text-white">
                <j.icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-semibold tracking-tight text-[var(--staff-ink)]">{j.label}</span>
                <span className="block truncate text-[12px] text-[var(--staff-muted)]">{j.desc}</span>
              </span>
              <span aria-hidden className="shrink-0 text-[14px] font-bold text-[var(--staff-line-strong)] transition-all duration-150 group-hover:translate-x-0.5 group-hover:text-[var(--staff-ink)]">→</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
