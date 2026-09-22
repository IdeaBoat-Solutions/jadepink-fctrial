-- RLS snapshot before patch — generated 2026-09-21T12:58:21.213Z
-- Restore guidance: re-create policies/functions/views from this file.

-- ---------- policies (30) ----------
-- categories :: authenticated read catalogue :: SELECT to authenticated
--   USING: true
--   CHECK: (none)
-- customers :: authenticated read customers :: SELECT to authenticated
--   USING: true
--   CHECK: (none)
-- drop_reasons :: authenticated read drop reasons :: SELECT to authenticated
--   USING: true
--   CHECK: (none)
-- drop_reasons :: manager write drop reasons :: ALL to authenticated
--   USING: (EXISTS ( SELECT 1
   FROM staff_profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['STORE_MANAGER'::text, 'ADMIN'::text, 'MANAGEMENT'::text])) AND p.active)))
--   CHECK: (EXISTS ( SELECT 1
   FROM staff_profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['STORE_MANAGER'::text, 'ADMIN'::text, 'MANAGEMENT'::text])) AND p.active)))
-- order_items :: authenticated read order items :: SELECT to authenticated
--   USING: true
--   CHECK: (none)
-- orders :: authenticated insert orders :: INSERT to authenticated
--   USING: (none)
--   CHECK: true
-- orders :: authenticated read orders :: SELECT to authenticated
--   USING: true
--   CHECK: (none)
-- orders :: manager update orders :: UPDATE to authenticated
--   USING: is_manager()
--   CHECK: (none)
-- product_images :: authenticated read product images :: SELECT to authenticated
--   USING: true
--   CHECK: (none)
-- product_images :: manager write product images :: ALL to authenticated
--   USING: (EXISTS ( SELECT 1
   FROM staff_profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['STORE_MANAGER'::text, 'ADMIN'::text, 'MANAGEMENT'::text])) AND p.active)))
--   CHECK: (EXISTS ( SELECT 1
   FROM staff_profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['STORE_MANAGER'::text, 'ADMIN'::text, 'MANAGEMENT'::text])) AND p.active)))
-- product_variants :: authenticated read product variants :: SELECT to authenticated
--   USING: true
--   CHECK: (none)
-- product_variants :: manager write product variants :: ALL to authenticated
--   USING: (EXISTS ( SELECT 1
   FROM staff_profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['STORE_MANAGER'::text, 'ADMIN'::text, 'MANAGEMENT'::text])) AND p.active)))
--   CHECK: (EXISTS ( SELECT 1
   FROM staff_profiles p
  WHERE ((p.id = auth.uid()) AND (p.role = ANY (ARRAY['STORE_MANAGER'::text, 'ADMIN'::text, 'MANAGEMENT'::text])) AND p.active)))
-- products :: authenticated read products :: SELECT to authenticated
--   USING: true
--   CHECK: (none)
-- products :: manager delete catalogue :: DELETE to authenticated
--   USING: is_manager()
--   CHECK: (none)
-- products :: manager insert catalogue :: INSERT to authenticated
--   USING: (none)
--   CHECK: is_manager()
-- products :: manager write catalogue :: UPDATE to authenticated
--   USING: is_manager()
--   CHECK: is_manager()
-- staff_profiles :: manager read team profiles :: SELECT to authenticated
--   USING: is_manager()
--   CHECK: (none)
-- staff_profiles :: manager write team profiles :: ALL to authenticated
--   USING: is_manager()
--   CHECK: is_manager()
-- staff_profiles :: staff read own profile :: SELECT to authenticated
--   USING: (id = auth.uid())
--   CHECK: (none)
-- stock_movements :: authenticated read movements :: SELECT to authenticated
--   USING: true
--   CHECK: (none)
-- stores :: authenticated read stores :: SELECT to authenticated
--   USING: true
--   CHECK: (none)
-- suppliers :: authenticated read suppliers :: SELECT to authenticated
--   USING: true
--   CHECK: (none)
-- visit_events :: staff read own store visit events :: SELECT to authenticated
--   USING: can_access_visit(visit_id)
--   CHECK: (none)
-- visit_events :: staff write own store visit events :: INSERT to authenticated
--   USING: (none)
--   CHECK: can_access_visit(visit_id)
-- visit_products :: staff read own store visit products :: SELECT to authenticated
--   USING: (EXISTS ( SELECT 1
   FROM (visits v
     JOIN staff_profiles p ON ((p.id = auth.uid())))
  WHERE ((v.id = visit_products.visit_id) AND p.active AND ((p.role = ANY (ARRAY['ADMIN'::text, 'MANAGEMENT'::text])) OR (p.store_id = v.store_id)))))
--   CHECK: (none)
-- visit_products :: staff write own store visit products :: ALL to authenticated
--   USING: (EXISTS ( SELECT 1
   FROM staff_profiles p
  WHERE ((p.id = auth.uid()) AND p.active AND ((p.role = ANY (ARRAY['ADMIN'::text, 'MANAGEMENT'::text])) OR (p.store_id IN ( SELECT v.store_id
           FROM visits v
          WHERE (v.id = visit_products.visit_id)))))))
--   CHECK: (EXISTS ( SELECT 1
   FROM staff_profiles p
  WHERE ((p.id = auth.uid()) AND p.active AND ((p.role = ANY (ARRAY['ADMIN'::text, 'MANAGEMENT'::text])) OR (p.store_id IN ( SELECT v.store_id
           FROM visits v
          WHERE (v.id = visit_products.visit_id)))))))
-- visits :: staff delete own store visits :: DELETE to authenticated
--   USING: can_access_store(store_id)
--   CHECK: (none)
-- visits :: staff insert own store visits :: INSERT to authenticated
--   USING: (none)
--   CHECK: can_access_store(store_id)
-- visits :: staff read own store visits :: SELECT to authenticated
--   USING: can_access_store(store_id)
--   CHECK: (none)
-- visits :: staff update own store visits :: UPDATE to authenticated
--   USING: can_access_store(store_id)
--   CHECK: can_access_store(store_id)

-- ---------- functions (9) ----------
CREATE OR REPLACE FUNCTION public.can_access_store(p_store_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.staff_profiles p
    where p.id = auth.uid() and p.active
      and (p.role in ('ADMIN', 'MANAGEMENT') or p.store_id = p_store_id)
  );
$function$
;
CREATE OR REPLACE FUNCTION public.can_access_visit(p_visit_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.visits v
    where v.id = p_visit_id and public.can_access_store(v.store_id)
  );
$function$
;
CREATE OR REPLACE FUNCTION public.current_staff_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.role from public.staff_profiles p
  where p.id = auth.uid() and p.active
  limit 1;
$function$
;
CREATE OR REPLACE FUNCTION public.current_staff_store()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select p.store_id from public.staff_profiles p
  where p.id = auth.uid() and p.active
  limit 1;
$function$
;
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;
CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.staff_profiles p
    where p.id = auth.uid() and p.active
      and p.role in ('ADMIN', 'MANAGEMENT')
  );
$function$
;
CREATE OR REPLACE FUNCTION public.is_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.staff_profiles p
    where p.id = auth.uid() and p.active
      and p.role in ('STORE_MANAGER', 'ADMIN', 'MANAGEMENT')
  );
$function$
;
CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.sync_product_image_urls()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  update public.products p
  set
    image_urls = coalesce((
      select array_agg(pi.url order by pi.position, pi.created_at)
      from public.product_images pi
      where pi.product_id = coalesce(new.product_id, old.product_id)
    ), '{}'),
    updated_at = now()
  where p.id = coalesce(new.product_id, old.product_id);
  update public.products
  set image_url = image_urls[1]
  where id = coalesce(new.product_id, old.product_id);
  return coalesce(new, old);
end;
$function$
;

-- ---------- views (3) ----------
-- v_floor_team reloptions=["security_invoker=false"]
 SELECT sp.id,
    sp.email,
    sp.name,
    sp.phone,
    sp.role,
    sp.active,
    s.name AS store_name,
        CASE sp.role
            WHEN 'STORE_MANAGER'::text THEN 'Store Manager'::text
            WHEN 'FC'::text THEN 'Salesperson / FC'::text
            ELSE 'Admin'::text
        END AS role_label
   FROM staff_profiles sp
     LEFT JOIN stores s ON s.id = sp.store_id
  WHERE sp.active = true;
-- v_salespeople reloptions=["security_invoker=false"]
 SELECT id,
    email,
    name,
    phone,
    role,
    store_id,
    active,
    created_at
   FROM staff_profiles
  WHERE role = 'FC'::text AND active = true;
-- v_store_managers reloptions=["security_invoker=false"]
 SELECT id,
    email,
    name,
    phone,
    role,
    store_id,
    active,
    created_at
   FROM staff_profiles
  WHERE role = 'STORE_MANAGER'::text AND active = true;

-- ---------- table grants ----------
-- categories: DELETE to postgres | DELETE to anon | DELETE to service_role | DELETE to authenticated | INSERT to service_role | INSERT to anon | INSERT to postgres | INSERT to authenticated | MAINTAIN to service_role | MAINTAIN to authenticated | MAINTAIN to anon | MAINTAIN to postgres | REFERENCES to authenticated | REFERENCES to anon | REFERENCES to service_role | REFERENCES to postgres | SELECT to anon | SELECT to postgres | SELECT to authenticated | SELECT to service_role | TRIGGER to anon | TRIGGER to authenticated | TRIGGER to postgres | TRIGGER to service_role | TRUNCATE to service_role | TRUNCATE to postgres | TRUNCATE to anon | TRUNCATE to authenticated | UPDATE to postgres | UPDATE to authenticated | UPDATE to service_role | UPDATE to anon
-- customers: DELETE to service_role | DELETE to authenticated | DELETE to postgres | DELETE to anon | INSERT to anon | INSERT to postgres | INSERT to authenticated | INSERT to service_role | MAINTAIN to postgres | MAINTAIN to anon | MAINTAIN to service_role | MAINTAIN to authenticated | REFERENCES to authenticated | REFERENCES to anon | REFERENCES to service_role | REFERENCES to postgres | SELECT to anon | SELECT to service_role | SELECT to postgres | SELECT to authenticated | TRIGGER to service_role | TRIGGER to anon | TRIGGER to authenticated | TRIGGER to postgres | TRUNCATE to authenticated | TRUNCATE to service_role | TRUNCATE to anon | TRUNCATE to postgres | UPDATE to service_role | UPDATE to postgres | UPDATE to anon | UPDATE to authenticated
-- drop_reasons: DELETE to postgres | DELETE to service_role | DELETE to authenticated | DELETE to anon | INSERT to service_role | INSERT to postgres | INSERT to authenticated | INSERT to anon | MAINTAIN to authenticated | MAINTAIN to postgres | MAINTAIN to anon | MAINTAIN to service_role | REFERENCES to authenticated | REFERENCES to postgres | REFERENCES to service_role | REFERENCES to anon | SELECT to anon | SELECT to authenticated | SELECT to postgres | SELECT to service_role | TRIGGER to postgres | TRIGGER to service_role | TRIGGER to anon | TRIGGER to authenticated | TRUNCATE to postgres | TRUNCATE to anon | TRUNCATE to authenticated | TRUNCATE to service_role | UPDATE to postgres | UPDATE to anon | UPDATE to service_role | UPDATE to authenticated
-- order_items: DELETE to service_role | DELETE to postgres | DELETE to anon | DELETE to authenticated | INSERT to postgres | INSERT to service_role | INSERT to authenticated | INSERT to anon | MAINTAIN to service_role | MAINTAIN to anon | MAINTAIN to authenticated | MAINTAIN to postgres | REFERENCES to authenticated | REFERENCES to service_role | REFERENCES to postgres | REFERENCES to anon | SELECT to anon | SELECT to postgres | SELECT to authenticated | SELECT to service_role | TRIGGER to service_role | TRIGGER to postgres | TRIGGER to anon | TRIGGER to authenticated | TRUNCATE to service_role | TRUNCATE to anon | TRUNCATE to postgres | TRUNCATE to authenticated | UPDATE to authenticated | UPDATE to service_role | UPDATE to postgres | UPDATE to anon
-- orders: DELETE to authenticated | DELETE to service_role | DELETE to anon | DELETE to postgres | INSERT to postgres | INSERT to service_role | INSERT to authenticated | INSERT to anon | MAINTAIN to service_role | MAINTAIN to postgres | MAINTAIN to authenticated | MAINTAIN to anon | REFERENCES to postgres | REFERENCES to service_role | REFERENCES to authenticated | REFERENCES to anon | SELECT to service_role | SELECT to postgres | SELECT to authenticated | SELECT to anon | TRIGGER to postgres | TRIGGER to service_role | TRIGGER to authenticated | TRIGGER to anon | TRUNCATE to postgres | TRUNCATE to anon | TRUNCATE to authenticated | TRUNCATE to service_role | UPDATE to anon | UPDATE to authenticated | UPDATE to service_role | UPDATE to postgres
-- product_images: DELETE to postgres | DELETE to anon | DELETE to service_role | DELETE to authenticated | INSERT to authenticated | INSERT to postgres | INSERT to anon | INSERT to service_role | MAINTAIN to authenticated | MAINTAIN to service_role | MAINTAIN to anon | MAINTAIN to postgres | REFERENCES to anon | REFERENCES to service_role | REFERENCES to authenticated | REFERENCES to postgres | SELECT to authenticated | SELECT to service_role | SELECT to postgres | SELECT to anon | TRIGGER to service_role | TRIGGER to postgres | TRIGGER to anon | TRIGGER to authenticated | TRUNCATE to anon | TRUNCATE to service_role | TRUNCATE to postgres | TRUNCATE to authenticated | UPDATE to postgres | UPDATE to service_role | UPDATE to authenticated | UPDATE to anon
-- product_variants: DELETE to service_role | DELETE to authenticated | DELETE to anon | DELETE to postgres | INSERT to authenticated | INSERT to anon | INSERT to postgres | INSERT to service_role | MAINTAIN to postgres | MAINTAIN to authenticated | MAINTAIN to anon | MAINTAIN to service_role | REFERENCES to authenticated | REFERENCES to service_role | REFERENCES to postgres | REFERENCES to anon | SELECT to authenticated | SELECT to service_role | SELECT to postgres | SELECT to anon | TRIGGER to authenticated | TRIGGER to postgres | TRIGGER to anon | TRIGGER to service_role | TRUNCATE to service_role | TRUNCATE to authenticated | TRUNCATE to anon | TRUNCATE to postgres | UPDATE to service_role | UPDATE to postgres | UPDATE to anon | UPDATE to authenticated
-- products: DELETE to anon | DELETE to service_role | DELETE to postgres | DELETE to authenticated | INSERT to authenticated | INSERT to postgres | INSERT to service_role | INSERT to anon | MAINTAIN to service_role | MAINTAIN to authenticated | MAINTAIN to postgres | MAINTAIN to anon | REFERENCES to anon | REFERENCES to service_role | REFERENCES to authenticated | REFERENCES to postgres | SELECT to authenticated | SELECT to postgres | SELECT to service_role | SELECT to anon | TRIGGER to service_role | TRIGGER to anon | TRIGGER to postgres | TRIGGER to authenticated | TRUNCATE to authenticated | TRUNCATE to service_role | TRUNCATE to anon | TRUNCATE to postgres | UPDATE to authenticated | UPDATE to anon | UPDATE to service_role | UPDATE to postgres
-- staff_profiles: DELETE to authenticated | DELETE to anon | DELETE to service_role | DELETE to postgres | INSERT to anon | INSERT to service_role | INSERT to authenticated | INSERT to postgres | MAINTAIN to postgres | MAINTAIN to service_role | MAINTAIN to authenticated | MAINTAIN to anon | REFERENCES to service_role | REFERENCES to anon | REFERENCES to authenticated | REFERENCES to postgres | SELECT to authenticated | SELECT to anon | SELECT to service_role | SELECT to postgres | TRIGGER to postgres | TRIGGER to service_role | TRIGGER to anon | TRIGGER to authenticated | TRUNCATE to service_role | TRUNCATE to anon | TRUNCATE to authenticated | TRUNCATE to postgres | UPDATE to authenticated | UPDATE to anon | UPDATE to service_role | UPDATE to postgres
-- stock_movements: DELETE to authenticated | DELETE to service_role | DELETE to anon | DELETE to postgres | INSERT to postgres | INSERT to anon | INSERT to authenticated | INSERT to service_role | MAINTAIN to postgres | MAINTAIN to service_role | MAINTAIN to authenticated | MAINTAIN to anon | REFERENCES to service_role | REFERENCES to anon | REFERENCES to postgres | REFERENCES to authenticated | SELECT to anon | SELECT to service_role | SELECT to authenticated | SELECT to postgres | TRIGGER to service_role | TRIGGER to anon | TRIGGER to authenticated | TRIGGER to postgres | TRUNCATE to anon | TRUNCATE to service_role | TRUNCATE to postgres | TRUNCATE to authenticated | UPDATE to postgres | UPDATE to service_role | UPDATE to authenticated | UPDATE to anon
-- stores: DELETE to postgres | DELETE to authenticated | DELETE to service_role | DELETE to anon | INSERT to authenticated | INSERT to postgres | INSERT to service_role | INSERT to anon | MAINTAIN to postgres | MAINTAIN to authenticated | MAINTAIN to service_role | MAINTAIN to anon | REFERENCES to authenticated | REFERENCES to anon | REFERENCES to service_role | REFERENCES to postgres | SELECT to anon | SELECT to authenticated | SELECT to postgres | SELECT to service_role | TRIGGER to postgres | TRIGGER to authenticated | TRIGGER to service_role | TRIGGER to anon | TRUNCATE to postgres | TRUNCATE to anon | TRUNCATE to authenticated | TRUNCATE to service_role | UPDATE to postgres | UPDATE to authenticated | UPDATE to anon | UPDATE to service_role
-- suppliers: DELETE to service_role | DELETE to authenticated | DELETE to anon | DELETE to postgres | INSERT to authenticated | INSERT to anon | INSERT to postgres | INSERT to service_role | MAINTAIN to postgres | MAINTAIN to anon | MAINTAIN to service_role | MAINTAIN to authenticated | REFERENCES to authenticated | REFERENCES to anon | REFERENCES to postgres | REFERENCES to service_role | SELECT to postgres | SELECT to anon | SELECT to service_role | SELECT to authenticated | TRIGGER to anon | TRIGGER to service_role | TRIGGER to authenticated | TRIGGER to postgres | TRUNCATE to postgres | TRUNCATE to anon | TRUNCATE to service_role | TRUNCATE to authenticated | UPDATE to authenticated | UPDATE to service_role | UPDATE to anon | UPDATE to postgres
-- v_floor_team: DELETE to anon | DELETE to authenticated | DELETE to service_role | DELETE to postgres | INSERT to authenticated | INSERT to postgres | INSERT to anon | INSERT to service_role | MAINTAIN to authenticated | MAINTAIN to postgres | MAINTAIN to anon | MAINTAIN to service_role | REFERENCES to authenticated | REFERENCES to service_role | REFERENCES to postgres | REFERENCES to anon | SELECT to authenticated | SELECT to service_role | SELECT to anon | SELECT to postgres | TRIGGER to postgres | TRIGGER to service_role | TRIGGER to anon | TRIGGER to authenticated | TRUNCATE to authenticated | TRUNCATE to anon | TRUNCATE to postgres | TRUNCATE to service_role | UPDATE to service_role | UPDATE to authenticated | UPDATE to anon | UPDATE to postgres
-- v_salespeople: DELETE to authenticated | DELETE to service_role | DELETE to postgres | DELETE to anon | INSERT to anon | INSERT to authenticated | INSERT to postgres | INSERT to service_role | MAINTAIN to service_role | MAINTAIN to authenticated | MAINTAIN to anon | MAINTAIN to postgres | REFERENCES to authenticated | REFERENCES to anon | REFERENCES to service_role | REFERENCES to postgres | SELECT to postgres | SELECT to authenticated | SELECT to anon | SELECT to service_role | TRIGGER to postgres | TRIGGER to authenticated | TRIGGER to service_role | TRIGGER to anon | TRUNCATE to service_role | TRUNCATE to postgres | TRUNCATE to anon | TRUNCATE to authenticated | UPDATE to postgres | UPDATE to authenticated | UPDATE to service_role | UPDATE to anon
-- v_store_managers: DELETE to service_role | DELETE to authenticated | DELETE to anon | DELETE to postgres | INSERT to authenticated | INSERT to service_role | INSERT to postgres | INSERT to anon | MAINTAIN to service_role | MAINTAIN to postgres | MAINTAIN to anon | MAINTAIN to authenticated | REFERENCES to postgres | REFERENCES to anon | REFERENCES to authenticated | REFERENCES to service_role | SELECT to anon | SELECT to service_role | SELECT to authenticated | SELECT to postgres | TRIGGER to service_role | TRIGGER to authenticated | TRIGGER to anon | TRIGGER to postgres | TRUNCATE to authenticated | TRUNCATE to postgres | TRUNCATE to service_role | TRUNCATE to anon | UPDATE to postgres | UPDATE to anon | UPDATE to authenticated | UPDATE to service_role
-- visit_events: DELETE to authenticated | DELETE to service_role | DELETE to anon | DELETE to postgres | INSERT to service_role | INSERT to authenticated | INSERT to postgres | INSERT to anon | MAINTAIN to service_role | MAINTAIN to authenticated | MAINTAIN to anon | MAINTAIN to postgres | REFERENCES to service_role | REFERENCES to anon | REFERENCES to authenticated | REFERENCES to postgres | SELECT to authenticated | SELECT to postgres | SELECT to service_role | SELECT to anon | TRIGGER to anon | TRIGGER to service_role | TRIGGER to authenticated | TRIGGER to postgres | TRUNCATE to authenticated | TRUNCATE to anon | TRUNCATE to service_role | TRUNCATE to postgres | UPDATE to postgres | UPDATE to anon | UPDATE to service_role | UPDATE to authenticated
-- visit_products: DELETE to authenticated | DELETE to service_role | DELETE to anon | DELETE to postgres | INSERT to anon | INSERT to postgres | INSERT to service_role | INSERT to authenticated | MAINTAIN to anon | MAINTAIN to service_role | MAINTAIN to postgres | MAINTAIN to authenticated | REFERENCES to authenticated | REFERENCES to anon | REFERENCES to service_role | REFERENCES to postgres | SELECT to postgres | SELECT to anon | SELECT to service_role | SELECT to authenticated | TRIGGER to service_role | TRIGGER to postgres | TRIGGER to authenticated | TRIGGER to anon | TRUNCATE to service_role | TRUNCATE to postgres | TRUNCATE to anon | TRUNCATE to authenticated | UPDATE to authenticated | UPDATE to service_role | UPDATE to anon | UPDATE to postgres
-- visits: DELETE to postgres | DELETE to anon | DELETE to authenticated | DELETE to service_role | INSERT to authenticated | INSERT to postgres | INSERT to service_role | INSERT to anon | MAINTAIN to postgres | MAINTAIN to service_role | MAINTAIN to anon | MAINTAIN to authenticated | REFERENCES to anon | REFERENCES to authenticated | REFERENCES to service_role | REFERENCES to postgres | SELECT to authenticated | SELECT to service_role | SELECT to anon | SELECT to postgres | TRIGGER to authenticated | TRIGGER to postgres | TRIGGER to anon | TRIGGER to service_role | TRUNCATE to postgres | TRUNCATE to anon | TRUNCATE to authenticated | TRUNCATE to service_role | UPDATE to service_role | UPDATE to anon | UPDATE to postgres | UPDATE to authenticated
