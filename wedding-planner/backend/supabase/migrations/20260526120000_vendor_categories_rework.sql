-- Rework vendor categories per product decision (2026-05-26):
--   kwiaciarz -> dekoratorka
--   ksiadz    -> kosciol
--   tort      -> slodki_stol_tort
--   usc       -> deleted (category removed entirely)
--   new       -> ciasta_pozegnalne
--
-- Order matters: data migration MUST run BEFORE the CHECK constraint is rebuilt,
-- otherwise the UPDATE will violate the (still-old) CHECK.

do $$
declare
  usc_count integer;
begin
  select count(*) into usc_count from public.vendors where category = 'usc';
  if usc_count > 0 then
    raise notice 'Deleting % vendor rows with removed category "usc"', usc_count;
  end if;
end
$$;

delete from public.vendors where category = 'usc';

update public.vendors set category = 'dekoratorka'      where category = 'kwiaciarz';
update public.vendors set category = 'kosciol'          where category = 'ksiadz';
update public.vendors set category = 'slodki_stol_tort' where category = 'tort';

alter table public.vendors drop constraint if exists vendors_category_check;
alter table public.vendors add constraint vendors_category_check
  check (category in (
    'sala',
    'catering',
    'fotograf',
    'dj',
    'dekoratorka',
    'kosciol',
    'makijaz',
    'dekoracje',
    'slodki_stol_tort',
    'ciasta_pozegnalne'
  ));
