# JadePink · Store OS (jadepink-fctrial)

Fullstack Next.js store operations — floor workflow (Stage 2) + management back-office
(dashboard, inventory, orders, suppliers, customers, reports, settings).

## Stack

- **Next.js 16** App Router, TypeScript, `src/` dir, `@/*` alias
- **Tailwind CSS v4** + **shadcn/ui (radix-nova)** — `src/components/ui/*`, `components.json`
- **Aceternity-style** blocks in `src/components/aceternity/` — Spotlight / CardSpotlight,
  BentoGrid, MovingBorderButton + TextGenerateEffect, BackgroundBeams / GridBackdrop
  (framer-motion, transform/opacity only, `prefers-reduced-motion` safe)
- **next-themes** dark mode + `ModeToggle`, `TooltipProvider`, `sonner` Toaster
- **Supabase (whole DB)** — Postgres + Auth, no Prisma. Tables + RLS + role
  views in `supabase/migrations_010_base_schema.sql` + `supabase/migrations_020_security.sql`; queries via
  `@supabase/ssr` (`src/lib/supabase/*`). Seeds via `npm run seed:catalog` + `npm run seed:auth`.
- **Zod + React Hook Form** validation shared client + API
- **Recharts** via shadcn `chart.tsx`

## Feature breakdown

| Area | Route | What lives there |
|------|-------|------------------|
| Auth | `/login` → `/today` | Staff sign-in (FC / Manager), demo-local |
| Floor Today | `/today` | Walk-in counts, active visits, awaiting assignment |
| Live floor | `/floor` | Team load, unassigned queue, reassign |
| Walk-in flow | `/walk-in?visit=` | Identify (mobile search) → assign FC → start visit |
| Visit detail | `/visits/[id]` | Customer snapshot, history layers, timeline, Stage-3 handoff |
| **Dashboard** | `/dashboard` | KPIs, revenue-by-day chart, restock list, bento overview |
| **Inventory** | `/inventory`, `/inventory/new`, `/inventory/[id]`, `/inventory/categories` | SKU table + search/filter, Zod create form, stock + movements, taxonomy |
| **Orders** | `/orders` | Order list, status badges, channel mix |
| **Suppliers** | `/suppliers` | Sourcing partners, ratings, raise PO |
| **Customers** | `/customers`, `/customers/[id]` | Shared store (same as floor), snapshot + history |
| **Reports** | `/reports` | Revenue, stock valuation, AOV, channel split |
| **Settings** | `/settings` | Theme, alerts, demo reset |

Ops routes use `(ops)` layout (floor header). Management routes use `(admin)` layout
(shadcn `sidebar.tsx` + `AdminShell`). `/customers` + `/customers/[id]` are shared
ops routes (one customer truth) linked from both shells. Both require sign-in via `StoreProvider`.

## API (Supabase-first, seed fallback)

- `GET /api/products?q=&category=` · `POST /api/products` (Zod `productSchema`)
- `GET /api/categories` · `GET|POST /api/suppliers`
- `GET /api/orders` · `POST /api/orders` (Zod `orderSchema`, computes total)
- `GET /api/dashboard` — `{ kpis, revenue }`

If Supabase isn't configured the routes return `source: "seed"` from `src/lib/inventory.ts`
so the UI never breaks in demo.

## Run

```bash
npm install
# copy .env.example -> .env, fill Supabase URL + keys (see supabase/README.md)
# SQL Editor: run supabase/migrations_010_base_schema.sql, then supabase/migrations_020_security.sql
npm run seed:catalog
npm run seed:auth
npm run dev        # http://localhost:3000 → /login
npm run build
```

Sign in with your staff email + password (`iamsmit05@gmail.com` manager,
`kkshah2005@gmail.com` sales) → `/today` for floor, `/dashboard` for the back-office sidebar.

## Design notes

- Ops (`today/floor/walk-in`) keeps the calm JadePink Nova preset: paper `#faf8f6`,
  ink `#1c1917`, brand `#b4234d`, 44px+ touch targets, `tnum` numerals.
- Admin adds one Aceternity moment per surface (spotlight KPI, beams-ready dark
  slots, bento overview) — never stacked effects.
- Semantic shadcn tokens only (`bg-background`, `text-muted-foreground`); no raw
  `dark:` overrides, no `space-x`, `size-*` for squares, `cn()` for conditionals.
