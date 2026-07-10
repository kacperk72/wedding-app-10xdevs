# Wydruk rozsadzenia „Dla sali" + dieta dziecięca

Data: 2026-07-10 · Autor: para + Claude · Status: zatwierdzony do implementacji

## Problem

Właścicielka sali / obsługa cateringu potrzebuje wydruku ustawienia stołów z
przypisaniem gości do konkretnych miejsc oraz wyróżnieniem osób na diecie
wegetariańskiej/wegańskiej. Obecny wydruk na stronie rozsadzenia jest przeglądem
dla Pary Młodej — lista nazwisk pogrupowana po stołach, bez numerów krzeseł i bez
informacji o diecie. Dodatkowo brakuje w systemie diety „dziecięca", która też ma
być widoczna na wydruku.

## Zakres

Dwie zmiany:

### A. Wariant wydruku „Dla sali"

- Nowy przycisk **„Dla sali"** obok istniejącego **„Drukuj"** w nagłówku strony
  rozsadzenia. Istniejący wydruk (przegląd dla Pary Młodej) zostaje bez zmian.
- Zawartość wydruku dla sali:
  - Nagłówek: „Rozkład stołów — wersja dla obsługi sali", podsumowanie
    (rozsadzeni / wszyscy, liczba stołów), legenda `Ⓥ = wege/wegańska`,
    `Ⓓ = dziecięca`.
  - Karta każdego stołu (siatka, `break-inside: avoid`): nazwa + `zajętych/miejsc`,
    **numerowana lista tylko zajętych miejsc** (`Krzesło 3 — Nowak Jan Ⓥ`).
    Puste krzesła są pomijane.
  - Goście przypisani do stołu bez numeru krzesła → podlista „Bez przypisanego
    miejsca".
  - Sekcja „Nieposadzeni" na osobnej stronie, również z oznaczeniami diet.

### B. Nowa dieta „Dziecięca"

Autoryzowane przez PO — nadpisuje zapis „diet enum ma 5 wartości" w CLAUDE.md
(§ Resolved product decisions). `guests.diet` to kolumna `text` z CHECK-constraint
(nie enum PG), więc rozszerzenie jest czyste.

- Wartość w kodzie: `kids` · etykieta PL: „Dziecięca" · marker wydruku: `Ⓓ`.

## Realizacja techniczna

| Warstwa | Zmiana |
|---|---|
| Migracja | Nowa: `guests.diet` CHECK dodaje `'kids'`. `db push` + drift-check MCP. |
| Backend | `routes/guests.js` — `"kids"` do tablicy `DIETS`. |
| Model FE | `guest.model.ts` — `Diet` union + `DIET_LABELS['kids']='Dziecięca'`. Dropdown/filtr/edytor gości są data-driven, aktualizują się same. |
| Seating FE | `printTarget: 'couple'\|'venue'` signal; `printVenueLayout()` ustawia `'venue'` i woła `window.print()` po flushu (`setTimeout 0`). Drugi blok `.seating-print--venue`, sterowany klasą wrappera. Helpery `seatMarks(guest)` (Ⓥ/Ⓓ). Styl w `@media print` w `seating.page.scss`. |
| Docs | `04-database.md` (constraint), `CLAUDE.md` (5→6), `STATUS.md`. |
| Testy | mock-supabase seed jeśli trzeba; `seating.page.spec.ts` (przycisk, markery, tylko zajęte miejsca). |

## Świadomie pominięte (YAGNI)

- Brak per-stołowego podsumowania diet (tylko oznaczenia).
- Brak graficznego okrągłego stołu na wydruku.
- Brak oznaczeń pozostałych diet (bezglutenowa itd.) na wydruku dla sali.
- `guest_aggregates.vegeOrVegan` bez zmian — dzieci liczone osobno.
