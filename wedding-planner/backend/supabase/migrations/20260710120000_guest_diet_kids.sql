-- Rozszerza dozwolone wartości diety gościa o „kids" (dieta dziecięca).
-- guests.diet to kolumna text z CHECK-constraint (nie enum PG), więc wystarczy
-- podmienić ograniczenie. Wartość w kodzie po angielsku (spójnie z
-- vege/vegan/gluten_free); etykieta PL „Dziecięca" żyje w warstwie UI.
-- Decyzja PO z 2026-07-10 — nadpisuje zapis „diet ma 5 wartości" w CLAUDE.md.

alter table public.guests drop constraint if exists guests_diet_check;

alter table public.guests
  add constraint guests_diet_check
  check (diet in ('pending', 'standard', 'vege', 'vegan', 'gluten_free', 'kids'));
