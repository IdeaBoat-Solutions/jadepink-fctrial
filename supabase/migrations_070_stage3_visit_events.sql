
-- JadePink Store OS — 070 Stage 3: extend visit_events with entity tracking
-- Run AFTER 060 in SQL Editor.
-- Adds entity_type + entity_id so one event table covers products, visits, customers, etc.

alter table public.visit_events
  add column if not exists entity_type text,
  add column if not exists entity_id text;

-- Index for entity-based queries (e.g. "all events for this visit_product")
create index if not exists visit_events_entity_idx on public.visit_events (entity_type, entity_id);
