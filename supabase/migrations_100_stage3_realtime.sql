-- JadePink Store OS — 100 Stage 3: Realtime for the floor trial (§32–33)
-- Run AFTER 080 in the SQL Editor. Safe to re-run.
--
-- Enables Supabase Realtime on the two tables the trial board watches.
-- Scope is enforced by RLS: a client only receives rows it may already read,
-- so a salesperson sees their visit and a manager sees their store — never
-- every store's product traffic.

-- Stream both tables through the default Supabase Realtime publication.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'visit_products'
    ) then
      execute 'alter publication supabase_realtime add table public.visit_products';
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'visit_events'
    ) then
      execute 'alter publication supabase_realtime add table public.visit_events';
    end if;
  end if;
end $$;

-- Full row image so filtered UPDATE/DELETE events carry visit_id
-- (default replica identity only includes the primary key in the old record).
alter table public.visit_products replica identity full;
