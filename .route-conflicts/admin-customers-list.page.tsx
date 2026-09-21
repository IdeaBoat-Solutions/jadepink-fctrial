"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";

export default function CustomersPage() {
  const { customers } = useStore();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader kicker="Sales" title="Customers" sub={`${customers.length} profiles · shared with the floor walk-in flow.`} actions={<Button asChild><Link href="/walk-in">Identify in walk-in</Link></Button>} />
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {customers.map((c) => (
          <Card key={c.id}>
            <CardHeader>
              <CardTitle className="text-[16px]">{c.name}</CardTitle>
              <p className="tnum text-[13px] text-muted-foreground">{c.displayMobile}</p>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <p className="tnum text-[13px] text-muted-foreground">{c.visitsCount} visits · {c.purchasesCount} purchases · {c.lastVisitLabel}</p>
              <Button variant="link" size="sm" asChild><Link href={`/customers/${c.id}`}>History</Link></Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
