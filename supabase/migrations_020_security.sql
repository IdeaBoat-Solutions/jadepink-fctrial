-- JadePink Store OS — 020 security: RLS + role views + auth trigger (safe to re-run).
-- Run AFTER 010_base_schema.sql in Dashboard > SQL Editor.
-- Then: npm run seed:catalog, npm run seed:auth
--
-- IMPORTANT: role checks inside policies MUST go through the SECURITY DEFINER
-- helpers in section 0. Writing `exists (select 1 from staff_profiles ...)`
-- inline makes staff_profiles' own policies reference themselves, and Postgres
-- aborts with `42P17 infinite recursion detected in policy`. That broke every
-- authenticated read (requireAuth, visits, products, visit_events, role views).
-- SECURITY DEFINER functions run as the table owner, so they read the row
-- without re-entering RLS. Keep it that way for every new policy.

-- ---------- 0. RLS-safe helpers ----------
create or replace function public.current_staff_role()
returns text
language sql stable security definer set search_path = public
as $$
  select p.role from public.staff_profiles p
  where p.id = auth.uid() and p.active
  limit 1;
$$;

create or replace function public.current_staff_store()
returns text
language sql stable security definer set search_path = public
as $$
  select p.store_id from public.staff_profiles p
  where p.id = auth.uid() and p.active
  limit 1;
$$;

-- Managers/admins: catalogue + order + staff writes.
create or replace function public.is_manager()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.staff_profiles p
    where p.id = auth.uid() and p.active
      and p.role in ('STORE_MANAGER', 'ADMIN', 'MANAGEMENT')
  );
$$;

-- Cross-store oversight only.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.staff_profiles p
    where p.id = auth.uid() and p.active
      and p.role in ('ADMIN', 'MANAGEMENT')
  );
$$;

-- The single store-scoping primitive every floor table funnels through.
create or replace function public.can_access_store(p_store_id text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.staff_profiles p
    where p.id = auth.uid() and p.active
      and (p.role in ('ADMIN', 'MANAGEMENT') or p.store_id = p_store_id)
  );
$$;

-- Authorization flows through the parent visit -> store, never through a
-- standalone policy on the child row. Reused by visit_events and Stage 3's
-- visit_products.
create or replace function public.can_access_visit(p_visit_id text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.visits v
    where v.id = p_visit_id and public.can_access_store(v.store_id)
  );
$$;

revoke all on function public.current_staff_role(), public.current_staff_store(),
  public.is_manager(), public.is_admin(), public.can_access_store(text), public.can_access_visit(text)
  from public;
grant execute on function public.current_staff_role(), public.current_staff_store(),
  public.is_manager(), public.is_admin(), public.can_access_store(text), public.can_access_visit(text)
  to authenticated, service_role;

-- ---------- 1. RLS ----------
alter table public.stores enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.stock_movements enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.visits enable row level security;
alter table public.visit_events enable row level security;

drop policy if exists "authenticated read catalogue" on public.categories;
drop policy if exists "authenticated read suppliers" on public.suppliers;
drop policy if exists "authenticated read products" on public.products;
drop policy if exists "authenticated read customers" on public.customers;
drop policy if exists "authenticated read orders" on public.orders;
drop policy if exists "authenticated read order items" on public.order_items;
drop policy if exists "authenticated read movements" on public.stock_movements;
drop policy if exists "authenticated read stores" on public.stores;
drop policy if exists "manager write catalogue" on public.products;
drop policy if exists "manager insert catalogue" on public.products;
drop policy if exists "manager delete catalogue" on public.products;
drop policy if exists "authenticated insert orders" on public.orders;
drop policy if exists "manager update orders" on public.orders;
drop policy if exists "staff read own profile" on public.staff_profiles;
drop policy if exists "manager read team profiles" on public.staff_profiles;
drop policy if exists "staff read own store roster" on public.staff_profiles;
drop policy if exists "manager write team profiles" on public.staff_profiles;
drop policy if exists "staff read own store visits" on public.visits;
drop policy if exists "staff insert own store visits" on public.visits;
drop policy if exists "staff update own store visits" on public.visits;
drop policy if exists "staff delete own store visits" on public.visits;
drop policy if exists "staff write own store visits" on public.visits;
drop policy if exists "staff read own store visit events" on public.visit_events;
drop policy if exists "staff write own store visit events" on public.visit_events;
drop policy if exists "staff update own store visit events" on public.visit_events;
drop policy if exists "staff delete own store visit events" on public.visit_events;

-- Catalogue: any signed-in staff can read (floor needs it for trials/billing).
-- Deliberately SELECT-only: a `for all` manager policy here would also govern
-- reads and drag staff_profiles into every product query.
create policy "authenticated read catalogue" on public.categories for select to authenticated using (true);
create policy "authenticated read suppliers" on public.suppliers for select to authenticated using (true);
create policy "authenticated read products" on public.products for select to authenticated using (true);
create policy "authenticated read customers" on public.customers for select to authenticated using (true);
create policy "authenticated read orders" on public.orders for select to authenticated using (true);
create policy "authenticated read order items" on public.order_items for select to authenticated using (true);
create policy "authenticated read movements" on public.stock_movements for select to authenticated using (true);
create policy "authenticated read stores" on public.stores for select to authenticated using (true);

-- Writes: managers/admins only, via the definer helper.
create policy "manager write catalogue" on public.products for update to authenticated
  using (public.is_manager()) with check (public.is_manager());
create policy "manager insert catalogue" on public.products for insert to authenticated
  with check (public.is_manager());
create policy "manager delete catalogue" on public.products for delete to authenticated
  using (public.is_manager());

create policy "authenticated insert orders" on public.orders for insert to authenticated with check (true);
create policy "manager update orders" on public.orders for update to authenticated
  using (public.is_manager());

-- Staff profiles: own row always readable; managers may read the team list.
-- Plus: every active staff member can read their store's roster. The floor
-- needs the whole FC list for assignment (Assign FC / Select FC pickers, round
-- robin) — without this an FC sees only themselves and the Select FC dropdown
-- is empty of colleagues. Scopes through can_access_store() (SECURITY DEFINER
-- helper), never an inline self-reference (§0 recursion rule).
create policy "staff read own profile" on public.staff_profiles for select to authenticated using (id = auth.uid());
create policy "manager read team profiles" on public.staff_profiles for select to authenticated
  using (public.is_manager());
create policy "staff read own store roster" on public.staff_profiles for select to authenticated
  using (public.can_access_store(store_id));
create policy "manager write team profiles" on public.staff_profiles for all to authenticated
  using (public.is_manager()) with check (public.is_manager());

-- Stage-2 floor tables: store-scoped. Staff see their own store's floor data;
-- admins see all. can_access_store() is the one place that decides.
create policy "staff read own store visits" on public.visits for select to authenticated
  using (public.can_access_store(store_id));
create policy "staff insert own store visits" on public.visits for insert to authenticated
  with check (public.can_access_store(store_id));
create policy "staff update own store visits" on public.visits for update to authenticated
  using (public.can_access_store(store_id)) with check (public.can_access_store(store_id));
create policy "staff delete own store visits" on public.visits for delete to authenticated
  using (public.can_access_store(store_id));

-- Child rows authorize through the parent visit, never on their own.
create policy "staff read own store visit events" on public.visit_events for select to authenticated
  using (public.can_access_visit(visit_id));
create policy "staff write own store visit events" on public.visit_events for insert to authenticated
  with check (public.can_access_visit(visit_id));

-- ---------- 2. Auth trigger: auth.users -> public.staff_profiles ----------
-- Note: store_id is intentionally left NULL here - Supabase cannot know a
-- signup's store. seed-auth.mjs / POST /api/staff/register set it afterwards.
-- The role is whitelisted so a bad user_metadata.role can't violate the CHECK
-- constraint and abort user creation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text;
begin
  v_role := upper(coalesce(new.raw_user_meta_data ->> 'role', 'FC'));
  if v_role not in ('FC', 'STORE_MANAGER', 'ADMIN', 'MANAGEMENT') then
    v_role := 'FC';
  end if;

  insert into public.staff_profiles (id, email, name, role, active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    v_role,
    true
  )
  on conflict (id) do update set
    email = excluded.email,
    name = coalesce(excluded.name, public.staff_profiles.name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- 3. Role VIEWS ----------
-- Supabase creates views with `security_invoker = true` by default, which makes
-- them evaluate staff_profiles' RLS per row - an FC would then only ever see
-- their own row, and the floor cannot list salespeople for assignment. These are
-- curated read-only projections, so they are created as invoker-privileged
-- (owner-privileged) on purpose.
-- NOTE: CREATE OR REPLACE VIEW does NOT update reloptions, so these must be
-- dropped and recreated for the setting to actually apply.
drop view if exists public.v_store_managers;
create view public.v_store_managers with (security_invoker = false) as
select id, email, name, phone, role, store_id, active, created_at
from public.staff_profiles
where role = 'STORE_MANAGER' and active = true;

drop view if exists public.v_salespeople;
create view public.v_salespeople with (security_invoker = false) as
select id, email, name, phone, role, store_id, active, created_at
from public.staff_profiles
where role = 'FC' and active = true;

drop view if exists public.v_floor_team;
create view public.v_floor_team with (security_invoker = false) as
select
  sp.id, sp.email, sp.name, sp.phone, sp.role, sp.active,
  case sp.role when 'STORE_MANAGER' then 'Store Manager' when 'FC' then 'Salesperson / FC' else 'Admin' end as role_label
from public.staff_profiles sp
where sp.active = true;

grant select on public.v_store_managers to authenticated;
grant select on public.v_salespeople to authenticated;
grant select on public.v_floor_team to authenticated;
