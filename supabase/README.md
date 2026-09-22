# Supabase setup — JadePink Store OS

The whole DB lives in Supabase Postgres + Supabase Auth. No Prisma, no local SQLite.

## 1. Create the project (5 min, once)

1. https://supabase.com/dashboard > New project > name `jadepink-store`, region closest to Mumbai (e.g. `ap-south-1`).
2. Project Settings > API > copy **Project URL** + **anon key** + **service_role key** (service_role stays local only).
3. Paste all three into `.env` (see `.env.example`).

## 2. Create tables

Supabase Dashboard > SQL Editor > New query > paste `supabase/migrations_010_base_schema.sql` > Run.

Tables: `stores`, `staff_profiles`, `categories`, `suppliers`, `products`,
`product_images`, `customers`, `orders`, `order_items`, `stock_movements`, `visits`,
`visit_events`. Stage 3 adds `product_variants`, `drop_reasons`, `visit_products`
(see §6).

Scripted alternative — applies every file in canonical order, each in its own
transaction, and snapshots the live policy/function/view definitions first:

```bash
npm run db:migrate      # 010 -> 020 -> 030 ... -> 100 (filename order = run order)
npm run db:schema       # dump the LIVE schema to supabase/backups/ (ground truth)
npm run db:backup-rls   # dump live policies/functions/views before a change
```

`DIRECT_URL` in `.env` is used (session mode, port 5432); the pooler URL breaks DDL.
Keep the two SQL dirs honest: `migrations_010_base_schema.sql` is what a fresh project gets, while
`npm run db:schema` shows what the live project actually has. They drift — Stage 3
was live for a while before it was written down here.

File layout (`supabase/`):

| File | What |
|---|---|
| `migrations_010_base_schema.sql` | Stage 1 catalogue + Stage 2 floor tables |
| `migrations_020_security.sql` | RLS helpers, policies, role views, auth trigger |
| `migrations_030…100_*.sql` | Stage 3 block, in order (enums → variants → drop reasons → visit_products → visit_events ext → RLS → seed → realtime) |
| `backfill_sj_barcodes.sql` | One-time backfill for DBs created before the SJ barcode upgrade (already in 010 for fresh DBs) |
| `archive_stage3_products_combined.sql` | Archived: superseded by 030+040+050, do not run |
| `seeds/` | Sample CSVs for import scripts |
| `backups/` | Auto-generated live dumps (ground truth, not source) |

## 3. RLS + role views + auth trigger

Same SQL Editor > New query > paste `supabase/migrations_020_security.sql` > Run.

What you get:

| Object | What it is |
|---|---|
| `staff_profiles` RLS | Staff read own row; managers read/write team |
| `visits` / `visit_events` RLS | Store-scoped: staff see their own store's floor data; admins see all |
| `handle_new_user()` trigger | Every `auth.users` insert auto-creates a `staff_profiles` row (name + role from signup metadata) |
| `v_store_managers` | **View** — active `STORE_MANAGER` logins only |
| `v_salespeople` | **View** — active `FC` logins only |
| `v_floor_team` | **View** — everyone active + `role_label` (`Store Manager` / `Salesperson / FC`) |

## 3b. RLS rule: never reference `staff_profiles` inline

A policy must never do `exists (select 1 from staff_profiles ...)` **on
`staff_profiles` itself** — that makes the table's policy read the same table, and
Postgres aborts the whole query with `42P17 infinite recursion detected in policy`.
Because every other table's role check joins to `staff_profiles`, one self-reference
took down *all* authenticated reads: `requireAuth()`, visits, visit_events, products,
`v_salespeople`. It failed silently in the app (the error was swallowed and surfaced
as a 403), so the offline demo path masked it.

`migrations_020_security.sql` now defines `SECURITY DEFINER` helpers that read `staff_profiles` as
the owner, which is outside RLS, and every policy funnels through them:

| Helper | Answers |
|---|---|
| `is_manager()` | may write catalogue / orders / staff config |
| `is_admin()` | cross-store (`ADMIN`, `MANAGEMENT`) |
| `can_access_store(store_id)` | floor scoping: own store, or any store for admins |
| `can_access_visit(visit_id)` | child-row scoping via the parent visit → store |
| `current_staff_role()` / `current_staff_store()` | the caller's own role / store |

Two related rules, both learned from this bug:

1. **Avoid `for all` on role-checked tables.** `FOR ALL` also governs `SELECT`, so a
   manager-only write policy silently decides what readers may see — that is why plain
   product reads failed while `orders` reads worked (`orders`' manager policy is
   `for update`). Write rights are declared per command now.
2. **Child tables authorise through their parent**, never with a bare
   `using (true)` — `can_access_visit()` is what Stage 3's `visit_products` uses.

Also note the role views are created `with (security_invoker = false)` on purpose.
Supabase defaults new views to `security_invoker = true`, which applies
`staff_profiles` RLS per row — an FC would then see only themselves in
`v_salespeople` and could not list colleagues for assignment. `CREATE OR REPLACE
VIEW` does not change reloptions, so those views are dropped and recreated.

## 4. Catalogue seed

```bash
npm run seed:catalog   # store row ONLY
```

Seeds **only** `store-thaltej`, because `staff_profiles.store_id` FKs to it and
every RLS policy scopes through it — staff logins cannot work without it.

This file previously also pushed a demo catalogue (8 invented products, 6 fake
categories, 4 made-up suppliers, 31 synthetic variants with fabricated
`8900000000xx` barcodes) and 5 fake customers with plausible Indian mobile
numbers. **All of it has been deleted**, along with the equivalent fixtures in
`src/lib/inventory.ts` and `src/lib/domain.ts`. There is no opt-in flag to bring
it back; fake customer PII has no place in this database, and invented products
would poison Stage 3 analytics and the barcode collision checks with stock that
does not exist.

Real stock comes from the client export instead — see §4b.

### Scrubbing demo data that is already in the database

```bash
npm run db:scrub          # plan: counts + which tables, deletes nothing
npm run db:scrub:apply    # dumps every affected row to supabase/backups/scrub-<ts>.json, then deletes
```

Deletes in FK-safe order: `visit_products, visit_events, visits, order_items,
orders, stock_movements, product_images, product_variants, products, suppliers,
categories, customers`.

Always kept: `stores` (staff FK anchor), `staff_profiles` (the logins),
`auth.users`, and `drop_reasons` (Stage 3 controlled vocabulary — the UI and the
`visit_products` CHECK depend on it; it is config, not demo data).

Safety rails: dry run by default, one transaction (any failure rolls back), a
restore point written before deletion, and it **refuses to run** if real S J
FASHIONS rows exist (`id like 'sj-%'` or a non-null barcode) unless you pass
`--allow-real-catalogue`.

## 4b. S J FASHIONS live barcode records

The client's live stock is the "Barcode Search" export (~900 rows: Barcode,
Company Barcode, Department, Brand, Design No., Sales Rate, purchase rates…).
It lives in Supabase `products` — columns for every export field plus
`image_url` + `image_urls` (multiple images per product, declared at
DB-creation time in `supabase/migrations_010_base_schema.sql`) and a `product_images` table
(one row per image, synced to `image_urls` by trigger) with a public
`product-images` storage bucket.

Fresh database: `migrations_010_base_schema.sql` already includes all of this, then:

```bash
# 1. Export the Barcode Search report to CSV (keep the header row)
# 2. Import (dry-run first):
node scripts/import-sj-barcodes.mjs --file "C:/exports/SJ Barcode Search.csv" --dry-run
npm run seed:sj -- --file "C:/exports/SJ Barcode Search.csv"
```

Existing database (010 applied before this upgrade): run
`supabase/backfill_sj_barcodes.sql` once in the SQL Editor first — same objects,
`IF NOT EXISTS` safe — then import.

A 12-row sample (`supabase/seeds/sj_barcodes_sample.csv`, real rows from the
export) validates the pipeline: `npm run seed:sj -- --file supabase/seeds/sj_barcodes_sample.csv`

Scanner lookup: `GET /api/barcode?code=01260901576` (exact barcode →
company barcode → SKU). Product search (`GET /api/products?q=`) also matches
barcode, company barcode, brand and design no.

## 5. Staff logins (FC / store manager accounts)

Accounts are data, not code — edit `scripts/staff.seed.json` and re-run:

```bash
npm run seed:auth          # create any missing accounts (live write)
npm run seed:auth:plan     # preview what would happen, write nothing
npm run seed:auth:list     # read current staff back from the role views
npm run verify:logins      # prove each account can sign in AND pass RLS
```

Seeded (temp password `JadePink123!`, override with `TEMP_STAFF_PASSWORD`;
change it in Dashboard > Authentication > Users):

| Email | Name | Role | View |
|---|---|---|---|
| `iamsmit05@gmail.com` | Smit | `STORE_MANAGER` | `v_store_managers` |
| `kkshah2005@gmail.com` | KK Shah | `FC` | `v_salespeople` |
| `fc-aakash@jadepink.test` | Aakash More | `FC` | `v_salespeople` |
| `fc-zoya@jadepink.test` | Zoya Sheikh | `FC` | `v_salespeople` |
| `fc-rohan@jadepink.test` | Rohan Desai | `FC` | `v_salespeople` |

The three `@jadepink.test` accounts are throwaway demo logins for multi-salesperson
and realtime-concurrency testing; delete them in Dashboard > Authentication when
you no longer need them. The run is idempotent — an existing email is skipped in
Auth and only its `staff_profiles` row is refreshed. Leave `phone` out unless it is
a real number: the upsert writes `null` for omitted fields, so placeholder digits
would become permanent data.

`verify:logins` matters because a profile can exist and still be unusable. It signs
in and then reads `staff_profiles`, `visits`, `products` and `v_salespeople` under
real RLS — which is where the policy-recursion bug in §3b showed up.

## 6. Stage 3 — products, trials, likes/drops

Run these in the SQL Editor **after** steps 2–5. Each file is idempotent
(safe to re-run). Canonical order matters:

| # | File | Creates |
|---|---|---|
| 1 | `migrations_030_stage3_enums.sql` | `product_visit_status` enum |
| 2 | `migrations_040_stage3_product_variants.sql` | `product_variants` (SKU + barcode, unique) |
| 3 | `migrations_050_stage3_drop_reasons.sql` | `drop_reasons` (controlled vocabulary) |
| 4 | `migrations_060_stage3_visit_products.sql` | `visit_products` + checks + indexes |
| 5 | `migrations_070_stage3_visit_events.sql` | `visit_events.entity_type/entity_id` |
| 6 | `migrations_080_stage3_security.sql` | RLS policies + analytics indexes |
| 7 | `migrations_090_stage3_seed.sql` | seeds the 9 drop reasons |
| 8 | `migrations_100_stage3_realtime.sql` | streams `visit_products`/`visit_events` for live floor updates |

`archive_stage3_products_combined.sql` is the old combined alternative to files 1–3 —
archived, do not run; files 1–3 are the canonical path and create identical objects.

Then seed variants (derives size × colour variants from `products`):

```bash
npm run seed:catalog   # re-run: now also upserts product_variants
```

Domain flow lives in `src/features/visits/products/`:
`SELECTED → TRIAL_IN_PROGRESS → TRIAL_COMPLETED → LIKED | DROPPED`,
with `DROP_REASON` mandatory on drop and every step written to `visit_events`.

## 7. How sign-in works now

- `/login` uses `supabase.auth.signInWithPassword` (email + password) when `NEXT_PUBLIC_SUPABASE_URL` is set, then `GET /api/staff/me` loads the profile role and maps it to the existing floor store (`fc` | `manager`) — no other UI changes needed.
- Without Supabase env vars, `/login` falls back to the old demo name + role form so the floor flow still runs offline.
- `GET /api/staff?role=FC|STORE_MANAGER|all` reads the views, and the floor APIs (`/api/visits`, `/api/walk-ins`, `/api/customers`, `/api/salespersons`) query Supabase directly with the signed-in user's session (RLS enforced).

## 9. OTP: Supabase-routed (email free, SMS via Fast2SMS free credit)

Supabase Auth generates and verifies all codes (free on every plan).
Email OTP works natively; phone OTP is delivered by this app through the
Send-SMS hook — no Twilio needed.

1. Fast2SMS signup (free ₹50 credit) → Dev API → copy key → `.env`:
   `FAST2SMS_API_KEY="..."`. Quick-SMS route needs no DLT.
2. Supabase Dashboard > Authentication > Hooks > Send SMS hook >
   Generate secret → `.env`: `SEND_SMS_HOOK_SECRET="v1,whsec_..."`.
3. Same hook screen → URL: `https://<your-app>/api/hooks/send-sms` → Save.
   (Local test: temporary `https://...` tunnel URL works too.)
4. Dashboard > Authentication > Providers > Phone > enable.

App routes:

| Route | Purpose |
|---|---|
| `POST /api/otp/send` `{ channel: "email"\|"phone", email?, phone? }` | Supabase sends the code (5 sends / 10 min per target) |
| `POST /api/otp/verify` `{ channel, email?/phone?, token: "123456" }` | Verifies; session persisted in cookies, caller signed in |
| `POST /api/hooks/send-sms` | Supabase → Fast2SMS delivery; verifies Standard-Webhooks signature, answers empty-200 |

Without `FAST2SMS_API_KEY` the hook logs the OTP to the server console and
still returns 200, so the full Supabase code/verify loop is testable free.

Dashboard > Authentication > Add user > set User Metadata `{"name":"Aakash","role":"FC"}` — the trigger creates the profile row. Or re-run `npm run seed:auth` after adding to `STAFF` in `scripts/seed-auth.mjs`. Managers can also edit roles in `staff_profiles` directly (RLS allows it).
