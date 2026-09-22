-- JadePink Store OS — 150 Stage 2: customer capture fields (roadmap parity)
-- New customer captured: Name, number, area, budget and how they heard about the store.
-- `city` already existed; `area` is the neighbourhood/area within the city.
-- `budget` is a free-text range label (UI offers presets, DB stays flexible).
-- `source` already existed ("how they heard") — backfill default for NULLs.
-- Safe to re-run.

alter table public.customers add column if not exists area text;
alter table public.customers add column if not exists budget text;

update public.customers set source = 'Walk-in' where source is null;

create index if not exists customers_area_idx on public.customers (area);
