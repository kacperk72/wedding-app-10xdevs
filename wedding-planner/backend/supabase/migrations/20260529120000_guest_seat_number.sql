-- Numer krzesła gościa w obrębie stołu (wizualne miejsca przy stole).
-- Sensowny tylko gdy table_id jest ustawione; odpięcie od stołu zeruje seat_number
-- (logika w API). Zakres 1..tables.seats_count egzekwowany w warstwie Express,
-- bo zależy od innej tabeli — tu pilnujemy jedynie dolnej granicy i unikatu krzesła.

ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS seat_number smallint CHECK (seat_number >= 1);

-- Jedno krzesło = jeden gość w obrębie stołu.
CREATE UNIQUE INDEX IF NOT EXISTS uq_guests_table_seat
  ON guests(table_id, seat_number)
  WHERE table_id IS NOT NULL AND seat_number IS NOT NULL;
