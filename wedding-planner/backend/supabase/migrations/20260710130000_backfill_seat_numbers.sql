-- Backfill krzeseł: goście przypisani do stołu bez seat_number dostają pierwsze
-- wolne krzesła (alfabetycznie po nazwisku), dokładnie tak, jak dotąd widok
-- szczegółowy układał ich efemerycznie. Odtąd wydruk i widok szczegółowy czytają
-- to samo seat_number (decyzja PO 2026-07-10: utrwalić przypisanie do krzeseł).
-- Wolne miejsca liczone z pominięciem krzeseł już zajętych przez gości z jawnym
-- numerem, więc nie łamiemy unikalnego indeksu uq_guests_table_seat.

with free_seats as (
  select
    t.id as table_id,
    s.seat_no,
    row_number() over (partition by t.id order by s.seat_no) as free_rn
  from public.tables t
  cross join lateral generate_series(1, t.seats_count) as s(seat_no)
  where not exists (
    select 1
    from public.guests g
    where g.table_id = t.id
      and g.seat_number = s.seat_no
  )
),
to_seat as (
  select
    g.id as guest_id,
    g.table_id,
    row_number() over (
      partition by g.table_id
      order by lower(g.last_name), lower(g.first_name), g.id
    ) as guest_rn
  from public.guests g
  where g.table_id is not null
    and g.seat_number is null
)
update public.guests g
set
  seat_number = fs.seat_no,
  updated_at = now()
from to_seat ts
join free_seats fs
  on fs.table_id = ts.table_id
  and fs.free_rn = ts.guest_rn
where g.id = ts.guest_id;
