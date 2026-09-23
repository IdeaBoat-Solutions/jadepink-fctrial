import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { listSuppliers } from "@/features/catalogue/repository";

/* Real suppliers, derived from the client's export (Party Name), with active SKU
   counts computed from products rather than stored. */
export default async function SuppliersPage({ searchParams }: { searchParams?: Promise<{ product?: string }> }) {
  const suppliers = await listSuppliers().catch(() => []);
  const sp = searchParams ? await searchParams : undefined;
  const productCtx = sp?.product ? String(sp.product) : null;

  return (
    <div className="staff-page">
      <PageHeader
        kicker="Catalogue"
        title="Suppliers"
        sub={`${suppliers.length} sourcing partners · reorder + ratings.`}
        trail={[{ label: "Inventory", href: "/inventory" }, { label: "Suppliers" }]}
      />

      {productCtx && (
        <p role="status" className="staff-banner-note rounded-xl px-4 py-3 text-[13.5px]">
          <strong>Reorder context kept</strong> — you came from a product.{" "}
          <a href={`/inventory/${productCtx}`} className="font-semibold underline underline-offset-2">Back to product</a>
        </p>
      )}

      {!suppliers.length && (
        <Card>
          <CardContent className="flex flex-col items-center gap-1.5 px-6 py-12 text-center">
            <span aria-hidden className="empty-plate"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" /></svg></span>
            <p className="mt-1 text-[15px] font-semibold">No suppliers yet.</p>
            <p className="text-[13.5px] text-muted-foreground">
              Suppliers appear here from the product catalogue — add a product with a supplier to start sourcing.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid items-start gap-3 md:grid-cols-2">
        {suppliers.map((s) => (
          <Card key={s.id} className="group transition-all duration-150 hover:-translate-y-px hover:border-foreground hover:shadow-[0_8px_18px_-12px_rgba(28,25,23,0.4)]">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-[15px] font-bold text-foreground">{s.name.charAt(0)}</span>
                <div className="min-w-0">
                  <CardTitle className="truncate tracking-tight">{s.name}</CardTitle>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">{s.contact || "No contact on file"} · {s.city || "—"}</p>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warn-bg px-2.5 py-1 text-[13px] font-semibold text-warn"><Star className="size-3.5 fill-current" />{s.rating}</span>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed pt-3">
              <p className="tnum text-[13px] text-muted-foreground">{s.activeProducts} active SKUs</p>
              {s.phone ? (
                <a href={`tel:${s.phone.replace(/\s/g, "")}`} className="tnum inline-flex min-h-[44px] items-center text-[13px] font-semibold underline underline-offset-2 hover:text-foreground">{s.phone}</a>
              ) : (
                <p className="text-[13px] text-muted-foreground">no phone</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
