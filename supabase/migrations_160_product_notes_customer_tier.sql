-- JadePink Store OS — 160 product handling notes + real loyalty tier
-- Run AFTER 150 in SQL Editor (or via npm run db:migrate).
-- Safe to re-run (all statements are IF NOT EXISTS / guarded).
--
-- visit_products.staff_note: the FC's handling note for a piece on the floor
-- ("Pack with garment sleeve", "Inquire on silhouette & comfort"). Free text,
-- separate from `note`, which belongs to the DROP verdict. Shown on the card.
--
-- customers.tier: the store's real loyalty tier, set by a manager. Nullable —
-- most customers simply have none. The visit header prefers this over the
-- visit-count heuristic when present.

alter table public.visit_products
  add column if not exists staff_note text;

alter table public.customers
  add column if not exists tier text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'customers_tier_check') then
    alter table public.customers
      add constraint customers_tier_check
      check (tier is null or tier in ('Silver', 'Gold'));
  end if;
end $$;

create index if not exists visit_products_staff_note_idx
  on public.visit_products (visit_id) where staff_note is not null;
