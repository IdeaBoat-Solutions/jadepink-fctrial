# JadePink Store OS — UI/UX + design-engineering audit

Date: 2026-09-22
Scope: all surfaces — public boutique landing, login/register, floor ops (FC + manager), back-office admin.

Findings are ordered by impact. Each item names the file so it can be picked up directly.

---

## Done in this pass

### P0 — correctness / usability blockers

| Fix | Where |
|---|---|
| **Drawer stole focus on every keystroke.** The focus effect depended on `[onClose]`; callers pass inline arrows, so each render re-ran the effect, restored focus to the previous element and re-focused the panel — typing a bill number or a drop note lost the caret after one character. Now mount-only with a stable `closeRef`, and it respects React `autoFocus`. | `src/components/floor/ui.tsx` |
| **Background scrolled behind `aria-modal` drawers.** Body scroll is now locked while a drawer or confirm dialog is open, and restored on close. | `src/components/floor/ui.tsx`, `src/components/ui.tsx` |
| **Confirm dialog had no focus trap.** Tab could walk out behind an `alertdialog`. Trap added; also gained `cancelLabel` (it was hard-coded to the visit-specific "Keep visit" in a generic component). | `src/components/ui.tsx` |

### P1 — accessibility

| Fix | Where |
|---|---|
| **Nested `<main>` in the admin shell** (`SidebarInset` renders `<main>`, admin-shell rendered a second one inside). One landmark now; the skip link targets it. | `src/components/layout/admin-shell.tsx` |
| **Admin sidebar was not a landmark and had no current-page state.** Wrapped in `<nav aria-label="Store navigation">`, active links now carry `aria-current="page"`. | `src/components/layout/admin-shell.tsx` |
| **No skip link in the admin shell** (ops already had one). Added a shared `.skip-link`. | `src/components/layout/admin-shell.tsx`, `src/app/globals.css` |
| **Horizontal-scroll tables were unreachable by keyboard.** The scroll container is now `tabIndex={0}` + `role="region"` with a label, and `<th>` carries `scope="col"`. | `src/components/ui/table.tsx` |
| **Unlabelled Select triggers.** Filter selects (inventory) and the new-product Category/Supplier selects had no accessible name. | `src/app/(admin)/inventory/page.tsx`, `src/app/(admin)/inventory/new/page.tsx` |
| **Icon-only `✕` button with no name.** | `src/components/ops.tsx` |
| **Field hint/error text was never attached to its control.** `Field` now clones the child with `aria-describedby` (+ `aria-invalid` on error) in both field systems, so AT announces the message with the input. | `src/components/floor/ui.tsx`, `src/components/ui.tsx` |
| **Incorrect ARIA tab pattern.** The product filter row and the login method switcher used `role="tab"` with no tabpanel/roving tabindex. Converted to `role="group"` + `aria-pressed` toggle buttons. | `src/components/floor/floor-board.tsx`, `src/app/login/page.tsx` |
| **Heading structure.** Login/register had their only `h1` inside a `hidden lg:flex` panel (no visible `h1` on mobile); the blocked-visit screen rendered two `h1`s. `AccessNote` now takes `headingLevel`. | `src/app/login/page.tsx`, `src/app/register/page.tsx`, `src/components/floor/ui.tsx`, `src/components/floor/visit-workspace.tsx` |
| **Invalid `<dl>` markup.** `Metric` rendered `div > p` inside `<dl>` stat strips. Now renders `dt`/`dd`. | `src/components/floor/ui.tsx` |
| **Async status not announced.** "Searching…", "Looking up…" and the match count are now `role="status"`. | `src/components/floor/floor-board.tsx` |

### P2 — contrast + touch targets

| Fix | Where |
|---|---|
| Stat-card labels/subs used `#7a736a` on tinted washes (~4.0–4.2:1). Tinted variants now use `#5c564d` (>4.5:1); untinted use `#6b645c`. | `src/components/floor/floor-board.tsx` |
| "Dropped" pill was `#7a736a` on `#f1ece4` (~3.98:1) → `#57534e`. | `src/components/floor/floor-board.tsx` |
| Input placeholders `#b8b0a4` (~2.1:1) → `#736c64` (~4.6:1). | `src/components/floor/floor-board.tsx` |
| Filter chips / sort select were 36px tall → 40px (closer to the 44px coarse-pointer target). | `src/components/floor/floor-board.tsx` |

Verified after the pass: `tsc --noEmit`, `eslint`, `next build`, and 33 vitest tests all pass.

---

## Backlog — still open

### High value

1. **One semantic colour vocabulary.** Success is defined 4× (`#1A5C3E`, `#1c6b46`, `#177245`, `#2e6b4f`), amber 3×, danger 5×, info 3×. Four near-identical neutral families exist for paper/surface/line/ink — card borders alone are `#E5E0D8`, `#e8dfd6`, `#e3dbd2`, `#e9e2d8`. Pick one set, alias the rest.
2. **Unify the brand value.** `--staff-brand`/`--fp-brand` are `#8E3A4E`, but primary buttons hard-code crimson `rgba(180,35,77)` with hover `#a11e45` / active `#7d1434` (`src/components/ui.tsx`, `admin-shell.tsx`, `admin-command.tsx`). One token fixes every primary CTA.
3. **Tokenize the ops-console palette.** `floor-board.tsx` has ~75 inline hex values (`#23403a`, `#f1ece4`, `#211d18`, `#e9e2d8`, `#7a736a`, `#e0d7c9`, `#e7dfd3`, `#faf7f2`) that duplicate `--fp-*` tokens.
4. **Delete the dead design systems.** `.site-dark` and `.site-light` in `globals.css` (~370 lines) have zero class usages — the landing page uses `.boutique`. `src/components/stage3.tsx` is imported by nobody.
5. **Collapse duplicate primitives.** 4 button systems, 4 overlay systems, 4 empty states, 4 status badges, 4 field/input systems, 3 skeleton shimmers. Standardise on the shadcn/radix ones for admin and keep one ops-flavoured set.
6. **Give ops a shared page rhythm.** Admin has `.staff-page`; ops pages use ad-hoc `mt-5/6/8/10` and `p-4/5/6`. Add a `.floor-page` wrapper and use it. Also `(ops)/loading.tsx` double-wraps `.floor-os`.
7. **Unify `cn` imports.** 28 files import from the npm `cn` package, the rest from `@/lib/utils`. Same helper, two sources.
8. **Type scale.** 26 distinct inline `text-[NNpx]` values (10→56) plus a separate rem scale on the public site. Promote the existing `.staff-kicker`/`.staff-title`/`.staff-h2` utilities and delete the one-offs.

### Medium

9. **Admin `CardTitle` renders a `<div>`,** so admin pages have an `h1` and no section headings at all. Make it an `h3` (or accept an `as` prop).
10. **Move `(ops)/products/*` onto the ops design system** — it currently mixes shadcn Card/Button with the floor shell.
11. **`prefers-reduced-motion` only covers named classes.** Pervasive `hover:-translate-y-px active:scale-[0.98]` still animates; spinners still spin. Add a global reduced-motion rule for transform/scale utilities.
12. **Coarse-pointer 44px safeguard is defeated** by Tailwind `min-h-*` classes. Audit the remaining sub-44px controls (sort select, torch/stop, suite buttons, sidebar icon button, mode toggle).
13. **`aria-label` on role-less containers** (several `div`s) is ignored by AT — add `role="status"`/`region`.
14. **Team accordion** has `aria-expanded` without `aria-controls`.
15. **Settings page** has a `<Label htmlFor="theme">` pointing at no element.

### Lower

16. Add `scope="col"`-aware sorting semantics if tables ever become sortable.
17. Consider a shared `EmptyState` illustration plate — four inline reimplementations exist.
18. Public landing: unify `text-[0.9375rem]` / `text-[1.75rem]` / `text-[2.75rem]` one-offs onto the Tailwind scale.
