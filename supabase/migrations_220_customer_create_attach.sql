-- JadePink Store OS — 220: atomic create-customer-and-attach-to-visit.
--
-- The three-step client round trip (create customer → attach → bump count)
-- collapses into one transactional RPC. No orphaned customer record when the
-- attach fails; no counter drift; no partial state visible to the UI.
--
-- SECURITY INVOKER (the default) is deliberate: existing RLS on customers /
-- visits / visit_events still governs every write exactly as it did from the
-- client. Do NOT switch to SECURITY DEFINER — that would bypass RLS.
--
-- p_phone must already be normalized to 10 digits by the caller (the service
-- layer does this). A duplicate-phone unique violation surfaces as SQLSTATE
-- 23505; the TypeScript service catches it and maps to CUSTOMER_ALREADY_EXISTS.

create or replace function public.create_customer_and_attach(
  p_visit_id text,
  p_name text,
  p_phone text,
  p_source text default 'Walk-in',
  p_area text default null,
  p_budget text default null,
  p_actor uuid default null
)
returns public.customers
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_customer public.customers;
  v_visit public.visits;
  was_unattached boolean;
begin
  -- Lock the visit row first — two concurrent attaches can't both count as
  -- "first" (same guarantee as attach_customer_to_visit).
  select * into v_visit from public.visits where id = p_visit_id for update;
  if not found then
    raise exception 'VISIT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_visit.status in ('COMPLETED', 'CANCELLED') then
    raise exception 'VISIT_ALREADY_COMPLETED' using errcode = 'P0001';
  end if;

  was_unattached := v_visit.customer_id is null;

  -- Insert the customer. unique(normalized_phone) is the final race guard —
  -- SQLSTATE 23505 bubbles up to the caller for friendly error mapping.
  insert into public.customers (name, mobile, normalized_phone, source, area, budget)
    values (p_name, p_phone, p_phone, p_source, p_area, p_budget)
    returning * into v_customer;

  -- Attach: link customer, stamp identified_at, promote ARRIVED → IDENTIFYING.
  update public.visits
    set customer_id = v_customer.id,
        identified_at = coalesce(identified_at, now()),
        status = case when status = 'ARRIVED' then 'IDENTIFYING' else status end
    where id = p_visit_id;

  -- Record the event (same shape as attach_customer_to_visit).
  insert into public.visit_events (visit_id, event_type, actor_id, metadata)
    values (
      p_visit_id, 'CUSTOMER_ATTACHED', p_actor,
      jsonb_build_object('customer_id', v_customer.id, 'customer_name', v_customer.name)
    );

  -- First-attach counter bump (bookkeeping, §42).
  if was_unattached then
    update public.customers
      set visits = coalesce(visits, 0) + 1
      where id = v_customer.id;
  end if;

  return v_customer;
end;
$$;
