-- Stage 2 atomicity (§23): the compound business writes that were three
-- separate client round-trips become single transactional functions. A
-- function body runs in one implicit transaction, so either every row lands
-- or none does — no visit without its event, no counter drift.
--
-- SECURITY INVOKER (the default) is deliberate: the function runs with the
-- caller's rights, so existing RLS on visits / visit_events / customers still
-- governs every write exactly as it did from the client. Do NOT switch these
-- to SECURITY DEFINER — that would bypass RLS.

-- create_walk_in: visit (recorded straight into IDENTIFYING — the transient
-- ARRIVED row was never observed outside the request) + WALK_IN_RECORDED.
create or replace function public.create_walk_in(
  p_store_id text,
  p_actor uuid
)
returns public.visits
language plpgsql
security invoker
set search_path = public
as $$
declare
  v public.visits;
begin
  insert into public.visits (store_id, status)
    values (p_store_id, 'IDENTIFYING')
    returning * into v;

  insert into public.visit_events (visit_id, event_type, actor_id, metadata)
    values (v.id, 'WALK_IN_RECORDED', p_actor, jsonb_build_object('store_id', p_store_id));

  return v;
end;
$$;

-- attach_customer_to_visit: link customer + CUSTOMER_ATTACHED event + (first
-- attach only) bump the customer's visit counter — all atomic. FOR UPDATE
-- locks the visit row so two concurrent attaches can't both count as "first".
create or replace function public.attach_customer_to_visit(
  p_visit_id text,
  p_customer_id text,
  p_actor uuid
)
returns public.visits
language plpgsql
security invoker
set search_path = public
as $$
declare
  v public.visits;
  was_unattached boolean;
begin
  select * into v from public.visits where id = p_visit_id for update;
  if not found then
    raise exception 'VISIT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v.status in ('COMPLETED', 'CANCELLED') then
    raise exception 'VISIT_ALREADY_COMPLETED' using errcode = 'P0001';
  end if;

  was_unattached := v.customer_id is null;

  update public.visits
    set customer_id = p_customer_id,
        identified_at = coalesce(identified_at, now()),
        status = case when status = 'ARRIVED' then 'IDENTIFYING' else status end
    where id = p_visit_id
    returning * into v;

  insert into public.visit_events (visit_id, event_type, actor_id, metadata)
    values (
      p_visit_id, 'CUSTOMER_ATTACHED', p_actor,
      jsonb_build_object('customer_id', p_customer_id)
    );

  if was_unattached then
    update public.customers
      set visits = coalesce(visits, 0) + 1
      where id = p_customer_id;
  end if;

  return v;
end;
$$;
