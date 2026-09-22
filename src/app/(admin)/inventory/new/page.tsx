"use client";

import { useEffect, useState } from "react";
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
import { listCategories, listSuppliers } from "@/lib/api";
import { productSchema, type Category, type ProductInput, type Supplier } from "@/lib/inventory";

/* Add product — live categories + suppliers from the API (never seed data),
   POST /api/products, real duplicate errors surfaced instead of a fake toast. */

export default function NewProductPage() {
  const router = useRouter();
  const form = useForm<ProductInput>({ resolver: zodResolver(productSchema) as Resolver<ProductInput>, defaultValues: { stock: 0, lowStockAt: 5 } });
  // useWatch (not form.watch) so React Compiler can memoize this component.
  const categoryId = useWatch({ control: form.control, name: "categoryId" });
  const supplierId = useWatch({ control: form.control, name: "supplierId" });

  const [cats, setCats] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [saving, setSaving] = useState(false);
  const [formErr, setFormErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [c, s] = await Promise.all([listCategories(), listSuppliers()]);
      if (cancelled) return;
      if (c.ok && Array.isArray(c.data.data)) setCats(c.data.data);
      if (s.ok && Array.isArray(s.data.data)) setSuppliers(s.data.data);
    })();
    return () => { cancelled = true; };
  }, []);

  const onSubmit = async (v: ProductInput) => {
    setSaving(true);
    setFormErr("");
    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(v),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormErr(json.error ?? "Could not save the product.");
        return;
      }
      toast.success(`${v.name} added`, { description: `SKU ${v.sku} · ${v.stock} units` });
      router.push("/inventory");
    } catch {
      setFormErr("Connection lost — nothing was saved. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="staff-page mx-auto w-full max-w-2xl">
      <PageHeader kicker="Catalogue" title="Add product" sub="SKU, price, stock and category — saved to the live catalogue." />
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
                {form.formState.errors.sku && <p role="alert" className="flex items-center gap-1.5 text-[13px] font-medium text-destructive"><span aria-hidden className="inline-block size-1 rounded-full bg-destructive" />{form.formState.errors.sku.message}</p>}
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
                <Select value={categoryId ?? ""} onValueChange={(v) => form.setValue("categoryId", v)}>
                  <SelectTrigger aria-label="Category"><span>{categoryId ? cats.find((c) => c.id === categoryId)?.name : "Pick category"}</span></SelectTrigger>
                  <SelectContent>
                    {cats.length === 0 && <SelectItem value="__none" disabled>No categories yet</SelectItem>}
                    {cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Supplier</FieldLabel>
                <Select value={supplierId ?? ""} onValueChange={(v) => form.setValue("supplierId", v)}>
                  <SelectTrigger aria-label="Supplier"><span>{supplierId ? suppliers.find((s) => s.id === supplierId)?.name : "Pick supplier"}</span></SelectTrigger>
                  <SelectContent>
                    {suppliers.length === 0 && <SelectItem value="__none" disabled>No suppliers yet</SelectItem>}
                    {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {formErr && <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-[13.5px] font-medium text-destructive">{formErr}</p>}
            <div className="flex flex-col gap-2 border-t border-dashed pt-4 sm:flex-row">
              <Button type="submit" disabled={saving} className="min-h-[52px] flex-1 bg-[var(--staff-brand)] text-[15px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:bg-[var(--staff-brand-deep)] active:translate-y-0 disabled:opacity-60">{saving ? "Saving…" : "Save product"}</Button>
              <Button type="button" variant="outline" className="min-h-[52px] transition-all duration-150 hover:-translate-y-px active:translate-y-0" asChild><Link href="/inventory">Cancel</Link></Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
