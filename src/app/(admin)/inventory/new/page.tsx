"use client";

import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import { SEED_CATEGORIES, SEED_SUPPLIERS, productSchema, type ProductInput } from "@/lib/inventory";

export default function NewProductPage() {
  const router = useRouter();
  const form = useForm<ProductInput>({ resolver: zodResolver(productSchema) as Resolver<ProductInput>, defaultValues: { stock: 0, lowStockAt: 5 } });
  // useWatch (not form.watch) so React Compiler can memoize this component.
  const categoryId = useWatch({ control: form.control, name: "categoryId" });
  const supplierId = useWatch({ control: form.control, name: "supplierId" });

  const onSubmit = (v: ProductInput) => {
    toast.success(`${v.name} drafted`, { description: `POST /api/products · SKU ${v.sku} · ${v.stock} units` });
    router.push("/inventory");
  };

  return (
    <div className="staff-page mx-auto w-full max-w-2xl">
      <PageHeader kicker="Catalogue" title="Add product" sub="Validated with Zod + React Hook Form. Saves via /api/products." />
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/40"><CardTitle>Product details</CardTitle></CardHeader>
        <CardContent className="pt-5">
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input id="name" {...form.register("name")} placeholder="Name as printed on the label" className="min-h-[48px] rounded-xl transition-all focus:ring-4 focus:ring-[var(--staff-brand)]/10" />
              {form.formState.errors.name && <p role="alert" className="flex items-center gap-1.5 text-[13px] font-medium text-destructive"><span aria-hidden className="inline-block size-1 rounded-full bg-destructive" />{form.formState.errors.name.message}</p>}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="sku">SKU</FieldLabel>
                <Input id="sku" {...form.register("sku")} placeholder="JP-DR-009" className="min-h-[48px] rounded-xl" />
              </Field>
              <Field>
                <FieldLabel htmlFor="stock">Opening stock</FieldLabel>
                <Input id="stock" type="number" {...form.register("stock")} className="tnum min-h-[48px] rounded-xl" />
              </Field>
              <Field>
                <FieldLabel htmlFor="price">Price (₹)</FieldLabel>
                <Input id="price" type="number" {...form.register("price")} className="tnum min-h-[48px] rounded-xl" />
                {form.formState.errors.price && <p role="alert" className="flex items-center gap-1.5 text-[13px] font-medium text-destructive"><span aria-hidden className="inline-block size-1 rounded-full bg-destructive" />{form.formState.errors.price.message}</p>}
              </Field>
              <Field>
                <FieldLabel htmlFor="lowStockAt">Low-stock at</FieldLabel>
                <Input id="lowStockAt" type="number" {...form.register("lowStockAt")} className="tnum min-h-[48px] rounded-xl" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Category</FieldLabel>
                <Select onValueChange={(v) => form.setValue("categoryId", v)}>
                  <SelectTrigger aria-label="Category"><span>{categoryId ? SEED_CATEGORIES.find((c) => c.id === categoryId)?.name : "Pick category"}</span></SelectTrigger>
                  <SelectContent>{SEED_CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Supplier</FieldLabel>
                <Select onValueChange={(v) => form.setValue("supplierId", v)}>
                  <SelectTrigger aria-label="Supplier"><span>{supplierId ? SEED_SUPPLIERS.find((s) => s.id === supplierId)?.name : "Pick supplier"}</span></SelectTrigger>
                  <SelectContent>{SEED_SUPPLIERS.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <div className="flex flex-col gap-2 border-t border-dashed pt-4 sm:flex-row">
              <Button type="submit" className="min-h-[52px] flex-1 bg-[var(--staff-brand)] text-[15px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:bg-[var(--staff-brand-deep)] active:translate-y-0">Save product</Button>
              <Button type="button" variant="outline" className="min-h-[52px] transition-all duration-150 hover:-translate-y-px active:translate-y-0" asChild><Link href="/inventory">Cancel</Link></Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
