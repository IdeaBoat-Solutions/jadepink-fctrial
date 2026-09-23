import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { getProduct, listMovements, listPurchasesForProduct } from "@/features/catalogue/repository";
import { stockStatus, stockLabel } from "@/lib/inventory";
import { formatINR, formatDateIN } from "@/lib/utils";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getProduct(id);
  if (!p) notFound();
  const [moves, bought] = await Promise.all([
    listMovements(p.id),
    listPurchasesForProduct(p.id).catch(() => ({ items: [], totalQty: 0, totalRevenue: 0 })),
  ]);
  const s = stockStatus(p);

  return (
    <div className="staff-page">
      <PageHeader
        kicker={`${p.sku} · ${p.categoryName}`}
        title={p.name}
        sub={`${p.supplierName} · updated ${new Date(p.updatedAt).toLocaleDateString("en-IN")}`}
        trail={[{ label: "Inventory", href: "/inventory" }, { label: p.name }]}
        actions={<Button variant="outline" className="group min-h-[44px] transition-all duration-150 hover:-translate-y-px active:translate-y-0" asChild><Link href="/inventory"><span aria-hidden className="transition-transform duration-150 group-hover:-translate-x-0.5">←</span> All inventory</Link></Button>}
      />
      <div className="grid items-start gap-3 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-3">
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <CardTitle>Stock</CardTitle>
              <Badge variant={s === "out-of-stock" ? "destructive" : s === "low-stock" ? "warning" : "success"}>{stockLabel(s)}</Badge>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-4">
              <p className="tnum text-[32px] font-semibold leading-none tracking-tight">{p.stock}<span className="ml-1 align-middle text-[15px] font-normal text-muted-foreground">units</span></p>
              <div className="min-w-0 flex-1 basis-48 text-[13px] leading-relaxed text-muted-foreground">
                <p>Price <strong className="font-semibold text-foreground">{formatINR(p.price)}</strong> · MRP {formatINR(p.mrp)}</p>
                <p>Sizes {p.sizes.join(", ") || "—"} · {p.colors.join(", ") || "no colour on file"}</p>
                {(p.barcode || p.designNo) && (
                  <p className="tnum">Barcode {p.barcode || "—"} · Design {p.designNo || "—"}</p>
                )}
                <p>Reorder at ≤ {p.lowStockAt} units</p>
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
                      <TableCell><Badge variant={m.type === "IN" ? "success" : "secondary"}>{m.type}</Badge></TableCell>
                      <TableCell className="tnum text-right font-semibold">{m.qty}</TableCell>
                      <TableCell>{m.reason}</TableCell>
                      <TableCell className="text-muted-foreground">{m.actor}</TableCell>
                    </TableRow>
                  ))}
                  {!moves.length && <TableRow><TableCell colSpan={4} className="py-10 text-center">
                    <span aria-hidden className="empty-plate mx-auto"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l2-7 4 14 2-7h6" /></svg></span>
                    <p className="mt-2 text-[14px] font-semibold">No movements yet.</p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">Stock moves for this item will appear here.</p>
                  </TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card className="overflow-hidden">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <CardTitle>Purchased by</CardTitle>
                <p className="tnum mt-0.5 text-[13px] text-muted-foreground">{bought.totalQty} pcs · {formatINR(bought.totalRevenue)}</p>
              </div>
              <Badge variant="outline">{bought.items.length} orders</Badge>
            </CardHeader>
            <CardContent className="p-0">
              <Table className="min-w-[560px]">
                <TableHeader><TableRow><TableHead>Customer</TableHead><TableHead>Order</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Line total</TableHead><TableHead>Bought</TableHead></TableRow></TableHeader>
                <TableBody>
                  {bought.items.map((b) => (
                    <TableRow key={`${b.orderId}-${b.customerPhone}`} className="transition-colors hover:bg-muted/40">
                      <TableCell><span className="font-medium">{b.customerName}</span><p className="tnum text-[12px] text-muted-foreground">{b.customerPhone}{b.fcName ? ` · FC ${b.fcName}` : ""}</p></TableCell>
                      <TableCell><span className="font-semibold tracking-tight">{b.orderCode}</span><p className="text-[12px] capitalize text-muted-foreground">{b.channel}</p></TableCell>
                      <TableCell className="tnum text-right font-semibold">{b.qty} × {formatINR(b.price)}</TableCell>
                      <TableCell className="tnum text-right font-semibold">{formatINR(b.qty * b.price)}</TableCell>
                      <TableCell className="text-[13px] text-muted-foreground">{b.orderedAt ? formatDateIN(b.orderedAt) : "—"}</TableCell>
                    </TableRow>
                  ))}
                  {!bought.items.length && <TableRow><TableCell colSpan={5} className="py-10 text-center">
                    <span aria-hidden className="empty-plate mx-auto"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 7h15l-1.5 9h-12z" /><path d="M6 7 5 3H2" /><circle cx="9" cy="20" r="1.5" /><circle cx="17" cy="20" r="1.5" /></svg></span>
                    <p className="mt-2 text-[14px] font-semibold">No purchases yet.</p>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">Walk-in sales land here the moment they close.</p>
                  </TableCell></TableRow>}
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
            <p className="text-[12.5px] leading-relaxed text-muted-foreground">Reorder keeps this product attached — the supplier list opens filtered to it.</p>
            <Button asChild className="group mt-2 min-h-[48px] bg-[var(--staff-brand)] text-white transition-all duration-150 hover:-translate-y-px hover:bg-[var(--staff-brand-deep)] active:translate-y-0"><Link href={`/suppliers?product=${p.id}`}>Reorder <span aria-hidden className="transition-transform duration-150 group-hover:translate-x-0.5">→</span></Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
