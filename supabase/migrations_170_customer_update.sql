-- JadePink Store OS — 170 customer update: allow staff updates on customers.
-- Run in Supabase Dashboard > SQL Editor (safe to re-run).
-- Without this, manager PATCH /api/customers/[id] and the first-attach
-- visit-count bump in attachCustomerToVisit() fail with RLS denial.
-- Role enforcement stays in the API layer (updateCustomer() requires a
-- managing role); this policy only unblocks the query path, matching the
-- existing open insert policy from 110_customer_insert.sql.

drop policy if exists "authenticated update customers" on public.customers;

create policy "authenticated update customers" on public.customers
  for update to authenticated
  using (true) with check (true);
