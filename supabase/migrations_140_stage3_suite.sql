
-- JadePink Store OS — 140 Stage 3 console: fitting suite on visits
-- Run AFTER 130 in SQL Editor (or via npm run db:migrate).
-- Safe to re-run (all statements are IF NOT EXISTS).
--
-- Mockup "Direct Assignment Target": the FC assigns the visit to a fitting
-- suite (Suite 01–03, Salon VIP). Nullable — an unassigned visit simply has
-- no suite. No RLS change: the existing store-scoped visits policies cover it.

alter table public.visits
  add column if not exists suite text;

create index if not exists visits_suite_idx
  on public.visits (store_id, suite) where suite is not null;
