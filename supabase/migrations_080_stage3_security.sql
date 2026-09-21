
-- JadePink Store OS — 080 Stage 3: RLS + indexes for new tables
-- Run AFTER 060 + 070 in SQL Editor.
-- Follows existing Stage 2 store-scoped pattern.

-- ---------- RLS on new tables ----------
alter table public.product_variants enable row level security;
alter table public.drop_reasons enable row level security;
alter table public.visit_products enable row level security;

-- Remove old policies if they exist (idempotent re-run)
drop policy if exists "authenticated read product variants" on public.product_variants;
drop policy if exists "manager write product variants" on public.product_variants;
drop policy if exists "authenticated read drop reasons" on public.drop_reasons;
drop policy if exists "manager write drop reasons" on public.drop_reasons;
drop policy if exists "staff read own store visit products" on public.visit_products;
drop policy if exists "staff write own store visit products" on public.visit_products;

-- Product variants: anyone signed in can read (floor needs it for scanning)
create policy "authenticated read product variants" on public.product_variants
  for select to authenticated using (true);

-- Product variants write: managers/admins only (catalogue management)
create policy "manager write product variants" on public.product_variants
  for all to authenticated
  using (
    exists (
      select 1 from public.staff_profiles p
      where p.id = auth.uid()
        and p.role in ('STORE_MANAGER', 'ADMIN', 'MANAGEMENT')
        and p.active
    )
  )
  with check (
    exists (
      select 1 from public.staff_profiles p
      where p.id = auth.uid()
        and p.role in ('STORE_MANAGER', 'ADMIN', 'MANAGEMENT')
        and p.active
    )
  );

-- Drop reasons: anyone signed in can read (floor needs it for drop reason selection)
create policy "authenticated read drop reasons" on public.drop_reasons
  for select to authenticated using (true);

-- Drop reasons write: managers/admins only (configuring reasons)
create policy "manager write drop reasons" on public.drop_reasons
  for all to authenticated
  using (
    exists (
      select 1 from public.staff_profiles p
      where p.id = auth.uid()
        and p.role in ('STORE_MANAGER', 'ADMIN', 'MANAGEMENT')
        and p.active
    )
  )
  with check (
    exists (
      select 1 from public.staff_profiles p
      where p.id = auth.uid()
        and p.role in ('STORE_MANAGER', 'ADMIN', 'MANAGEMENT')
        and p.active
    )
  );

-- Visit products: store-scoped read (same pattern as visits)
-- Authorization flows through the parent visit → store, never a bare
-- "any authenticated" clause. Admins/management see all stores.
create policy "staff read own store visit products" on public.visit_products
  for select to authenticated
  using (
    exists (
      select 1
      from public.visits v
      join public.staff_profiles p on p.id = auth.uid()
      where v.id = public.visit_products.visit_id
        and p.active
        and (p.role in ('ADMIN', 'MANAGEMENT') or p.store_id = v.store_id)
    )
  );

-- Visit products: store-scoped write (same pattern as visits)
create policy "staff write own store visit products" on public.visit_products
  for all to authenticated
  using (
    exists (
      select 1 from public.staff_profiles p
      where p.id = auth.uid()
        and p.active
        and (
          p.role in ('ADMIN', 'MANAGEMENT')
          or p.store_id in (
            select v.store_id from public.visits v where v.id = public.visit_products.visit_id
          )
        )
    )
  )
  with check (
    exists (
      select 1 from public.staff_profiles p
      where p.id = auth.uid()
        and p.active
        and (
          p.role in ('ADMIN', 'MANAGEMENT')
          or p.store_id in (
            select v.store_id from public.visits v where v.id = public.visit_products.visit_id
          )
        )
    )
  );

-- Also allow event creation through the visit_events path
-- (visit_products writes create events, and those events need to be insertable)
-- The existing "staff write own store visit events" policy already covers this
-- since it checks visit_id → store relationship.

-- ---------- Additional indexes for Stage 3 ----------

-- Product lookup by barcode (fast scan)
create index if not exists product_variants_barcode_search_idx
  on public.product_variants (barcode) where barcode is not null;

-- Product lookup by SKU (fast search)
create index if not exists product_variants_sku_search_idx
  on public.product_variants (sku) where sku is not null;

-- Visit products by visit + status (for summary counts)
create index if not exists visit_products_visit_status_summary_idx
  on public.visit_products (visit_id, status);

-- Visit products for variant analytics
create index if not exists visit_products_variant_status_analytics_idx
  on public.visit_products (product_variant_id, status);

-- Visit events: entity-based lookups
create index if not exists visit_events_entity_type_idx
  on public.visit_events (entity_type, entity_id);

-- Visit events: visit timeline (already exists but ensure DESC order support)
create index if not exists visit_events_visit_created_desc_idx
  on public.visit_events (visit_id, created_at desc);
