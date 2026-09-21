"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { CustomerSnapshot, HistoryLayers } from "@/components/ops";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { getCustomer } = useStore();
  const c = getCustomer(id as string);

  if (!c) {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title="Customer not found" sub="It may have been cleared on demo reset." />
        <Button variant="outline" asChild className="w-fit"><Link href="/customers">← All customers</Link></Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader kicker={c.displayMobile} title={c.name} sub={`${c.visitsCount} visits · ${c.purchasesCount} purchases · last ${c.lastVisitLabel}`} actions={<Button variant="outline" asChild><Link href="/customers">← All</Link></Button>} />
      <div className="grid gap-3 lg:grid-cols-[1fr_380px]">
        <Card><CardHeader><CardTitle>Snapshot</CardTitle></CardHeader><CardContent><CustomerSnapshot customer={c} /></CardContent></Card>
        <Card><CardHeader><CardTitle>Visit history</CardTitle></CardHeader><CardContent><HistoryLayers customerId={c.id} /></CardContent></Card>
      </div>
    </div>
  );
}
