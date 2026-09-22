import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { listSuppliers } from "@/features/catalogue/repository";

/* Real suppliers, derived from the client's export (Party Name), with active SKU
   counts computed from products rather than stored. */
export default async function SuppliersPage() {
  const suppliers = await listSuppliers().catch(() => []);

  return (
    <div className="staff-page">
      <PageHeader kicker="Catalogue" title="Suppliers" sub={`${suppliers.length} sourcing partners · reorder + ratings.`} />

      {!suppliers.length && (
        <Card>
          <CardContent className="flex flex-col items-center gap-1.5 px-6 py-12 text-center">
            <p className="text-[15px] font-semibold">No suppliers yet.</p>
            <p className="text-[13.5px] text-muted-foreground">
              Suppliers appear here from the product catalogue — add a product with a supplier to start sourcing.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid items-start gap-3 md:grid-cols-2">
        {suppliers.map((s) => (
          <Card key={s.id} className="group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-16px_rgba(28,25,23,0.3)]">
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-[15px] font-bold transition-colors group-hover:bg-[#1c1917] group-hover:text-white">{s.name.charAt(0)}</span>
                <div className="min-w-0">
                  <CardTitle className="truncate tracking-tight">{s.name}</CardTitle>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">{s.contact || "No contact on file"} · {s.city || "—"}</p>
                </div>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#FBF4E0] px-2.5 py-1 text-[13px] font-semibold text-[#8B6B1E]"><Star className="size-3.5 fill-amber-400 text-amber-400" />{s.rating}</span>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed pt-3">
              <p className="tnum text-[13px] text-muted-foreground">{s.activeProducts} active SKUs · {s.phone || "no phone"}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
