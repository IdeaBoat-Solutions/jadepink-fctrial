-- JadePink Store OS — 230: per-visit budget + WhatsApp follow-up log.
--
-- 1) visits.budget (text, nullable): every new visit captures its OWN budget,
--    prefilled from customers.budget but stored separately — so visit #2 never
--    overwrites visit #1. Customer profile budget stays the default for next time.
-- 2) whatsapp_logs: manual follow-up log shown next to customer history
--    (no WhatsApp Business API wired yet — FCs log "sent Hi / replied / shared
--    catalogue" + deep-link to wa.me via the customer mobile).
-- Run in Dashboard > SQL Editor (safe to re-run).

-- ---------- 1. per-visit budget ----------
alter table public.visits add column if not exists budget text;

-- ---------- 2. whatsapp follow-up log ----------
create table if not exists public.whatsapp_logs (
  id text primary key default gen_random_uuid()::text,
  customer_id text not null references public.customers(id) on delete cascade,
  visit_id text references public.visits(id) on delete set null,
  direction text not null default 'outgoing'
    check (direction in ('outgoing', 'incoming', 'note')),
  body text not null check (char_length(body) between 1 and 1000),
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_logs_customer_idx on public.whatsapp_logs (customer_id, created_at desc);
create index if not exists whatsapp_logs_visit_idx on public.whatsapp_logs (visit_id);

alter table public.whatsapp_logs enable row level security;

drop policy if exists "authenticated read whatsapp logs" on public.whatsapp_logs;
drop policy if exists "authenticated write whatsapp logs" on public.whatsapp_logs;

-- Customer-scoped table with no store_id: any signed-in staff can read/write,
-- same posture as customers (floor needs it for follow-ups).
create policy "authenticated read whatsapp logs" on public.whatsapp_logs
  for select to authenticated using (true);
create policy "authenticated write whatsapp logs" on public.whatsapp_logs
  for insert to authenticated with check (true);
create policy "authenticated update whatsapp logs" on public.whatsapp_logs
  for update to authenticated using (true) with check (true);
