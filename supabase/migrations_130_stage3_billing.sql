
-- JadePink Store OS — 130 Stage 3: billing close-out on visit_products
-- Run AFTER 120 in SQL Editor (or via npm run db:migrate).
-- Safe to re-run (all statements are IF NOT EXISTS).
--
-- Roadmap Stage 3 "Billed — scanned": the bill number is attached and the
-- sale closed against the piece. The bill lives on the interaction row
-- (one variant appears at most once per visit), never as a counter on visits.

alter table public.visit_products
  add column if not exists bill_number text,
  add column if not exists purchased_at timestamptz;

-- Bill-number lookup (e.g. "which visit was this bill closed on?").
-- Partial index: only billed rows carry a number.
create index if not exists visit_products_bill_idx
  on public.visit_products (bill_number) where bill_number is not null;
