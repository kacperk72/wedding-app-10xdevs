# Wydruk „Lista winietek" — projekt

Data: 2026-07-14
Strona: `wedding-planner/frontend/src/app/pages/guests`

## Cel

Umożliwić wydruk płaskiej listy gości z pustymi kwadratami do odhaczenia
długopisem — narzędzie do śledzenia, komu przygotowano już winietkę (place card).

## Decyzje produktowe (zatwierdzone)

- **Zakres gości:** wszyscy oprócz `rsvpStatus === 'declined'`. Odmowom nie
  przygotowuje się winietki — spójne z logiką rozsadzenia.
- **Układ:** płaska lista alfabetyczna, sort po `lastName`, potem `firstName`,
  niezależnie od filtrów ustawionych na ekranie (wydruk jest deterministyczny).
- **Checkbox:** pusty kwadrat `☐` do zaznaczenia ręcznie. Wydruk-only, **bez**
  zmian w bazie, modelu ani backendzie.
- **Etykieta przycisku:** „Drukuj listę".

## Zawartość wydruku

- Nagłówek: „Lista winietek" + para młoda i data wesela (z `WeddingService`).
- Wiersze: `☐  Imię Nazwisko` + lekka, szara adnotacja stołu po prawej
  (`tableLabel(tableId)`, „—" gdy brak) jako pomoc przy układaniu na sali.
- Stopka: „Winietki do przygotowania: N".

## Mechanizm (wzorzec z `seating.page`)

- Ukryty blok `.winietki-print-root` w szablonie strony Goście, `aria-hidden`.
- Widoczny tylko w `@media print`; reszta strony (`app-page-header`, panele,
  modale) chowana w tym samym media query. Chrome powłoki chowa już globalny
  `styles/_print.scss`.
- Przycisk „Drukuj listę" w nagłówku strony woła `printWinietki()`, które
  wywołuje `window.print()` w `setTimeout(…, 0)` (spójne z `seating.page`).
- `winietkiList = computed(...)` filtruje i sortuje gości z
  `guestsService.guests()` — dane już ładowane na stronie, brak nowych zapytań.

## Poza zakresem

- Persystencja statusu „winietka gotowa".
- Grupowanie per stół (odrzucone na rzecz listy alfabetycznej).
- Zmiany w backendzie / migracje.

## Pliki

- `guests.page.ts` — `winietkiList` computed, `printWinietki()`, ekspozycja
  `wedding` z `WeddingService`.
- `guests.page.html` — przycisk w nagłówku + blok `.winietki-print-root`.
- `guests.page.scss` — reguły `@media print`.
