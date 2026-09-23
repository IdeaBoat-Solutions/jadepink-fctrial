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
            <span aria-hidden className="empty-plate"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7h16l-1.5 9h-13z" /><path d="M4 7 3 3H1" /></svg></span>
            <p className="mt-1 text-[15px] font-semibold">No categories yet.</p>
            <p className="text-[13.5px] text-muted-foreground">
              Categories appear here from the product catalogue — add a product with a category to file it.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <Card key={c.id} className="group transition-all duration-150 hover:-translate-y-px hover:border-foreground hover:shadow-[0_8px_18px_-12px_rgba(28,25,23,0.4)]">
            <CardHeader className="flex flex-row items-center gap-3">
              <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-[16px] font-bold text-foreground">{c.name.charAt(0)}</span>
              <CardTitle className="tracking-tight">{c.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center justify-between gap-2 border-t border-dashed pt-3">
              <p className="tnum text-[13px] text-muted-foreground">
                {c.productCount} {c.productCount === 1 ? "product" : "products"}
                {c.productCount === 0 && <span> · nothing filed here yet</span>}
              </p>
              <Button variant="outline" size="sm" className="min-h-[44px] transition-all duration-150 group-hover:border-foreground" asChild>
                <Link href={`/inventory?category=${encodeURIComponent(c.id)}`}>Open <span aria-hidden>→</span></Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
