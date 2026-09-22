-- JadePink Store OS — 210: sales ledger (billing writes the money tables)
-- Run AFTER 200 in SQL Editor (or via npm run db:migrate).
-- Safe to re-run (DROP IF EXISTS / IF NOT EXISTS / OR REPLACE).
--
-- Until now, billing only flipped visit_products to PURCHASED, so orders /
-- order_items stayed empty while Orders, Reports, Dashboard revenue, Activity
-- sales and the inventory "Purchased by" list all read them. record_sale closes
-- that gap atomically: one billing action -> one order + its line items,
-- idempotent via visit_products.order_id (a retry records only what is missing).

-- 1) order_items had SELECT-only RLS, so inserts were impossible for both floor
--    billing and POST /api/orders. Mirror the existing orders insert policy.
drop policy if exists "authenticated insert order items" on public.order_items;
create policy "authenticated insert order items" on public.order_items
  for insert to authenticated with check (true);

-- 2) Back-link from a billed piece to the order it was recorded on.
--    NULL = not yet in the ledger; the RPC fills it, which is what makes
--    record_sale idempotent (a piece is never recorded twice).
alter table public.visit_products
  add column if not exists order_id text references public.orders(id);
create index if not exists visit_products_order_idx
  on public.visit_products (order_id) where order_id is not null;

-- 3) record_sale: ledger write for one billing action.
--    SECURITY INVOKER (same doctrine as the 190 RPCs): RLS on visits /
--    customers / catalogue / orders / order_items / visit_products still
--    governs every row. The visit row is locked FOR UPDATE so two concurrent
--    bills on the same visit cannot interleave.
create or replace function public.record_sale(
  p_visit_id text,
  p_bill_number text,
  p_visit_product_ids text[],
  p_actor uuid
)
returns public.orders
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_visit public.visits;
  v_customer_name text;
  v_customer_phone text := '';
  v_fc_name text;
  v_total integer := 0;
  v_count integer := 0;
  v_order public.orders;
begin
  select * into v_visit from public.visits where id = p_visit_id for update;
  if not found then
    raise exception 'VISIT_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Customer snapshot: orders.customer_name / customer_phone are NOT NULL.
  if v_visit.customer_id is not null then
    select c.name, coalesce(c.mobile, '')
      into v_customer_name, v_customer_phone
      from public.customers c
     where c.id = v_visit.customer_id;
  end if;
  v_customer_name := coalesce(v_customer_name, 'Walk-in customer');

  -- FC display name via the owner-privileged roster view (granted to
  -- authenticated), so RLS on staff_profiles does not block the lookup.
  if v_visit.assigned_salesperson_id is not null then
    select s.name into v_fc_name
      from public.v_salespeople s
     where s.id = v_visit.assigned_salesperson_id;
  end if;

  select coalesce(sum(pv.price), 0), count(*)
    into v_total, v_count
    from public.visit_products vp
    join public.product_variants pv on pv.id = vp.product_variant_id
   where vp.visit_id = p_visit_id
     and vp.id = any(p_visit_product_ids)
     and vp.status = 'PURCHASED'
     and vp.order_id is null;

  -- Nothing missing (retry after success, or no eligible piece): no-op.
  if v_count = 0 then
    return null;
  end if;

  -- One order per billing action. Bill numbers are not globally unique,
  -- so the bill (or JP) is a readable prefix and a random suffix guarantees
  -- the unique constraint without a retry loop.
  insert into public.orders
    (code, customer_id, customer_name, customer_phone, total, status,
     channel, fc_name, staff_id, store_id, created_at)
  values
    (coalesce(nullif(trim(p_bill_number), ''), 'JP') || '-' ||
       upper(substr(md5(gen_random_uuid()::text), 1, 8)),
     v_visit.customer_id,
     v_customer_name,
     v_customer_phone,
     v_total,
     'delivered',
     'walk-in',
     v_fc_name,
     p_actor,
     v_visit.store_id,
     now())
  returning * into v_order;

  insert into public.order_items (order_id, product_id, product_name, qty, price)
  select v_order.id, p.id, p.name, 1, pv.price
    from public.visit_products vp
    join public.product_variants pv on pv.id = vp.product_variant_id
    join public.products p on p.id = pv.product_id
   where vp.visit_id = p_visit_id
     and vp.id = any(p_visit_product_ids)
     and vp.status = 'PURCHASED'
     and vp.order_id is null;

  update public.visit_products
     set order_id = v_order.id,
         updated_at = now()
   where id = any(p_visit_product_ids)
     and status = 'PURCHASED'
     and order_id is null;

  return v_order;
end;
$$;
