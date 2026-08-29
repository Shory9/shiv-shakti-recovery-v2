-- Upgrade is used when a customer regularizes/upgrades an older account.
-- Keep the existing BOB payment modes and add Upgrade as the third option.

alter table public.payments
  drop constraint if exists payments_payment_mode_check;

alter table public.payments
  add constraint payments_payment_mode_check
  check (payment_mode in ('Settlement', 'Palti Ki Gayi', 'Upgrade'));
