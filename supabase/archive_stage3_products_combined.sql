
-- ARCHIVED — Stage 3 combined foundation (enum + product_variants + drop_reasons).
-- Superseded by 030_stage3_enums + 040_stage3_product_variants + 050_stage3_drop_reasons,
-- which create exactly the same objects. DO NOT RUN (harmless if run: idempotent).
-- Kept for reference only.

-- ---------- Product visit status enum ----------
-- Postgres has no CREATE TYPE IF NOT EXISTS — guard with a DO block.
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

-- ---------- Product variants ----------
-- One row per sellable variant: product + size + colour.
-- SKU and barcode are both unique and searchable.
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
create index if not exists product_variants_active_idx on public.product_variants (is_active) where is_active;

-- ---------- Drop reasons (controlled vocabulary) ----------
create table if not exists public.drop_reasons (
  id text primary key default gen_random_uuid()::text,
  code text not null unique,
  label text not null,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists drop_reasons_sort_idx on public.drop_reasons (sort_order);
create index if not exists drop_reasons_active_idx on public.drop_reasons (is_active) where is_active;
