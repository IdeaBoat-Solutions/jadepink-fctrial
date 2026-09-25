-- JadePink Store OS — 240: price snapshot at bill time.
--
-- Why: customer history (src/features/customers/history.ts) computed billedValue
-- from the LIVE product_variants.price every time it was read. Editing a price
-- in the catalogue therefore silently rewrote what past visits appeared to be
-- worth — historical sales figures drifted with no audit trail.
--
-- order_items already snapshots price per sale (migration 210), but the FC's
-- own visit history did not. This adds the same guarantee at the source:
--   visit_products.price_at_bill  = the variant price frozen at PURCHASED time.
--
-- Reads prefer price_at_bill and fall back to the live price only for rows
-- billed before this migration (or where the variant was deleted). Backfill
-- stamps already-PURCHASED rows with today's price — a one-time best effort
-- that is still better than reading a moving target forever.
-- Safe to re-run.

alter table public.visit_products
  add column if not exists price_at_bill integer;

-- One-time backfill for sales recorded before the snapshot existed.
update public.visit_products vp
   set price_at_bill = pv.price
  from public.product_variants pv
 where pv.id = vp.product_variant_id
   and vp.price_at_bill is null
   and vp.status = 'PURCHASED';

-- Report/dashboard queries that scan billed rows can use the frozen column.
create index if not exists visit_products_price_at_bill_idx
  on public.visit_products (price_at_bill) where price_at_bill is not null;
