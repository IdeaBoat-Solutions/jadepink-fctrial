"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Package, ShoppingCart, Truck, TriangleAlert, IndianRupee, Boxes } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { BentoGrid, BentoGridItem } from "@/components/aceternity/bento-grid";
import { CardSpotlight } from "@/components/aceternity/spotlight";
import { RevenueChartSkeleton } from "@/components/admin/revenue-chart";
import { SEED_PRODUCTS, SEED_ORDERS, SEED_SUPPLIERS, dashboardKPIs, revenueByDay, stockStatus } from "@/lib/inventory";
import { formatINR } from "@/lib/utils";

/* recharts streams in behind a skeleton — KPIs and restock list paint first. */
const RevenueChart = dynamic(
  () => import("@/components/admin/revenue-chart").then((m) => m.RevenueChart),
  { loading: () => <RevenueChartSkeleton />, ssr: false }
);

export default function DashboardPage() {
  const kpis = dashboardKPIs(SEED_PRODUCTS, SEED_ORDERS);
  const revenue = revenueByDay(SEED_ORDERS);
  const lowStock = SEED_PRODUCTS.filter((p) => stockStatus(p) !== "in-stock").slice(0, 5);

  return (
    <div className="staff-page">
      <PageHeader
        kicker="JadePink Ahmedabad · live"
        title="Dashboard"
        sub="Revenue, stock health and today's floor — one glance."
        actions={
          <>
            <Button variant="outline" className="min-h-[44px] transition-all duration-150 hover:-translate-y-px active:translate-y-0" asChild><Link href="/inventory">Manage inventory</Link></Button>
            <Button className="group min-h-[44px] bg-[#b4234d] text-white transition-all duration-150 hover:-translate-y-px hover:bg-[#93183d] active:translate-y-0" asChild><Link href="/today">Open floor <ArrowRight data-icon="inline-end" className="transition-transform duration-150 group-hover:translate-x-0.5" /></Link></Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Revenue (all orders)", value: formatINR(kpis.revenue), icon: IndianRupee, note: `${kpis.orders} orders` },
          { label: "Units on hand", value: String(kpis.units), icon: Boxes, note: `${SEED_PRODUCTS.length} SKUs` },
          { label: "Low stock", value: String(kpis.low), icon: TriangleAlert, note: "reorder soon", warn: kpis.low > 0 },
          { label: "Out of stock", value: String(kpis.out), icon: Package, note: "lost sales risk", danger: kpis.out > 0 },
        ].map((k) => (
          <CardSpotlight key={k.label} className="rounded-2xl">
            <Card className="group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-16px_rgba(28,25,23,0.3)]">
              <CardHeader className="flex flex-row items-center justify-between pb-1">
                <CardTitle className="text-[13px] font-medium text-muted-foreground">{k.label}</CardTitle>
                <span className={`grid size-7 place-items-center rounded-lg transition-colors ${"warn" in k && k.warn ? "bg-[#FBF4E0] text-[#8B6B1E]" : "danger" in k && k.danger ? "bg-[#FCEAEA] text-[#8B2020]" : "bg-muted text-muted-foreground"} group-hover:scale-105`}><k.icon className="size-4" /></span>
              </CardHeader>
              <CardContent>
                <p className="tnum text-[28px] font-semibold tracking-tight">{k.value}</p>
                <p className="mt-0.5 text-[12.5px] text-muted-foreground">{k.note}</p>
              </CardContent>
            </Card>
          </CardSpotlight>
        ))}
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[1.4fr_1fr]">
        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Revenue by day</CardTitle>
            <p className="text-[13px] text-muted-foreground">Seed orders aggregated client-side; API route /api/dashboard serves the same.</p>
          </CardHeader>
          <CardContent>
            <RevenueChart data={revenue} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Needs restock</CardTitle>
            <Button variant="link" size="sm" className="group min-h-[36px]" asChild><Link href="/inventory">View all <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5">→</span></Link></Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {lowStock.map((p) => (
              <Link key={p.id} href={`/inventory/${p.id}`} className="group flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 transition-all duration-150 hover:-translate-y-px hover:border-foreground hover:shadow-[0_8px_18px_-12px_rgba(28,25,23,0.4)] active:translate-y-0">
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold">{p.name}</span>
                  <span className="tnum block text-[12px] text-muted-foreground">{p.sku} · {p.stock} left</span>
                </span>
                <Badge variant={stockStatus(p) === "out-of-stock" ? "destructive" : "secondary"}>
                  {stockStatus(p) === "out-of-stock" ? "Out" : "Low"}
                </Badge>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <BentoGrid>
        <BentoGridItem
          className="md:col-span-1 transition-transform duration-200 hover:-translate-y-0.5"
          title="Floor workflow"
          description="Walk-in → identify → assign FC → start visit. The ops module stays untouched."
          header={<div className="flex h-20 items-center justify-center rounded-xl bg-[#1c1917] text-white"><ShoppingCart className="size-6" /></div>}
        />
        <BentoGridItem
          className="md:col-span-1 transition-transform duration-200 hover:-translate-y-0.5"
          title="Inventory truth"
          description="SKU, stock, low-stock threshold and supplier on every product. CRUD + movements."
          header={<div className="flex h-20 items-center justify-center rounded-xl bg-[#fdf0f4]"><Package className="size-6 text-[#b4234d]" /></div>}
        />
        <BentoGridItem
          className="md:col-span-1 transition-transform duration-200 hover:-translate-y-0.5"
          title={`${SEED_SUPPLIERS.length} suppliers wired`}
          description="Reorder from the supplier page. Ratings and active SKUs tracked."
          header={<div className="flex h-20 items-center justify-center rounded-xl bg-muted"><Truck className="size-6" /></div>}
        />
      </BentoGrid>
    </div>
  );
}
