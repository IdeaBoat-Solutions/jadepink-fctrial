import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { listCategories } from "@/features/catalogue/repository";

/* Categories + live product counts (derived, never stored). Counts come from the
   same join the inventory list uses, so the two screens cannot disagree. */
export default async function CategoriesPage() {
  const categories = await listCategories().catch(() => []);
  const total = categories.reduce((s, c) => s + c.productCount, 0);

  return (
    <div className="staff-page">
      <PageHeader
        kicker="Catalogue"
        title="Categories"
        sub={`${categories.length} categor${categories.length === 1 ? "y" : "ies"} across ${total} SKUs.`}
      />

      {!categories.length && (
        <Card>
          <CardContent className="flex flex-col items-center gap-1.5 px-6 py-12 text-center">
            <p className="text-[15px] font-semibold">No categories yet.</p>
            <p className="text-[13.5px] text-muted-foreground">
              Categories are created from the Department column on the client&apos;s barcode export — run <code className="rounded bg-muted px-1.5 py-0.5 text-[12.5px]">npm run seed:sj</code>.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <Card key={c.id} className="group transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-16px_rgba(28,25,23,0.3)]">
            <CardHeader className="flex flex-row items-center gap-3">
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#fdf0f4] text-[16px] font-bold text-[#b4234d] transition-transform duration-150 group-hover:scale-105">{c.name.charAt(0)}</span>
              <CardTitle className="tracking-tight">{c.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed pt-3">
              <p className="tnum text-[13px] text-muted-foreground">
                {c.productCount} {c.productCount === 1 ? "product" : "products"}
                {c.productCount === 0 && <span className="text-[#a8a29e]"> · nothing filed here yet</span>}
              </p>
              <Button variant="outline" size="sm" className="min-h-[40px] transition-all duration-150 group-hover:border-foreground" asChild>
                <Link href={`/inventory?cat=${encodeURIComponent(c.id)}`}>Open <span aria-hidden>→</span></Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="rounded-xl bg-muted/50 px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">Tip: filtering lives on /inventory via the category select. This page is the taxonomy home for the API /api/categories.</p>
    </div>
  );
}
