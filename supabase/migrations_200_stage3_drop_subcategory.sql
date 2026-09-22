
-- JadePink Store OS — 200 Stage 3: drop sub-category
-- Run AFTER 190 in SQL Editor (or via npm run db:migrate).
-- Safe to re-run (guarded add column).
--
-- visit_products.drop_subcategory: a short, specific refinement of the drop
-- reason captured on the floor ("Tight on bust" under FIT, "Above budget"
-- under PRICE). Optional — free text, but the UI offers a curated chip set
-- per reason code so the vendor/merchandising report stays consistent.
-- Independent of `note`, which stays the stylist's free-form remark.

alter table public.visit_products
  add column if not exists drop_subcategory text;

create index if not exists visit_products_drop_subcategory_idx
  on public.visit_products (visit_id) where drop_subcategory is not null;
