-- Add explicit payment method to payments (gotowka/przelew).
-- Default "przelew" backfills every existing row; UI can change per-payment later.

alter table public.payments
  add column method text not null default 'przelew'
    check (method in ('gotowka', 'przelew'));
