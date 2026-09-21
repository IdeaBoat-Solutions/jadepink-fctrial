import Link from "next/link";
import { notFound } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { getProduct, listMovements } from "@/features/catalogue/repository";
import { stockStatus, stockLabel } from "@/lib/inventory";
import { formatINR } from "@/lib/utils";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getProduct(id);
  if (!p) notFound();
  const moves = await listMovements(p.id);
  const s = stockStatus(p);

  return (
    <div className="staff-page">
      <PageHeader
        kicker={`${p.sku} · ${p.categoryName}`}
        title={p.name}
        sub={`${p.supplierName} · updated ${new Date(p.updatedAt).toLocaleDateString("en-IN")}`}
        actions={<Button variant="outline" className="group min-h-[44px] transition-all duration-150 hover:-translate-y-px active:translate-y-0" asChild><Link href="/inventory"><span aria-hidden className="transition-transform duration-150 group-hover:-translate-x-0.5">←</span> All inventory</Link></Button>}
      />
      <div className="grid items-start gap-3 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle>Stock</CardTitle>
              <Badge variant={s === "out-of-stock" ? "destructive" : s === "low-stock" ? "secondary" : "default"}>{stockLabel(s)}</Badge>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <p className="tnum text-[44px] font-semibold leading-none tracking-tight">{p.stock}<span className="ml-1 align-middle text-[15px] font-normal text-muted-foreground">units</span></p>
              <div className="min-w-[180px] flex-1 text-[13px] leading-relaxed text-muted-foreground">
                <p>Price <strong className="font-semibold text-foreground">{formatINR(p.price)}</strong> · MRP {formatINR(p.mrp)}</p>
                <p>Sizes {p.sizes.join(", ") || "—"} · {p.colors.join(", ") || "no colour on file"}</p>
                {(p.barcode || p.designNo) && (
                  <p className="tnum">Barcode {p.barcode || "—"} · Design {p.designNo || "—"}</p>
                )}
                <p>Reorder at ≤ {p.lowStockAt} units</p>
              </div>
              <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
                <Button variant="outline" className="min-h-[48px] flex-1 transition-all duration-150 hover:-translate-y-px hover:border-foreground active:translate-y-0 sm:flex-none"><Plus data-icon="inline-start" /> Stock in</Button>
                <Button variant="outline" className="min-h-[48px] flex-1 transition-all duration-150 hover:-translate-y-px hover:border-foreground active:translate-y-0 sm:flex-none"><Minus data-icon="inline-start" /> Stock out</Button>
              </div>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader><CardTitle>Movements</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table className="min-w-[480px]">
                <TableHeader><TableRow><TableHead>Type</TableHead><TableHead className="text-right">Qty</TableHead><TableHead>Reason</TableHead><TableHead>By</TableHead></TableRow></TableHeader>
                <TableBody>
                  {moves.map((m) => (
                    <TableRow key={m.id} className="transition-colors hover:bg-muted/40">
                      <TableCell><Badge variant={m.type === "IN" ? "default" : "secondary"}>{m.type}</Badge></TableCell>
                      <TableCell className="tnum text-right font-semibold">{m.qty}</TableCell>
                      <TableCell>{m.reason}</TableCell>
                      <TableCell className="text-muted-foreground">{m.actor}</TableCell>
                    </TableRow>
                  ))}
                  {!moves.length && <TableRow><TableCell colSpan={4} className="py-10 text-center text-muted-foreground">No movements yet. POST /api/products/{p.id}/movements to record.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
        <Card className="h-fit lg:sticky lg:top-20">
          <CardHeader><CardTitle>Commercials</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-2.5 text-[14px]">
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Margin / unit</span><strong className="tnum">{formatINR(p.price - p.cost)}</strong></div>
            <div className="flex justify-between gap-3"><span className="text-muted-foreground">Stock value</span><strong className="tnum">{formatINR(p.stock * p.cost)}</strong></div>
            <div className="flex justify-between gap-3 border-t border-dashed pt-2.5"><span className="text-muted-foreground">Supplier</span><strong className="text-right">{p.supplierName}</strong></div>
            <Button asChild className="group mt-2 min-h-[48px] bg-[#b4234d] text-white transition-all duration-150 hover:-translate-y-px hover:bg-[#93183d] active:translate-y-0"><Link href="/suppliers">Reorder <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5">→</span></Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
