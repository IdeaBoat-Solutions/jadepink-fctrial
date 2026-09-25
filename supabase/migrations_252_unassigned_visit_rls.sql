-- 252: allow same-store FCs to manage unassigned visits.
-- The floor UI lets any FC claim, identify, start, or end an unclaimed visit.
-- Migration 250 only allowed managers or the already-assigned salesperson, so
-- an unassigned visit failed UPDATE under RLS with a misleading 422 response.

drop policy if exists "staff update assigned visits" on public.visits;

create policy "staff update store visits" on public.visits
  for update to authenticated
  using (
    public.is_manager()
    or (
      public.can_access_store(store_id)
      and (assigned_salesperson_id is null or assigned_salesperson_id = auth.uid())
    )
  )
  with check (
    public.is_manager()
    or (
      public.can_access_store(store_id)
      and (assigned_salesperson_id is null or assigned_salesperson_id = auth.uid())
    )
  );
