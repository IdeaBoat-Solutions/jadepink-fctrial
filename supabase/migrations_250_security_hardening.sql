-- JadePink Store OS — 250 security hardening.
-- Run after migrations_240_price_snapshot.sql (safe to re-run).
-- Tightens direct Supabase access so API authorization is not the only boundary.

-- ---------- helpers ----------
create or replace function public.can_access_order(p_order_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = p_order_id
      and public.can_access_store(o.store_id)
  );
$$;

create or replace function public.can_access_whatsapp_log(
  p_customer_id text,
  p_visit_id text,
  p_created_by uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_manager()
    or (
      p_created_by = auth.uid()
      and (
        p_visit_id is null
        or exists (
          select 1
          from public.visits v
          where v.id = p_visit_id
            and v.customer_id = p_customer_id
            and public.can_access_visit(v.id)
        )
      )
    );
$$;

revoke all on function public.can_access_order(text),
  public.can_access_whatsapp_log(text, text, uuid)
  from public;
grant execute on function public.can_access_order(text),
  public.can_access_whatsapp_log(text, text, uuid)
  to authenticated, service_role;

-- ---------- customers ----------
drop policy if exists "authenticated update customers" on public.customers;
drop policy if exists "authenticated delete customers" on public.customers;
create policy "manager update customers" on public.customers
  for update to authenticated
  using (public.is_manager()) with check (public.is_manager());
create policy "manager delete customers" on public.customers
  for delete to authenticated
  using (public.is_manager());

-- ---------- visits ----------
drop policy if exists "staff update own store visits" on public.visits;
drop policy if exists "staff delete own store visits" on public.visits;
create policy "staff update assigned visits" on public.visits
  for update to authenticated
  using (public.is_manager() or assigned_salesperson_id = auth.uid())
  with check (public.is_manager() or assigned_salesperson_id = auth.uid());
create policy "manager delete visits" on public.visits
  for delete to authenticated
  using (public.is_manager());

-- ---------- orders ----------
drop policy if exists "authenticated read orders" on public.orders;
drop policy if exists "authenticated read order items" on public.order_items;
drop policy if exists "authenticated insert orders" on public.orders;
drop policy if exists "manager update orders" on public.orders;
create policy "store scoped read orders" on public.orders
  for select to authenticated
  using (public.can_access_store(store_id));
create policy "store scoped read order items" on public.order_items
  for select to authenticated
  using (public.can_access_order(order_id));
create policy "manager insert orders" on public.orders
  for insert to authenticated
  with check (public.is_manager() and public.can_access_store(store_id));
create policy "manager update orders" on public.orders
  for update to authenticated
  using (public.is_manager() and public.can_access_store(store_id))
  with check (public.is_manager() and public.can_access_store(store_id));
create policy "manager insert order items" on public.order_items
  for insert to authenticated
  with check (public.is_manager() and public.can_access_order(order_id));

-- ---------- WhatsApp logs ----------
drop policy if exists "authenticated read whatsapp logs" on public.whatsapp_logs;
drop policy if exists "authenticated write whatsapp logs" on public.whatsapp_logs;
drop policy if exists "authenticated update whatsapp logs" on public.whatsapp_logs;
drop policy if exists "authenticated delete whatsapp logs" on public.whatsapp_logs;
create policy "scoped read whatsapp logs" on public.whatsapp_logs
  for select to authenticated
  using (public.can_access_whatsapp_log(customer_id, visit_id, created_by));
create policy "scoped insert whatsapp logs" on public.whatsapp_logs
  for insert to authenticated
  with check (public.can_access_whatsapp_log(customer_id, visit_id, created_by));
create policy "scoped update whatsapp logs" on public.whatsapp_logs
  for update to authenticated
  using (public.is_manager() or created_by = auth.uid())
  with check (public.can_access_whatsapp_log(customer_id, visit_id, created_by));
create policy "manager delete whatsapp logs" on public.whatsapp_logs
  for delete to authenticated
  using (public.is_manager());

-- ---------- staff views ----------
-- Use invoker RLS now that staff_profiles policies are store-scoped. The old
-- security_invoker=false views exposed every store's roster to every signed-in
-- user. Recreate rather than ALTER because CREATE OR REPLACE does not update
-- the view reloptions on all supported PostgreSQL versions.
drop view if exists public.v_store_managers;
create view public.v_store_managers with (security_invoker = true) as
select id, email, name, phone, role, store_id, active, created_at
from public.staff_profiles
where role = 'STORE_MANAGER' and active = true;

drop view if exists public.v_salespeople;
create view public.v_salespeople with (security_invoker = true) as
select id, email, name, phone, role, store_id, active, created_at
from public.staff_profiles
where role = 'FC' and active = true;

drop view if exists public.v_floor_team;
create view public.v_floor_team with (security_invoker = true) as
select
  sp.id, sp.email, sp.name, sp.phone, sp.role, sp.active, sp.store_id,
  case sp.role when 'STORE_MANAGER' then 'Store Manager' when 'FC' then 'Salesperson / FC' else 'Admin' end as role_label
from public.staff_profiles sp
where sp.active = true;

grant select on public.v_store_managers to authenticated;
grant select on public.v_salespeople to authenticated;
grant select on public.v_floor_team to authenticated;
