# Oferta sali — spójna prezentacja dań + edycja/dodawanie inline

**Data:** 2026-07-03
**Zakres:** frontend (`wedding-planner/frontend`), zakładka „Oferta sali" (catering). Zero zmian w backendzie i modelu danych.

## Problem

Zakładka „Oferta sali" prezentuje dania w sekcjach na dwa różne sposoby zależnie od trybu wyboru kursu — co daje duże, niespójne różnice wizualne:

- Kurs `couple_picks` z `choiceLimit === 1` → **pionowa lista wierszy** z **radio buttonami** (`<ul class="dish-list">` + inline markup `dish-row` w `course-section.html`).
- Kurs z wielokrotnym wyborem lub `all_served` → **siatka kartek** z **checkboxami** (`<div class="dish-grid">` + komponent `DishCard`).

Dodatkowo:
- Znaczniki dań (vege/vegan/GF/alergeny) są **zduplikowane** — raz w inline `dish-row` w `course-section.html`, raz w `dish-card.html`.
- **Brak edycji istniejących dań** z poziomu konfiguratora. Możliwe jest tylko twarde usunięcie w dialogu „Edytuj ofertę". Serwis frontendowy ma już `updateDish` (backend: `PATCH /catering/dishes/:dishId`), ale nic go nie wywołuje.
- Dodawanie własnego dania to rozwijany inline formularz w sekcji, który powiela pola i rozpycha sekcję.

## Decyzje (zatwierdzone z PO)

1. **Jeden układ: lista wierszy.** Radio vs checkbox różnią się tylko glifem inputu (◉/○ vs ☑/☐); układ identyczny niezależnie od trybu wyboru.
2. **Edycja i dodawanie inline w sekcjach** (nie w osobnym miejscu).
3. **Wspólny modal** jako edytor dania — ten sam komponent dla „Dodaj własne" i dla ołówka przy istniejącym daniu.
4. **Ikona kosza = „usuń z tej sekcji"** (unlink z kursu, `unlinkDishFromCourse`) — nieniszcząca; danie zostaje w ofercie i innych kursach. Twarde kasowanie dania zostaje wyłącznie w dialogu „Edytuj ofertę".

## Rozwiązanie

### 1. Nowy komponent `DishRow` (`components/dish-row/`)

Zastępuje `DishCard` oraz wklejony inline markup wiersza w `course-section.html`. Renderuje jedno danie jako wiersz na pełną szerokość:

- glif wyboru po lewej: `radio` / `checkbox` / brak (dla `controlType === 'none'`),
- treść: nazwa + opis,
- znaczniki vege/vegan/GF/alergeny — **jedno źródło prawdy** (koniec duplikacji),
- ikony akcji po prawej: ołówek (edytuj) + kosz (usuń z sekcji) — renderowane tylko gdy `editable` (pakiet modyfikowalny).

**Interfejs**
- Inputs: `dish: LinkedDish`, `selected: boolean`, `disabled = false`, `controlType: 'checkbox' | 'radio' | 'none'`, `editable = false`.
- Outputs: `toggled(boolean)`, `editRequested()`, `unlinkRequested()`.

**A11y:** `<label>` obejmuje wyłącznie input + treść dania; przyciski akcji (ołówek/kosz) są rodzeństwem obok labela w tym samym `<li>` (nie wewnątrz — inaczej klik w ikonę przełączałby wybór). Przyciski mają `aria-label` („Edytuj danie", „Usuń danie z sekcji").

### 2. `course-section.html` — jedna gałąź renderowania

Znika rozgałęzienie radio-`<ul>` vs checkbox-`<div class="dish-grid">`. Zostaje jedna `<ul class="dish-list">` renderująca `<app-dish-row>` na każde danie. `role="radiogroup"` + `aria-label` nakładane na `<ul>` tylko w trybie radio. Usuwamy ścieżkę siatki oraz wklejony inline markup wiersza i inline formularz dodawania.

### 3. Nowy komponent `DishEditorDialog` (`components/dish-editor-dialog/`)

Modal z formularzem: nazwa (wymagana), opis, checkboxy vege/vegan/GF, alergeny (lista tagów). Jeden komponent dla obu trybów:

- **dodaj** — puste pola; nagłówek „Dodaj danie",
- **edytuj** — pola wypełnione z `dish`; nagłówek „Edytuj danie".

**Interfejs**
- Inputs: `dish: LinkedDish | null` (null = tryb dodawania), `courseTitle: string` (kontekst w nagłówku).
- Outputs: `saved(CreateDishDto)`, `closed()`.

Wzorzec modala jak `offer-editor` / `freeze-contract-dialog` (`modal-backdrop` + `role="dialog"` + `aria-modal`).

### 4. `CourseSection` (logika)

- Usuwam stan inline-formularza (`formOpen`, `customName`, `customDescription`, `customVegetarian`, `customVegan`, `customGlutenFree`) i metodę `submitCustomDish` — przenosi się do dialogu.
- Dodaję stan: `editorOpen: boolean`, `editingDish: LinkedDish | null` (null = tryb dodawania).
- Przycisk „Dodaj własne danie" zostaje w sekcji, ale otwiera `DishEditorDialog` w trybie dodawania.
- Ołówek na wierszu → otwiera dialog w trybie edycji (`editingDish = dish`).
- Outputy do rodzica:
  - `dishSaved({ course, dish: LinkedDish | null, dto: CreateDishDto })` — `dish === null` → create+link, inaczej → update,
  - `dishUnlinked({ course, dish: LinkedDish })`.
- Zachowuję `controlType` / `isDisabled` / `hint` / `pickedCount` / `selectedName` bez zmian.

### 5. `CateringPage` (wiring)

- `addCustomDish` (istnieje) obsługuje gałąź create: `createDish` → `linkDishToCourse`.
- Nowa metoda `editDish({ course, dish, dto })` → `catering.updateDish(weddingId, offerId, dish.dishId, dto)`.
- Nowa metoda `unlinkDish({ course, dish })` → `catering.unlinkDishFromCourse(weddingId, offerId, course.id, dish.dishId)`.
- Handlery `CourseSection`: `(dishSaved)` rozgałęzia na add vs edit; `(dishUnlinked)` → `unlinkDish`.

### 6. Sprzątanie

- Usuwam komponent `DishCard` (`dish-card.ts` / `.html` / `.scss`) — wchłonięty przez `DishRow`; usuwam import z `CourseSection`.
- SCSS: konsoliduję style `.dish-row`, kasuję `.dish-grid` i style kartek, dodaję style ikon akcji (ołówek/kosz).

## Poza zakresem (bez zmian)

- Backend, migracje, model danych (`catering.model.ts`).
- `PriceSummary`, `AddonsList`, `PackageTabs`.
- `OfferEditor` — dialog „Edytuj ofertę" zostaje jako pełny CRUD + twarde kasowanie dań (komplementarny do edycji inline).
- Reguły limitu wyboru (`choiceLimit`, deselekcja przy radio) — logika `onPickChanged` w `CateringPage` bez zmian.

## Testy / weryfikacja

- Build frontendu przechodzi (`ng build`), brak martwych importów po usunięciu `DishCard`.
- Ręczna weryfikacja na presecie „Pałac Polanka 2026": sekcja radio (zupa) i sekcja checkbox (przystawki) renderują się w identycznym układzie wierszy, różnią się tylko glifem.
- Dodanie własnego dania przez modal pojawia się jako wiersz w sekcji.
- Edycja istniejącego dania (ołówek) zmienia nazwę/znaczniki w wierszu.
- „Usuń z sekcji" (kosz) znika wiersz z kursu, danie nadal widoczne w „Edytuj ofertę → Dania".
- Jeśli w repo są spec-e komponentów catering — aktualizacja/dodanie lekkich testów `DishRow` / `DishEditorDialog`.
