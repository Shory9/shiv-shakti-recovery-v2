-- Allow the signed-in CRM admin to manage BOB payment records.
-- Executive app writes continue to use the existing restricted RPC.
-- No access is granted to the anonymous role.

alter table public.payments enable row level security;

drop policy if exists "authenticated admins manage bob payments"
  on public.payments;

create policy "authenticated admins manage bob payments"
  on public.payments
  for all
  to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete
  on table public.payments
  to authenticated;
