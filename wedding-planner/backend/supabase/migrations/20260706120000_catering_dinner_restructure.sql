-- Forward-only data migration: naprawa struktury kolacji w istniejących ofertach
-- (odpowiednik poprawki w seedzie palac-polanka-2026.js).
--
-- Stara struktura (per modyfikowalny pakiet): osobne kursy "Kolacja ciepła I/II/III"
-- (każdy couple_picks, wybór 1) + "Ostatnia kolacja" (wybór 1).
-- Nowa struktura: JEDNA sekcja "Ciepłe kolacje" (wybór = liczba dotychczasowych ciepłych
-- kolacji: Srebrny 1, Złoty 2, Diamentowy 3) + "Ostatnia kolacja serwowana lub bufet" (wybór 1).
--
-- Pakiet Szefa Kuchni ma kolacje jako 'all_served' — jest wykluczony przez filtr
-- selection_mode = 'couple_picks' i pozostaje nietknięty.
--
-- Migracja jest idempotentna: po pierwszym przebiegu tytuły przestają pasować do filtrów,
-- więc ponowne uruchomienie nic nie zmienia.

drop table if exists _dinner_merge;

create temporary table _dinner_merge as
select
  c.id                                                                                   as course_id,
  c.catering_package_id                                                                  as package_id,
  row_number() over (partition by c.catering_package_id order by c.sort_order, c.title)  as rn,
  count(*)     over (partition by c.catering_package_id)                                 as cnt
from public.catering_courses c
where c.course_type = 'kolacja_ciepla'
  and c.selection_mode = 'couple_picks'
  and c.title like 'Kolacja ciep%';

-- 1) Przenieś istniejące wybory dań z nadmiarowych kursów ciepłych kolacji na kurs-keeper
--    (najniższy sort_order). ON CONFLICT chroni przed duplikatem tego samego dania.
insert into public.wedding_catering_dish_picks
  (wedding_catering_selection_id, catering_course_id, catering_dish_id)
select p.wedding_catering_selection_id, keep.course_id, p.catering_dish_id
from public.wedding_catering_dish_picks p
join _dinner_merge loser on loser.course_id = p.catering_course_id and loser.rn > 1
join _dinner_merge keep  on keep.package_id = loser.package_id and keep.rn = 1
on conflict do nothing;

-- 2) Usuń nadmiarowe kursy (kaskada sprząta ich powiązania dań i przeniesione już picki).
delete from public.catering_courses c
using _dinner_merge m
where m.course_id = c.id
  and m.rn > 1;

-- 3) Zamień kurs-keeper w jedną sekcję "Ciepłe kolacje" z właściwym limitem wyboru.
update public.catering_courses c
set title = 'Ciepłe kolacje',
    choice_limit = m.cnt,
    sort_order = 40,
    updated_at = now()
from _dinner_merge m
where m.course_id = c.id
  and m.rn = 1;

-- 4) Zmień nazwę sekcji ostatniej kolacji.
update public.catering_courses
set title = 'Ostatnia kolacja serwowana lub bufet',
    updated_at = now()
where course_type = 'kolacja_ciepla'
  and selection_mode = 'couple_picks'
  and title = 'Ostatnia kolacja';

-- 5) Wyczyść placeholder z opisów dodatków.
update public.catering_addons
set description = null,
    updated_at = now()
where description = 'Cena placeholder - Adjust after vendor confirmation.';

drop table _dinner_merge;
