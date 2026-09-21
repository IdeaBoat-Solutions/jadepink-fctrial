"use client";

/* Isolated on purpose: recharts is the heaviest dependency in the tree and is
   only used here. Loaded via next/dynamic so the dashboard's KPIs paint first
   and this chunk streams in behind a skeleton. */

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export function RevenueChart({ data }: { data: { day: string; revenue: number }[] }) {
  return (
    <ChartContainer config={{ revenue: { label: "Revenue", color: "#b4234d" } }} className="h-[240px] w-full">
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="day" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={28} tick={{ fontSize: 11 }} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          tick={{ fontSize: 11 }}
          tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

export function RevenueChartSkeleton() {
  return (
    <div className="skeleton-soft h-[240px] w-full rounded-xl" aria-hidden />
  );
}
