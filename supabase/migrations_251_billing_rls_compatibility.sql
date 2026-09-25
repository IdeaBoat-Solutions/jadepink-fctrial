-- 251: preserve security-invoker record_sale for floor billing.
-- record_sale() runs as the signed-in staff member, so its order/order-item
-- inserts must be allowed for the visit's own store. The API still blocks FC
-- manual order creation; this policy only permits the store-scoped ledger RPC.

drop policy if exists "manager insert orders" on public.orders;
create policy "store scoped insert orders" on public.orders
  for insert to authenticated
  with check (public.can_access_store(store_id));

drop policy if exists "manager insert order items" on public.order_items;
create policy "store scoped insert order items" on public.order_items
  for insert to authenticated
  with check (public.can_access_order(order_id));
