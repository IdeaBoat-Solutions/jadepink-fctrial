
-- JadePink Store OS — 050 Stage 3: drop_reasons table
-- Run AFTER 040 in SQL Editor.
-- Controlled vocabulary for drop reasons.
-- Seeded separately in 090_stage3_seed.sql.

create table if not exists public.drop_reasons (
  id text primary key default gen_random_uuid()::text,
  code text not null unique,
  label text not null,
  description text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists drop_reasons_sort_idx on public.drop_reasons (sort_order);
