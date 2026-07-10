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
  - Nagłówek: „Rozkład stołów" (bez dopisku „dla obsługi sali"), podsumowanie
    (rozsadzeni / wszyscy, liczba stołów). Bez legendy — dieta oznaczona
    czytelnym słownym kodem (patrz niżej).
  - **Graficzny diagram każdego stołu** (nie lista): okrąg z nazwą stołu i
    `zajętych/miejsc` w środku, a wokół — wieniec krzeseł rozłożonych po kątach
    (krzesło n pod kątem `-90° + n·360/seatsCount`, start u góry, zgodnie z ruchem
    wskazówek zegara). Przy każdym zajętym krześle: numer w kółku + `Nazwisko Imię`
    + ewentualna **plakietka diety** — krótki kod na ciemnym tle (`WEGE`, `WEGAN`,
    `DZIECKO`), wysoki kontrast, czytelna też w druku czarno-białym
    (`print-color-adjust: exact` wymusza wydruk tła). **Renderowane tylko zajęte
    krzesła** — puste sloty zostawiają
    lukę w wieńcu. Dwa stoły w rzędzie (`break-inside: avoid`), żeby nazwiska były
    czytelne także przy 10–12 miejscach (zweryfikowane wizualnie na A4).
  - Goście przypisani do stołu bez numeru krzesła → linijka „Bez miejsca: …"
    pod diagramem.
  - Sekcja „Nieposadzeni" na osobnej stronie, również z oznaczeniami diet.

### B. Nowa dieta „Dziecięca"

Autoryzowane przez PO — nadpisuje zapis „diet enum ma 5 wartości" w CLAUDE.md
(§ Resolved product decisions). `guests.diet` to kolumna `text` z CHECK-constraint
(nie enum PG), więc rozszerzenie jest czyste.

- Wartość w kodzie: `kids` · etykieta PL: „Dziecięca" · plakietka wydruku: `DZIECKO`.

## Realizacja techniczna

| Warstwa | Zmiana |
|---|---|
| Migracja | Nowa: `guests.diet` CHECK dodaje `'kids'`. `db push` + drift-check MCP. |
| Backend | `routes/guests.js` — `"kids"` do tablicy `DIETS`. |
| Model FE | `guest.model.ts` — `Diet` union + `DIET_LABELS['kids']='Dziecięca'`. Dropdown/filtr/edytor gości są data-driven, aktualizują się same. |
| Seating FE | `printTarget: 'couple'\|'venue'` signal; `printVenueLayout()` ustawia `'venue'` i woła `window.print()` po flushu (`setTimeout 0`). Drugi blok `.seating-print--venue`, sterowany klasą wrappera. Helper `roundSeatsForTable(table)` liczy pozycje krzeseł (%) po okręgu; `dietBadge(guest)` → `WEGE`/`WEGAN`/`DZIECKO`. Styl diagramu (`aspect-ratio`, absolutne pozycjonowanie krzeseł) w `@media print` w `seating.page.scss`. |
| Docs | `04-database.md` (constraint), `CLAUDE.md` (5→6), `STATUS.md`. |
| Testy | mock-supabase seed jeśli trzeba; `seating.page.spec.ts` (przycisk, markery, tylko zajęte miejsca). |

## Świadomie pominięte (YAGNI)

- Brak per-stołowego podsumowania diet (tylko oznaczenia).
- Brak oznaczeń pozostałych diet (bezglutenowa itd.) na wydruku dla sali.
- Diagram zakłada stoły okrągłe (produkt nie modeluje kształtu stołu) — brak
  wariantów prostokątnych / w podkowę.
- `guest_aggregates.vegeOrVegan` bez zmian — dzieci liczone osobno.
