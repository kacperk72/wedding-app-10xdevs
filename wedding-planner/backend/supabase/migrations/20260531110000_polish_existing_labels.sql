-- Polish labels for data that was seeded before the UI polish pass.
-- Older migrations are already applied on remote databases, so existing rows need
-- a forward-only data migration.

with replacements(old_name, new_name) as (
  values
    ('Stylizacja panny mlodej', 'Stylizacja panny młodej'),
    ('Stylizacja pana mlodego', 'Stylizacja pana młodego'),
    ('USC / formalnosci', 'USC / formalności'),
    ('Transport gosci', 'Transport gości'),
    ('Hotel dla gosci', 'Hotel dla gości'),
    ('Obraczki', 'Obrączki')
)
update public.budget_categories bc
set name = r.new_name
from replacements r
where bc.name = r.old_name
  and not exists (
    select 1
    from public.budget_categories existing
    where existing.wedding_id = bc.wedding_id
      and existing.name = r.new_name
  );

update public.tables t
set name = regexp_replace(t.name, '^Stol ([0-9]+)$', 'Stół \1')
where t.name ~ '^Stol [0-9]+$'
  and not exists (
    select 1
    from public.tables existing
    where existing.wedding_id = t.wedding_id
      and existing.name = regexp_replace(t.name, '^Stol ([0-9]+)$', 'Stół \1')
  );

update public.catering_offers
set name = 'Pałac Polanka 2026'
where name = 'Palac Polanka 2026';

with replacements(old_name, new_name) as (
  values
    ('Zloty', 'Złoty')
)
update public.catering_packages cp
set name = r.new_name
from replacements r
where cp.name = r.old_name
  and not exists (
    select 1
    from public.catering_packages existing
    where existing.catering_offer_id = cp.catering_offer_id
      and existing.name = r.new_name
  );

with replacements(old_text, new_text) as (
  values
    ('Obiad, dwie cieple kolacje, bufety i napoje.', 'Obiad, dwie ciepłe kolacje, bufety i napoje.'),
    ('Obiad, trzy cieple kolacje, rozszerzony bufet zimny, salatki i napoje.', 'Obiad, trzy ciepłe kolacje, rozszerzony bufet zimny, sałatki i napoje.'),
    ('Najszerszy pakiet z czterema cieplymi kolacjami i najwiekszym bufetem.', 'Najszerszy pakiet z czterema ciepłymi kolacjami i największym bufetem.')
)
update public.catering_packages cp
set description = r.new_text
from replacements r
where cp.description = r.old_text;

with replacements(old_title, new_title) as (
  values
    ('Obiad / danie glowne', 'Obiad / danie główne'),
    ('Kolacja ciepla I', 'Kolacja ciepła I'),
    ('Kolacja ciepla II', 'Kolacja ciepła II'),
    ('Kolacja ciepla 1', 'Kolacja ciepła 1'),
    ('Kolacja ciepla 2', 'Kolacja ciepła 2'),
    ('Kolacja ciepla 3', 'Kolacja ciepła 3'),
    ('Kolacja ciepla 4', 'Kolacja ciepła 4'),
    ('Bufet salatkowy', 'Bufet sałatkowy')
)
update public.catering_courses cc
set title = r.new_title
from replacements r
where cc.title = r.old_title;

with replacements(old_name, new_name) as (
  values
    ('Podkarpacki proziak z maslem czosnkowym', 'Podkarpacki proziak z masłem czosnkowym'),
    ('Deska wedlin regionalnych', 'Deska wędlin regionalnych'),
    ('Salatka Cezar z kurczakiem', 'Sałatka Cezar z kurczakiem'),
    ('Salatka grecka', 'Sałatka grecka'),
    ('Salatka z kasza bulgur i warzywami', 'Sałatka z kaszą bulgur i warzywami'),
    ('Salatka jarzynowa', 'Sałatka jarzynowa'),
    ('Salatka z gruszka i serem plesniowym', 'Sałatka z gruszką i serem pleśniowym'),
    ('Salatka ziemniaczana', 'Sałatka ziemniaczana'),
    ('Salatka z wedzonym kurczakiem', 'Sałatka z wędzonym kurczakiem'),
    ('Salatka makaronowa', 'Sałatka makaronowa'),
    ('Salatka z burakiem i rukola', 'Sałatka z burakiem i rukolą')
)
update public.catering_dishes cd
set name = r.new_name
from replacements r
where cd.name = r.old_name
  and not exists (
    select 1
    from public.catering_dishes existing
    where existing.catering_offer_id = cd.catering_offer_id
      and existing.name = r.new_name
  );

with replacements(old_name, new_name) as (
  values
    ('Wiejski stol', 'Wiejski stół'),
    ('Slodki stol + tort', 'Słodki stół + tort')
)
update public.catering_addons ca
set name = r.new_name
from replacements r
where ca.name = r.old_name
  and not exists (
    select 1
    from public.catering_addons existing
    where existing.catering_offer_id = ca.catering_offer_id
      and existing.name = r.new_name
  );
