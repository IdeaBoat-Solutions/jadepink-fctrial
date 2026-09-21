-- JadePink Store OS — allow staff to create customer records.
-- Run in Supabase Dashboard > SQL Editor (safe to re-run).
-- Without this, POST /api/customers fails for every signed-in role with
-- RLS denial, which the API surfaces as 422 "Could not save customer".

drop policy if exists "authenticated insert customers" on public.customers;

-- Any signed-in staff (FC included — they register walk-ins) may insert.
-- Reads stay as-is; no update/delete granted here.
create policy "authenticated insert customers" on public.customers
  for insert to authenticated with check (true);
