-- S J FASHIONS live barcode records — ONE-TIME backfill for EXISTING databases.
-- Fresh databases already get everything from 010_base_schema.sql; run this file
-- only if 010 was applied BEFORE the SJ barcode + image_url upgrade.
-- Safe to re-run (all statements are ADD COLUMN IF NOT EXISTS / IF NOT EXISTS).

-- ---------- 1. SJ barcode columns on products ----------
alter table public.products add column if not exists barcode text unique;
alter table public.products add column if not exists company_barcode text;
alter table public.products add column if not exists branch_name text not null default 'HO';
alter table public.products add column if not exists department text;
alter table public.products add column if not exists brand_name text;
alter table public.products add column if not exists item_id text;
alter table public.products add column if not exists item_group_name text;
alter table public.products add column if not exists hsn_code text;
alter table public.products add column if not exists party_name text;
alter table public.products add column if not exists party_city text;
alter table public.products add column if not exists agent_name text;
alter table public.products add column if not exists design_no text;
alter table public.products add column if not exists lot_no text;
alter table public.products add column if not exists color text;
alter table public.products add column if not exists size text;
alter table public.products add column if not exists season text;
alter table public.products add column if not exists subcategory2 text;
alter table public.products add column if not exists subcategory3 text;
alter table public.products add column if not exists qty numeric not null default 1;
alter table public.products add column if not exists sales_rate numeric;
alter table public.products add column if not exists day_book text;
alter table public.products add column if not exists inward_vch_no text;
alter table public.products add column if not exists inward_vch_date date;
alter table public.products add column if not exists purc_bill_no text;
alter table public.products add column if not exists purchase_vch_no text;
alter table public.products add column if not exists purchase_vch_date date;
alter table public.products add column if not exists pur_rate numeric;
alter table public.products add column if not exists pur_net_rate numeric;
alter table public.products add column if not exists pur_cost_rate numeric;
alter table public.products add column if not exists pur_exp_rate numeric;
alter table public.products add column if not exists markup_pct numeric;
alter table public.products add column if not exists markdown_pct numeric;
-- Multiple images per product, declared at creation time:
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists image_urls text[] not null default '{}';

create index if not exists products_barcode_idx on public.products (barcode);
create index if not exists products_company_barcode_idx on public.products (company_barcode);
create index if not exists products_brand_idx on public.products (brand_name);
create index if not exists products_design_no_idx on public.products (design_no);
create index if not exists products_department_idx on public.products (department);

-- ---------- 2. product_images (one row per image) ----------
create table if not exists public.product_images (
  id text primary key default gen_random_uuid()::text,
  product_id text not null references public.products(id) on delete cascade,
  url text not null,
  position integer not null default 0,
  alt text,
  created_at timestamptz not null default now(),
  unique(product_id, url)
);
create index if not exists product_images_product_idx on public.product_images (product_id, position);

create or replace function public.sync_product_image_urls()
returns trigger
language plpgsql
as $$
begin
  update public.products p
  set
    image_urls = coalesce((
      select array_agg(pi.url order by pi.position, pi.created_at)
      from public.product_images pi
      where pi.product_id = coalesce(new.product_id, old.product_id)
    ), '{}'),
    updated_at = now()
  where p.id = coalesce(new.product_id, old.product_id);
  update public.products
  set image_url = image_urls[1]
  where id = coalesce(new.product_id, old.product_id);
  return coalesce(new, old);
end;
$$;
drop trigger if exists trg_sync_product_image_urls on public.product_images;
create trigger trg_sync_product_image_urls
  after insert or update or delete on public.product_images
  for each row execute procedure public.sync_product_image_urls();

-- ---------- 3. Storage bucket for product images ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- ---------- 4. RLS ----------
alter table public.product_images enable row level security;
drop policy if exists "authenticated read product images" on public.product_images;
create policy "authenticated read product images" on public.product_images for select to authenticated using (true);
drop policy if exists "manager write product images" on public.product_images;
create policy "manager write product images" on public.product_images for all to authenticated
  using (exists (select 1 from public.staff_profiles p where p.id = auth.uid() and p.role in ('STORE_MANAGER','ADMIN','MANAGEMENT') and p.active))
  with check (exists (select 1 from public.staff_profiles p where p.id = auth.uid() and p.role in ('STORE_MANAGER','ADMIN','MANAGEMENT') and p.active));
