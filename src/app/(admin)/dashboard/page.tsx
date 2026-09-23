"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RevenueChartSkeleton } from "@/components/admin/revenue-chart";
import { useApi } from "@/hooks/use-api";
import { getDashboard, getVisitFunnel, type FunnelMetricsLive } from "@/lib/api";
import { useStore } from "@/lib/store";
import { formatINR, timeAgo } from "@/lib/utils";
import { usePageTitle } from "@/hooks/use-page-title";

const EMPTY_FUNNEL: FunnelMetricsLive = {
  footfall: 0, trials: 0, billedVisits: 0, billedPieces: 0, billedValue: 0,
  footfallToTrialPct: null, trialToBillPct: null, footfallConversionPct: null,
  billedValuePerVisitor: 0,
};

/* Manager morning brief: what needs a decision first, money second, doors
   last. One prioritized "needs you" list (people before products), today's
   takings in plain numbers, the shop-so-far strip, then compact links.
   Live store data behind skeletons; floor counts come from the live store. */
const RevenueChart = dynamic(
  () => import("@/components/admin/revenue-chart").then((m) => m.RevenueChart),
  { loading: () => <RevenueChartSkeleton />, ssr: false }
);

type Decision = {
  key: string;
  title: string;
  sub: string;
  href: string;
  badge?: { label: string; variant: "destructive" | "warning" | "secondary" };
};

export default function DashboardPage() {
  usePageTitle("Dashboard");
  const { data, loading, error, reload } = useApi("dashboard", getDashboard);
  const { visits, profile } = useStore();
  const storeId = profile?.storeId ?? "";
  const funnel = useApi<FunnelMetricsLive>(`funnel|${storeId}`, () =>
    storeId ? getVisitFunnel(storeId) : Promise.resolve({ ok: true, data: EMPTY_FUNNEL })
  );
  const first = profile?.name?.split(" ")[0] || "Manager";
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  const waiting = visits
    .filter((v) => !v.assignedSalespersonId && ["ARRIVED", "IDENTIFYING", "ASSIGNED"].includes(v.status))
    .sort((a, b) => +new Date(a.arrivedAt) - +new Date(b.arrivedAt));

  const attention = (data?.lowStock ?? []).slice().sort((a, b) => {
    const rank = (s: number) => (s <= 0 ? 0 : 1);
    return rank(a.stock) - rank(b.stock) || a.stock - b.stock;
  });
  const outCount = attention.filter((p) => p.stock <= 0).length;
  const lowCount = attention.length - outCount;

  /* People before products: waiting visitors, then empty shelves, then lows. */
  const decisions: Decision[] = [
    ...waiting.slice(0, 3).map((v) => ({
      key: v.id,
      title: v.customerName || "Unidentified customer",
      sub: `Waiting ${timeAgo(v.arrivedAt)} · nobody assigned yet`,
      href: "/floor",
    })),
    ...attention
      .filter((p) => p.stock <= 0)
      .slice(0, 3)
      .map((p) => ({
        key: p.id,
        title: p.name,
        sub: "None left on the shelf",
        href: `/inventory/${p.id}`,
        badge: { label: "Out", variant: "destructive" as const },
      })),
    ...attention
      .filter((p) => p.stock > 0)
      .slice(0, Math.max(0, 6 - waiting.slice(0, 3).length - attention.filter((p) => p.stock <= 0).slice(0, 3).length))
      .map((p) => ({
        key: p.id,
        title: p.name,
        sub: `Only ${p.stock} left`,
        href: `/inventory/${p.id}`,
        badge: { label: "Low", variant: "warning" as const },
      })),
  ].slice(0, 6);

  const briefBits: string[] = [];
  if (waiting.length > 0) briefBits.push(`${waiting.length} waiting for help`);
  if (outCount > 0) briefBits.push(`${outCount} out of stock`);
  else if (lowCount > 0) briefBits.push(`${lowCount} running low`);
  if ((funnel.data?.billedValue ?? 0) > 0) briefBits.push(`${formatINR(funnel.data!.billedValue)} collected`);
  const brief = briefBits.length > 0 ? `${briefBits.join(" · ")}.` : "Floor is clear and shelves are full.";

  return (
    <div className="staff-page">
      {/* Brief header — date, greeting, one sentence on the shop. */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="staff-kicker">{today}</p>
          <h1 className="staff-display mt-1.5 text-[34px] leading-none sm:text-[40px]">Good morning, {first}</h1>
          <p className="staff-sub">{loading && !data ? "Reading today's numbers…" : brief}</p>
        </div>
        <Button className="group min-h-[44px] bg-[var(--staff-brand)] text-white transition-all duration-150 hover:-translate-y-px hover:bg-[var(--staff-brand-deep)] active:translate-y-0" asChild>
          <Link href="/today">Open floor <ArrowRight data-icon="inline-end" className="transition-transform duration-150 group-hover:translate-x-0.5" /></Link>
        </Button>
      </div>

      {error && !data && (
        <div role="alert" className="staff-banner-error flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3.5">
          <div>
            <p className="text-[14px] font-semibold">Couldn&apos;t load store data.</p>
            <p className="mt-0.5 text-[13.5px] opacity-90">{error}</p>
          </div>
          <Button variant="outline" size="sm" className="min-h-[40px]" onClick={reload}>Try again</Button>
        </div>
      )}

      {/* Needs you first — one prioritized list, not three sections. */}
      <section aria-label="Needs your decision">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-1">
            <CardTitle>Needs you first</CardTitle>
            {decisions.length > 0 && (
              <span className="tnum rounded-full bg-muted px-2.5 py-0.5 text-[12px] font-semibold text-muted-foreground">
                {decisions.length}
              </span>
            )}
          </CardHeader>
          <CardContent className="px-2 pb-2">
            {loading && !data ? (
              <div className="flex flex-col gap-1.5 px-2 py-1" aria-busy="true" aria-label="Loading decisions">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton-soft h-[60px] rounded-xl" style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </div>
            ) : decisions.length > 0 ? (
              <ul className="divide-y divide-border/70">
                {decisions.map((d, i) => (
                  <li key={d.key}>
                    <Link href={d.href} className="group flex items-center gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-muted/50">
                      <span aria-hidden className="tnum w-6 shrink-0 text-center text-[13px] font-bold text-muted-foreground/60">
                        {i + 1}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-semibold tracking-tight">{d.title}</span>
                        <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">{d.sub}</span>
                      </span>
                      {d.badge && <Badge variant={d.badge.variant}>{d.badge.label}</Badge>}
                      <span aria-hidden className="shrink-0 text-[15px] font-bold text-muted-foreground/50 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-foreground">→</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mx-2 rounded-xl bg-muted/50 px-4 py-6 text-center text-[13.5px] text-muted-foreground">
                Nothing urgent — no one waiting, nothing out of stock.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Today's money + revenue chart. */}
      <div className="grid items-start gap-3 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle>Today&apos;s takings</CardTitle>
          </CardHeader>
          <CardContent aria-busy={funnel.loading && !funnel.data}>
            {funnel.data ? (
              <dl>
                <div className="flex items-baseline justify-between gap-3 border-b border-dashed py-3">
                  <dt className="text-[13.5px] text-muted-foreground">Collected</dt>
                  <dd className="staff-display text-[34px] leading-none">{formatINR(funnel.data.billedValue)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 border-b border-dashed py-3">
                  <dt className="text-[13.5px] text-muted-foreground">Bills closed</dt>
                  <dd className="tnum text-[20px] font-semibold">{funnel.data.billedVisits}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-3 py-3">
                  <dt className="text-[13.5px] text-muted-foreground">Pieces sold</dt>
                  <dd className="tnum text-[20px] font-semibold">{funnel.data.billedPieces}</dd>
                </div>
              </dl>
            ) : (
              <div className="flex flex-col gap-2 py-1" aria-busy="true" aria-label="Loading takings">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton-soft h-[52px] rounded-xl" style={{ animationDelay: `${i * 120}ms` }} />
                ))}
              </div>
            )}
            {funnel.error && !funnel.data && (
              <p className="pt-1 text-[13px] text-muted-foreground">Takings unavailable right now — yesterday&apos;s chart still works.</p>
            )}
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Sales by day</CardTitle>
            <p className="text-[13px] text-muted-foreground">Each bar is one day&apos;s shop + online sales.</p>
          </CardHeader>
          <CardContent>
            {data ? <RevenueChart data={data.revenue} /> : <RevenueChartSkeleton />}
          </CardContent>
        </Card>
      </div>

      {/* Shop so far — lifetime numbers in one quiet strip. */}
      <section aria-label="Shop so far">
        <Card>
          <CardContent className="px-2 py-2" aria-busy={loading && !data}>
            {data ? (
              <ul className="grid grid-cols-1 divide-y divide-border/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                {[
                  { label: "Total sales", value: formatINR(data.kpis.revenue), note: `${data.kpis.orders} bills`, href: "/orders" },
                  { label: "Products live", value: String(data.kpis.skus), note: `${data.kpis.units} pieces on the shelf`, href: "/inventory" },
                  { label: "Stock worth", value: formatINR(data.kpis.stockValue), note: "at cost price", href: "/inventory" },
                ].map((k) => (
                  <li key={k.label}>
                    <Link href={k.href} className="group block rounded-xl px-4 py-3.5 transition-colors hover:bg-muted/50">
                      <p className="text-[12.5px] font-medium text-muted-foreground">{k.label}</p>
                      <p className="tnum mt-0.5 text-[24px] font-semibold tracking-tight">{k.value}</p>
                      <p className="mt-0.5 text-[12.5px] text-muted-foreground">{k.note} <span aria-hidden>→</span></p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-3" aria-busy="true" aria-label="Loading shop totals">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton-soft h-[92px] rounded-xl" style={{ animationDelay: `${i * 110}ms` }} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Doors — compact text links, not icon cards. */}
      <nav aria-label="Shop sections" className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
        {[
          { href: "/today", label: "Today's floor" },
          { href: "/inventory", label: "All products" },
          { href: "/inventory/categories", label: "Categories" },
          { href: "/orders", label: "All sales" },
          { href: "/customers", label: "Shoppers" },
          { href: "/reports", label: "Reports" },
          { href: "/suppliers", label: "Suppliers" },
          { href: "/team", label: "Team" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="group flex min-h-[44px] items-center justify-between gap-2 border-b border-dashed py-2 text-[14px] font-medium hover:text-[var(--staff-brand)]">
            {l.label}
            <span aria-hidden className="text-muted-foreground/50 transition-transform duration-150 group-hover:translate-x-0.5">→</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
