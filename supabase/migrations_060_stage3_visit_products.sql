
-- JadePink Store OS — 060 Stage 3: visit_products table
-- Run AFTER 040 + 050 in SQL Editor.
-- Safe to re-run (all statements are IF NOT EXISTS).

-- ---------- Visit products ----------
-- A product variant interacted with during a specific visit.
-- Status flows: SELECTED → TRIAL_IN_PROGRESS → TRIAL_COMPLETED → LIKED | DROPPED
create table if not exists public.visit_products (
  id text primary key default gen_random_uuid()::text,

  visit_id text not null references public.visits(id) on delete cascade,
  product_variant_id text not null references public.product_variants(id) on delete restrict,

  status public.product_visit_status not null default 'SELECTED',

  -- Timestamps for the product journey
  added_at timestamptz not null default now(),
  trial_started_at timestamptz,
  trial_completed_at timestamptz,
  liked_at timestamptz,
  dropped_at timestamptz,

  -- Drop reason (mandatory when dropped)
  drop_reason_id text references public.drop_reasons(id),

  -- Free-text note (e.g. for "Other" drop reason)
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Prevent duplicate product+variant in same visit
  unique (visit_id, product_variant_id)
);

-- A dropped product must have a drop reason.
-- Business rule: drop and reason are captured in ONE atomic operation
-- (dropProduct(visitProductId, dropReasonId)) so a DROPPED row can never
-- exist without a reason. captureDropReason() may later correct/clarify it.
-- PostgreSQL has no ADD CONSTRAINT IF NOT EXISTS — guard on pg_constraint.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.visit_products'::regclass
      and conname = 'visit_products_drop_reason_required'
  ) then
    alter table public.visit_products
      add constraint visit_products_drop_reason_required
      check (status <> 'DROPPED' or drop_reason_id is not null);
  end if;

  -- Trial timestamps must be sane
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.visit_products'::regclass
      and conname = 'visit_products_trial_order'
  ) then
    alter table public.visit_products
      add constraint visit_products_trial_order
      check (trial_completed_at is null or trial_started_at is null or trial_completed_at >= trial_started_at);
  end if;
end $$;

create index if not exists visit_products_visit_idx on public.visit_products (visit_id);
create index if not exists visit_products_variant_idx on public.visit_products (product_variant_id);
create index if not exists visit_products_status_idx on public.visit_products (visit_id, status);
create index if not exists visit_products_variant_status_idx on public.visit_products (product_variant_id, status);
create index if not exists visit_products_active_trials_idx on public.visit_products (visit_id, status) where status = 'TRIAL_IN_PROGRESS';
