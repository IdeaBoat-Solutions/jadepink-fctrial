import Link from "next/link";
import { Button } from "@/components/ui/button";

/* Manager opens an inventory record that no longer exists — deleted SKU,
   stale bookmark, mistyped id. Staff styling, two doors out. */
export default function InventoryNotFound() {
  return (
    <div className="staff-page">
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Product not found
        </p>
        <h1 className="mt-2 text-[22px] font-semibold tracking-tight">
          This SKU isn&apos;t on file.
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          It may have been deleted, or the link is out of date. Search the
          catalogue, or go back to inventory.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button className="min-h-[44px]" asChild>
            <Link href="/inventory">Back to inventory</Link>
          </Button>
          <Button variant="outline" className="min-h-[44px]" asChild>
            <Link href="/products">Search catalogue</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
