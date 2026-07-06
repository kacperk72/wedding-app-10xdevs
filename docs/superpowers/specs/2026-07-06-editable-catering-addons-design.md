# Edytowalne opcje płatne (catering addons) — spec

**Data:** 2026-07-06
**Zakres:** frontend-only (wedding-planner/frontend)
**Moduł:** M6 catering — panel „Opcje płatne" na stronie konfiguracji oferty

## Problem

Na stronie „Oferta sali" panel „Opcje płatne" (addons) pozwala tylko zaznaczyć/odznaczyć
pozycję i ustawić ilość. Edycja definicji dodatku (nazwa, treść, cena, jednostka) jest
schowana w modalu „Edytuj ofertę" i obsługuje **wyłącznie cenę**. Użytkownik chce móc
w pełni zarządzać opcjami płatnymi bezpośrednio na głównym panelu — w tym „Wiejskim stołem",
gdzie potrzebuje wpisać zawartość (skład) i cenę.

## Ustalenia (z brainstormingu)

- **Model treści:** wolny tekst. Zawartość opcji płatnej to istniejące pole `description`
  (np. lista wędlin/serów wpisana ręcznie). **Bez zmian schematu, bez migracji.**
- **Miejsce edycji:** inline na panelu „Opcje płatne" (główny widok konfiguracji), nie w
  modalu „Edytuj ofertę".
- **Wiejski stół:** jest już opcją płatną (addon) w presecie Pałac Polanka 2026
  (`price: 1500, per_event`). Nie jest sekcją menu — nie ma konwersji ani migracji danych.
  Obejmuje go ta sama edycja co pozostałe opcje płatne.
- **Edytor:** modal, wzorowany na istniejącym `dish-editor-dialog` (spójność wzorca).

## Stan zastany (co już działa)

- **Backend — pełny CRUD gotowy** (`routes/catering-addons.js`):
  - `POST /catering/offers/:offerId/addons` — tworzy (name, price, pricingUnit, description, sortOrder)
  - `PATCH /catering/addons/:addonId` — aktualizuje dowolny podzbiór pól
  - `DELETE /catering/addons/:addonId` — usuwa dodatek i powiązane picki
    (`wedding_catering_addon_picks`)
- **Frontend serwis** (`CateringService`): `updateAddon(weddingId, offerId, addonId, patch)`
  już istnieje (PATCH). Brakuje `createAddon` i `deleteAddon`.
- **Helper etykiet:** `core/format/catering.labels.ts` → `pricingUnitLabel()` mapuje 5 jednostek
  na polskie etykiety (dodany wcześniej).
- **Model:** `CateringAddon { id, offerId, name, price, pricingUnit, description, sortOrder }`
  oraz `PricingUnit = 'per_person' | 'per_event' | 'per_bottle' | 'per_hour' | 'per_unit'`.

## Rozwiązanie

Frontend-only. Trzy jednostki pracy.

### 1. `CateringService` — dwie nowe metody

```
createAddon(weddingId, offerId, dto: CreateAddonDto): Observable<CateringAddon>
  → POST /weddings/:weddingId/catering/offers/:offerId/addons
  → tap(() => loadOffer(weddingId, offerId))

deleteAddon(weddingId, offerId, addonId): Observable<void>
  → DELETE /weddings/:weddingId/catering/addons/:addonId
  → tap(() => loadOffer(weddingId, offerId))
```

`updateAddon` zostaje bez zmian (już przyjmuje `Partial<CateringAddon>`).

Nowe DTO w `catering.model.ts`:

```
export interface CreateAddonDto {
  name: string;
  price: number;
  pricingUnit: PricingUnit;
  description?: string | null;
  sortOrder?: number;
}
```

### 2. Nowy komponent `addon-editor-dialog`

Lokalizacja: `pages/catering/components/addon-editor-dialog/`. Modal 1:1 wzorowany na
`dish-editor-dialog` (ten sam backdrop/panel/role="dialog", `OnPush`, sygnały na pola).

Wejścia/wyjścia:
- `addon = input<CateringAddon | null>()` — `null` = tryb dodawania, obiekt = edycja.
- `saved = output<CreateAddonDto>()`
- `closed = output<void>()`

Pola formularza:
- **Nazwa** — tekst, wymagane (blokada zapisu przy pustej).
- **Zawartość** — `textarea`, mapowane na `description` (dozwolone puste → `null`).
- **Cena** — number, min 0.
- **Jednostka** — `select` z 5 wartości `PricingUnit`; etykiety z `pricingUnitLabel()`.

### 3. `AddonsList` — rozbudowa panelu „Opcje płatne"

- Nagłówek panelu dostaje przycisk **„Dodaj opcję"** (otwiera dialog w trybie dodawania).
- Każdy wiersz dodatku: obok checkboxa, nazwy i `cena · jednostka` dochodzą:
  - wyświetlenie `description` pod nazwą (jeśli niepuste),
  - ikony **Edytuj** / **Usuń** (wzorzec z `dish-row`: `icon-button`, `edit` / `x`).
- Usuwanie: hard-delete (konwencja repo — brak soft-delete w MVP). Wywołuje `deleteAddon`.
- Nowe outputy komponentu:
  - `addonSaved = output<{ addon: CateringAddon | null; dto: CreateAddonDto }>()`
  - `addonDeleted = output<CateringAddon>()`
- Stan dialogu trzymany lokalnie w `AddonsList` (`editorOpen`, `editingAddon`), jak w
  `course-section`.

### 4. `catering.page.ts` — podpięcie

- `onAddonSaved({ addon, dto })`: jeśli `addon === null` → `createAddon`, w przeciwnym razie
  → `updateAddon(..., addon.id, dto)`. Błąd → toast.
- `onAddonDeleted(addon)`: `deleteAddon(..., addon.id)`. Błąd → toast.
- Szablon: podpiąć nowe outputy `app-addons-list`.

## Rozdział pojęć: pick vs definicja (ważne przy nazewnictwie)

Istniejące `setAddon` / `removeAddon` w `catering.page.ts` dotyczą **zaznaczenia** dodatku w
selekcji (`addon_picks`) — NIE definicji w ofercie. Nowe metody dotyczą **definicji** i noszą
nazwy `createAddon` / `updateAddon` / `deleteAddon` (serwis) oraz `onAddonSaved` /
`onAddonDeleted` (page), żeby te dwa światy się nie zlewały.

## Poza zakresem (YAGNI)

- Strukturalne pod-pozycje opcji płatnej (odrzucone na rzecz wolnego tekstu).
- Konwersja sekcji menu → opcja płatna (niepotrzebna — wiejski stół jest już addonem).
- Zmiany w modalu „Edytuj ofertę" (zostaje jak jest; edycja przenosi się na główny panel).
- Reorder (drag-and-drop) opcji płatnych — poza zakresem tej zmiany.
- Zmiany w backendzie — CRUD już istnieje i jest pokryty testami.

## Weryfikacja

- Dodanie opcji płatnej → pojawia się na panelu po odświeżeniu oferty.
- Edycja nazwy/zawartości/ceny/jednostki „Wiejskiego stołu" → zmiany widoczne na panelu i w
  podsumowaniu ceny (gdy zaznaczony).
- Usunięcie opcji płatnej → znika z panelu; jeśli była zaznaczona, znika też z selekcji/ceny.
- `npx tsc --noEmit -p tsconfig.app.json` bez błędów.
- Istniejące testy backendu (catering) pozostają zielone (brak zmian w BE).
