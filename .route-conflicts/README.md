# Parked route files — DO NOT DELETE, pending IA decision

Two route files were parked here byte-for-byte on 2026-09-21 because they
resolved to the same URLs as the Stage 2 ops flow, which breaks the Next.js
build ("two parallel pages that resolve to the same path"):

- `admin-customers-list.page.tsx`  ← was `src/app/(admin)/customers/page.tsx`  → routed to `/customers`
- `admin-customers-detail.page.tsx` ← was `src/app/(admin)/customers/[id]/page.tsx` → routed to `/customers/[id]`

Colliding ops routes (required by the Stage 2 master spec §9/§13/§14):

- `src/app/(ops)/customers/page.tsx` → `/customers`
- `src/app/(ops)/customers/[id]/page.tsx` → `/customers/[id]`

Notes:
- The parked admin pages render the SAME shared components
  (`CustomerSnapshot`, `HistoryLayers` from `src/components/ops.tsx`) and the
  same store, differing only in shell chrome (AdminShell vs ops top bar).
- `AdminShell` nav "Customers" (`/customers`) and "Today (floor)" (`/today`)
  already point at the shared ops routes and keep working.
- To restore: move each file back to its original path. The build will fail
  again until ONE owner per URL is decided.

Options for the IA owner:
  A. Keep shared `/customers` + `/customers/[id]` (current state, recommended
     for Stage 2 — one customer truth, consistent per spec §32).
  B. Namespace admin under `/admin/*` (move the whole `(admin)` group to
     `src/app/admin/...`, update AdminShell nav links).
