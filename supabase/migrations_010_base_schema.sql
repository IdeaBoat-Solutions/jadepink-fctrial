-- JadePink Store OS — 010 base schema: Stage 1 catalogue + Stage 2 floor (no Prisma).
-- Files run in filename order: 010 -> 020 -> 030 ... (see supabase/README.md,
-- or `npm run db:migrate` for the scripted order).
-- Run order in Supabase Dashboard > SQL Editor:
--   1. Paste THIS file (010_base_schema) > Run   — creates tables
--   2. Paste 020_security.sql > Run              — RLS + role views + auth trigger
--   3. npm run seed:catalog                          — store + catalogue + customers
--   4. npm run seed:auth                             — manager + sales Auth users
-- Safe to re-run (all statements are IF NOT EXISTS / OR REPLACE / upsert-safe).

create extension if not exists "pgcrypto";

-- ---------- Stores ----------
create table if not exists public.stores (
  id text primary key,
  name text not null,
  code text unique,
  city text not null default 'Mumbai',
  address text,
  location text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------- Staff (1:1 with auth.users) ----------
create table if not exists public.staff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  phone text,
  role text not null default 'FC'
    check (role in ('FC', 'STORE_MANAGER', 'ADMIN', 'MANAGEMENT')),
  store_id text references public.stores(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists staff_profiles_role_idx on public.staff_profiles (role);
create index if not exists staff_profiles_store_idx on public.staff_profiles (store_id);

-- ---------- Catalogue ----------
create table if not exists public.categories (
  id text primary key,
  name text unique not null,
  slug text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id text primary key,
  name text not null,
  contact text,
  phone text,
  email text,
  city text,
  rating double precision default 4.5,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  sku text unique not null,
  name text not null,
  category_id text not null references public.categories(id),
  price integer not null,
  mrp integer,
  cost integer not null default 0,
  stock integer not null default 0,
  low_stock_at integer not null default 5,
  sizes text not null default 'S,M,L',
  colors text not null default '',
  supplier_id text references public.suppliers(id),
  -- ---------- S J FASHIONS live barcode records (Barcode Search export) ----------
  barcode text unique,
  company_barcode text,
  branch_name text not null default 'HO',
  department text,
  brand_name text,
  item_id text,
  item_group_name text,
  hsn_code text,
  party_name text,
  party_city text,
  agent_name text,
  design_no text,
  lot_no text,
  color text,
  size text,
  season text,
  subcategory2 text,
  subcategory3 text,
  qty numeric not null default 1,
  sales_rate numeric,
  day_book text,
  inward_vch_no text,
  inward_vch_date date,
  purc_bill_no text,
  purchase_vch_no text,
  purchase_vch_date date,
  pur_rate numeric,
  pur_net_rate numeric,
  pur_cost_rate numeric,
  pur_exp_rate numeric,
  markup_pct numeric,
  markdown_pct numeric,
  -- ---------- Product images: multiple per product, declared at creation time ----------
  image_url text,
  image_urls text[] not null default '{}',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products (category_id);
create index if not exists products_supplier_idx on public.products (supplier_id);
create index if not exists products_barcode_idx on public.products (barcode);
create index if not exists products_company_barcode_idx on public.products (company_barcode);
create index if not exists products_brand_idx on public.products (brand_name);
create index if not exists products_design_no_idx on public.products (design_no);
create index if not exists products_department_idx on public.products (department);

-- ---------- Product images (one row per image; supports >1 image per product) ----------
-- Created here at DB-creation time so every product can carry multiple images
-- from day one. `image_urls` on products is a denormalised cache of these rows
-- (kept in sync by trigger below); `image_url` mirrors image_urls[1] for
-- single-image clients.
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

-- Keep products.image_urls / image_url in sync with product_images rows.
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

-- ---------- Product image storage bucket (created at DB-creation time) ----------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- ---------- Customers ----------
create table if not exists public.customers (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  mobile text unique not null,
  normalized_phone text unique,
  email text,
  city text,
  source text default 'Walk-in',
  visits integer not null default 0,
  purchases integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists customers_normalized_phone_idx on public.customers (normalized_phone);

-- ---------- Orders ----------
create table if not exists public.orders (
  id text primary key default gen_random_uuid()::text,
  code text unique not null,
  customer_id text references public.customers(id),
  customer_name text not null,
  customer_phone text not null,
  total integer not null,
  status text not null default 'pending',
  channel text not null default 'walk-in',
  fc_name text,
  staff_id uuid,
  store_id text references public.stores(id),
  created_at timestamptz not null default now()
);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_channel_idx on public.orders (channel);
create index if not exists orders_created_idx on public.orders (created_at);

create table if not exists public.order_items (
  id text primary key default gen_random_uuid()::text,
  order_id text not null references public.orders(id) on delete cascade,
  product_id text not null references public.products(id),
  product_name text not null,
  qty integer not null,
  price integer not null
);
create index if not exists order_items_order_idx on public.order_items (order_id);
create index if not exists order_items_product_idx on public.order_items (product_id);

-- ---------- Stock movements ----------
create table if not exists public.stock_movements (
  id text primary key default gen_random_uuid()::text,
  product_id text not null references public.products(id) on delete cascade,
  product_name text not null,
  type text not null,
  qty integer not null,
  reason text not null default '',
  actor text not null default 'system',
  created_at timestamptz not null default now()
);
create index if not exists stock_movements_product_idx on public.stock_movements (product_id);

-- ---------- Stage 2: floor visits ----------
create table if not exists public.visits (
  id text primary key default gen_random_uuid()::text,
  customer_id text references public.customers(id),
  store_id text not null references public.stores(id),
  assigned_salesperson_id uuid,
  status text not null default 'ARRIVED'
    check (status in ('ARRIVED', 'IDENTIFYING', 'ASSIGNED', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
  arrived_at timestamptz not null default now(),
  identified_at timestamptz,
  assigned_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists visits_store_status_idx on public.visits (store_id, status);
create index if not exists visits_customer_idx on public.visits (customer_id, created_at);
create index if not exists visits_salesperson_idx on public.visits (assigned_salesperson_id, status);

create table if not exists public.visit_events (
  id text primary key default gen_random_uuid()::text,
  visit_id text not null references public.visits(id) on delete cascade,
  event_type text not null,
  actor_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists visit_events_visit_idx on public.visit_events (visit_id, created_at);
