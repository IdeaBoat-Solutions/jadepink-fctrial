-- JadePink Store OS — 040 Stage 3: product_variants table
-- Run AFTER 030 in SQL Editor.
-- Safe to re-run (all statements are IF NOT EXISTS).

-- Product variants: the sellable/identifiable versions of products.
-- One product can have many variants (size × colour).
-- SKU and barcode are both unique and searchable.

-- Enum guard (Postgres has no CREATE TYPE IF NOT EXISTS).
do $$
begin
  create type public.product_visit_status as enum (
    'SELECTED',
    'TRIAL_IN_PROGRESS',
    'TRIAL_COMPLETED',
    'LIKED',
    'DROPPED',
    'PURCHASED'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.product_variants (
  id text primary key default gen_random_uuid()::text,
  product_id text not null references public.products(id) on delete cascade,
  sku text not null unique,
  barcode text unique,
  size text not null default 'ONE_SIZE',
  colour text not null default 'ONE_COLOUR',
  price integer not null default 0,
  image_key text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_variants_product_idx on public.product_variants (product_id);
create index if not exists product_variants_barcode_idx on public.product_variants (barcode);
create index if not exists product_variants_sku_idx on public.product_variants (sku);
