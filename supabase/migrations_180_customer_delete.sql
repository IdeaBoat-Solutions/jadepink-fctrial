-- JadePink Store OS — 180 customer delete: allow staff deletes on customers.
-- Run in Supabase Dashboard > SQL Editor (safe to re-run).
-- Without this, manager DELETE /api/customers/[id] fails with RLS denial.
-- Role enforcement stays in the API layer (deleteCustomer() requires a
-- managing role AND refuses any customer with visits or orders); this policy
-- only unblocks the query path, matching the update policy from 170.

drop policy if exists "authenticated delete customers" on public.customers;

create policy "authenticated delete customers" on public.customers
  for delete to authenticated
  using (true);
