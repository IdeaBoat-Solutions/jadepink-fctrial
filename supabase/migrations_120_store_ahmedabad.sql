-- JadePink Store OS — 120: the store is Ahmedabad (was Bandra/Mumbai seed).
-- Repoints every FK to store-thaltej and removes the old row.
-- Safe to re-run (upsert + guarded updates + guarded delete). Run via:
--   node --env-file=.env scripts/run-sql.mjs supabase/migrations_120_store_ahmedabad.sql

begin;

-- 1. Target row first (children FK to it).
insert into public.stores (id, name, code, city, address, location, active)
values (
  'store-thaltej',
  'JadePink Ahmedabad',
  'JP-AHM-01',
  'Ahmedabad',
  'G-8 Harmony Icon, near Baghban Party Plot, Hebatpur Road, Thaltej, Ahmedabad 380054',
  'Thaltej, Ahmedabad',
  true
)
on conflict (id) do update set
  name = excluded.name,
  code = excluded.code,
  city = excluded.city,
  address = excluded.address,
  location = excluded.location;

-- 2. Repoint every child row.
update public.staff_profiles
set store_id = 'store-thaltej'
where store_id = 'store-bandra';

update public.visits
set store_id = 'store-thaltej'
where store_id = 'store-bandra';

update public.orders
set store_id = 'store-thaltej'
where store_id = 'store-bandra';

-- 3. Drop the old row (unreferenced by now; delete skips if anything remains).
delete from public.stores
where id = 'store-bandra'
  and not exists (select 1 from public.staff_profiles p where p.store_id = 'store-bandra')
  and not exists (select 1 from public.visits v where v.store_id = 'store-bandra')
  and not exists (select 1 from public.orders o where o.store_id = 'store-bandra');

commit;
