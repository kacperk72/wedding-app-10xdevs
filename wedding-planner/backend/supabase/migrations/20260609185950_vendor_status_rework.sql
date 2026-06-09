-- Vendors: pelna os postepu statusow (7 wartosci zamiast 5).
-- Remap: zaplacony -> oplacony, wykonany -> zrealizowany.
-- Inline CHECK z m1 dostal auto-nazwe vendors_status_check.

alter table public.vendors drop constraint if exists vendors_status_check;

update public.vendors set status = 'oplacony' where status = 'zaplacony';
update public.vendors set status = 'zrealizowany' where status = 'wykonany';

alter table public.vendors add constraint vendors_status_check check (
  status in (
    'rozwazany',
    'spotkanie',
    'zarezerwowany',
    'umowa_podpisana',
    'zaliczka_wplacona',
    'oplacony',
    'zrealizowany'
  )
);
