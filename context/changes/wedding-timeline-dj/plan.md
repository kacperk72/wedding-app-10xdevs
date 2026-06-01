# Zakładka „Harmonogram" (ankieta DJ-a) — Implementation Plan

## Overview

Nowa zakładka **„Harmonogram"** w wedding-plannerze, w której para wypełnia ankietę
otrzymaną od DJ-a: godzinowy przebieg dnia wesela, pytania logistyczne, preferencje
muzyczne i listy utworów, a następnie eksportuje czytelną „Wersję dla DJ-a" do
druku / PDF. Funkcja reużywa danych już obecnych w aplikacji (imiona pary, miejsce
ceremonii, liczba gości, DJ/sala z kontrahentów) zamiast zbierać je ponownie.

## Current State Analysis

Repo ma dojrzały, powtarzalny wzorzec dla zasobów per-wesele:

- **Backend route**: `express.Router({ mergeParams: true })` + `router.use(requireWeddingMember())`,
  montowany w `server.js` pod `/api/weddings/:weddingId/<resource>` z `requireSsoAuth`
  na poziomie mount (`server.js:53-71`). CRUD przez service-role `supabase`, filtrowany
  `.eq("wedding_id", …)`. Wzorce manualnych encji: `routes/tasks.js`, `routes/meetings.js`.
- **Mappery** snake→camel w `utils/mappers.js` (np. `mapTask:339`, `mapMeeting:354`).
- **Walidacja** w `utils/request-validation.js` — są helpery na string/enum/date/boolean/integer,
  **brak** walidatora pory dnia HH:MM (jest tylko `dateString` YYYY-MM-DD).
- **Frontend serwis** per zasób: signal-cache listy + `list/create/update/remove` zwracające
  Observable aktualizujący sygnał przez `tap()` (`tasks.service.ts`).
- **Strona** standalone OnPush, sygnały, `WeddingService.wedding()?.id` jako źródło `weddingId`,
  `ToastService`, współdzielone UI `PageHeader`/`EmptyState`/`Icon` (`tasks.page.ts`).
- **Nawigacja** w dwóch miejscach: `app-sidebar.ts:24-34` (desktop) i `mobile-bottom-nav.ts:20-30`
  (mobile), plus route w `app.routes.ts` pod `/app`.
- **DB**: RLS jest **deny-all na każdej tabeli** (`service_role` omija), więc każda nowa tabela
  musi mieć `enable row level security`. Migracje są timestampowane; wiele tabel ma kolumny
  `created_at`/`updated_at` (widoczne w mapperach), więc istnieje wzorzec triggera `updated_at`.
- **Testy**: mock-Supabase + HTTP harness w `test/helpers/`; nowe tabele wymagają seedów w
  `db` defaults; CRUD + odrzucanie cross-wedding testowane per zasób (`*-crud.test.js`).

**Scope governance**: strona „Harmonogram" **nie jest** na liście stron w `docs/demo-app/01-overview.md`
(słowo „harmonogram" występuje tam wyłącznie w kontekście harmonogramu płatności). To świadome
rozszerzenie zakresu na życzenie PO — plan zawiera round-trip do `01-overview.md` i `04-database.md`.

## Desired End State

Para wchodzi w „Harmonogram", widzi formularz podzielony na sekcje odpowiadające ankiecie DJ-a,
z pre-fillem danych już znanych (read-only podgląd imion / miejsca / liczby gości / DJ-a). Wypełnia
godzinowy przebieg dnia (lista zdarzeń z możliwością dodania/usunięcia/zmiany kolejności, startująca
od szablonu DJ-a), pytania logistyczne, preferencje muzyczne (chipy 10 kategorii + muzyka per etap)
oraz listy must-play / do-not-play (wiersze tytuł+wykonawca, limit 50 dla must-play). Zapis działa
per sekcja, wszystkie pola opcjonalne. Przycisk **„Wersja dla DJ-a"** otwiera czytelny widok do
druku/zapisu PDF z całą ankietą.

Weryfikacja: pełny vertical slice — `npm test` w backendzie zielony (w tym `timeline-crud.test.js`),
front buduje się i renderuje stronę wpiętą do nawigacji, a ręczny test potwierdza zapis sekcji,
edycję listy zdarzeń i poprawny widok eksportu.

### Key Discoveries:

- Wzorzec route per zasób: `routes/tasks.js:66-146` (CRUD), `routes/meetings.js:82-169` (FK-assert + load-by-id).
- Mount + auth: `server.js:53-71`.
- Mappery: `utils/mappers.js:339-366`.
- Brak walidatora HH:MM — trzeba dodać do `utils/request-validation.js:63-82` (obok `dateString`).
- Nawigacja w dwóch plikach: `app-sidebar.ts:24-34` i `mobile-bottom-nav.ts:20-30`.
- Reuse danych: `WeddingService` (imiona, `ceremonyLocation`), guests/aggregates (liczba gości),
  vendors (DJ/sala) — front łączy z kilku serwisów, źródło prawdy pozostaje w istniejących encjach.
- RLS lockdown: każda nowa tabela `enable row level security` bez polityk (deny-all dla anon/authenticated).

## What We're NOT Doing

- **Nie** integrujemy harmonogramu z dashboardem (brak kafelka „przebieg dnia" w tej iteracji).
- **Nie** wprowadzamy autosave — zapis jest jawny, per sekcja.
- **Nie** nadpisujemy istniejących danych wesela z poziomu harmonogramu (reuse read-only, brak override).
- **Nie** budujemy współdzielonego linku/konta dla DJ-a — eksport to druk/PDF po stronie pary.
- **Nie** wysyłamy maila/mp3 do DJ-a (ankieta wspomina `grupanexo@gmail.com` — poza zakresem MVP).
- **Nie** wersjonujemy harmonogramu ani nie trzymamy historii zmian.
- **Nie** dodajemy globalnego katalogu utworów/gatunków — lista 10 kategorii jest stałą w kodzie.

## Implementation Approach

Model danych hybrydowy: jeden wiersz `wedding_timeline` (1:1 z weselem) na pola skalarne +
jsonb na preferencje gatunków i muzykę per etap; dwie tabele potomne — `timeline_events`
(godzinowy przebieg) i `timeline_songs` (listy must/do-not). Backend to pojedynczy router
`timeline.js` z lazy-create rekordu nadrzędnego (GET tworzy pusty, jeśli brak), PATCH-em pól
skalarnych (zapis per sekcja = PATCH podzbioru) oraz pod-CRUD-em na `events` i `songs`. Front
to jedna strona z sekcjami i dedykowanymi sub-komponentami, plus osobny chrome-less widok
eksportu. Kolejność faz: schemat → backend+testy → frontend → eksport — każda kolejna faza
opiera się o poprzednią.

## Critical Implementation Details

- **Pora dnia ≠ data.** Zdarzenia harmonogramu i pola godzinowe (pierwszy taniec, tort) to
  pora dnia (HH:MM), nie data kalendarzowa. Trzeba dodać walidator `requireTimeString` /
  `optionalTimeString` (regex `^\d{2}:\d{2}$` + zakres 00:00–23:59) — istniejący `dateString`
  obsługuje wyłącznie YYYY-MM-DD. W DB kolumny typu `time` (bez strefy).
- **Lazy-create rekordu nadrzędnego — przy pierwszym `PATCH`, nie przy `GET`.** `GET /timeline`
  jest czystym odczytem i zwraca syntetyczny pusty obiekt, gdy rekordu brak (żaden inny zasób w
  repo nie pisze podczas GET — patrz F3). Wiersz `wedding_timeline` powstaje przy pierwszym
  `PATCH`, wstawiany idempotentnie po `wedding_id` (unikat) — przy współedycji dwójki nie może
  powstać drugi wiersz.
- **Limit 50 dotyczy tylko must-play.** Walidacja przy `POST /songs` z `kind = "must"` liczy
  istniejące wiersze tego rodzaju dla wesela; `do_not` bez limitu.
- **Seed szablonu jest opcjonalny i nieniszczący.** `POST /events/seed-template` wstawia
  predefiniowane etykiety DJ-a tylko gdy lista zdarzeń jest pusta (żeby ponowne kliknięcie nie
  duplikowało wierszy); front pokazuje przycisk „Wczytaj szablon DJ-a" w pustym stanie.

## Phase 1: Schemat bazy + migracja

### Overview
Trzy nowe tabele, RLS, indeksy, triggery `updated_at`, push do Supabase oraz round-trip do
`04-database.md`.

### Changes Required:

#### 1. Migracja SQL
**File**: `wedding-planner/backend/supabase/migrations/<ts>_wedding_timeline.sql` (utworzyć przez
`npx supabase migration new wedding_timeline`)

**Intent**: Założyć podsystem harmonogramu: rekord 1:1 z weselem + dwie tabele potomne, z RLS
deny-all i indeksami pod zapytania per-wesele.

**Contract**:
- `wedding_timeline` — `id uuid pk`, `wedding_id uuid not null unique references weddings(id) on delete cascade`,
  pola logistyki (pyt. 1–11): `ceremony_type` (enum/text `koscielny|cywilny`), `ceremony_time time`,
  `travel_minutes smallint`, `venue_arrival_time time`, `entrance_order` (text `goscie_pierwsi|para_pierwsza`),
  `glass_throwing` (text `nie|zewnatrz|wewnatrz`), `wishes_location` (text `pod_koscielem|lokal_przed_obiadem|lokal_po_obiedzie`),
  `dance_floor_ground_floor boolean`, `has_children boolean`, `gorzko_tolerance boolean`;
  dane kontaktowe nieobecne gdzie indziej: `venue_manager_name text`, `venue_manager_phone text`,
  `witnesses text`, `bride_parents text`, `groom_parents text`;
  pierwszy taniec: `first_dance_time time`, `first_dance_song text`, `first_dance_full boolean`;
  podziękowania rodzicom: `parents_thanks_enabled boolean`, `parents_thanks_time time`,
  `parents_thanks_form text`, `parents_thanks_song text`;
  tort: `cake_time time`, `cake_entry_song text`, `cake_cutting_song text`;
  preferencje: `genre_preferences jsonb not null default '[]'`, `music_per_stage jsonb not null default '{}'`,
  `notes text`; `created_at`, `updated_at timestamptz default now()`.
  **`music_per_stage` trzyma TYLKO etapy nie pokryte polami dedykowanymi** (wejście pary, składanie
  życzeń, przerwy, rzut welonem/wstążki, rzut muszką/skrzynka, taniec „nowej" pary) — by uniknąć
  podwójnego wpisywania (patrz F4). Pozycje pokrywające się (pierwszy taniec, wjazd/krojenie tortu,
  podziękowania) w widoku eksportu są **wyprowadzane z pól dedykowanych** (`first_dance_*`,
  `cake_*`, `parents_thanks_*`), nie zbierane drugi raz.
- `timeline_events` — `id uuid pk`, `wedding_id uuid not null references weddings(id) on delete cascade`,
  `label text not null`, `event_time time`, `sort_order int not null default 0`, `notes text`,
  `created_at`, `updated_at`.
- `timeline_songs` — `id uuid pk`, `wedding_id uuid not null references weddings(id) on delete cascade`,
  `kind text not null check (kind in ('must','do_not'))`, `title text not null`, `artist text`,
  `sort_order int not null default 0`, `created_at`, `updated_at`.
- Indeksy: `(wedding_id)` na obu tabelach potomnych; unikat `wedding_id` na `wedding_timeline`.
- `enable row level security` na wszystkich trzech tabelach (bez polityk — deny-all, spójnie z
  migracją `20260524090000_rls_lockdown`).
- Triggery `updated_at` zgodnie z istniejącym wzorcem (sprawdzić nazwę funkcji triggera w migracji
  schematu `20260523233000_m1_schema_and_seed.sql` i ją reużyć; `set search_path` jak w lockdown,
  jeśli tworzysz nową funkcję).

#### 2. Push migracji
**Intent**: Zastosować migrację w Supabase, żeby kod opierający się o tabele był testowalny.
**Contract**: `npx supabase db push` z `wedding-planner/backend/`; po pushu `mcp list_migrations`
zgadza się z `ls supabase/migrations/` (drift-check z CLAUDE.md).

#### 3. Round-trip do dokumentacji modelu danych
**File**: `docs/demo-app/04-database.md`
**Intent**: Dodać opis trzech nowych tabel, by doc pozostał kontraktem (zasada „schema zmienia
się → najpierw doc, potem migracja, potem kod").
**Contract**: Nowa sekcja „Harmonogram (ankieta DJ-a)" z kolumnami i relacjami trzech tabel.

### Success Criteria:

#### Automated Verification:
- Migracja aplikuje się czysto: `npx supabase db push` kończy się sukcesem
- Liczba migracji na dysku zgadza się z `mcp list_migrations`
- Backendowy test suite nadal przechodzi: `npm test` (w `wedding-planner/backend`)

#### Manual Verification:
- W panelu Supabase widoczne trzy tabele z włączonym RLS
- `get_advisors` nie zgłasza nowych ostrzeżeń bezpieczeństwa dla tych tabel

**Implementation Note**: Po tej fazie i przejściu weryfikacji automatycznej zatrzymaj się i poproś
o ręczne potwierdzenie przed kolejną fazą.

---

## Phase 2: Backend — route, mappery, walidacja, testy

### Overview
Router `timeline.js` z lazy-create, PATCH-em pól skalarnych i pod-CRUD-em `events`/`songs`,
walidatorem HH:MM, mapperami i testami HTTP.

### Changes Required:

#### 1. Walidatory pory dnia
**File**: `wedding-planner/backend/src/utils/request-validation.js`
**Intent**: Dodać walidację pory dnia HH:MM (zdarzenia, pola godzinowe) — odrębną od `dateString`.
**Contract**: `requireTimeString(body,key)` i `optionalTimeString(body,key)` zwracające
znormalizowane `"HH:MM"`. Regex akceptuje **opcjonalne sekundy** —
`^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$` — i zwraca `value.slice(0, 5)`. Powód: PostgREST
serializuje kolumny `time` jako `"HH:MM:SS"` (np. `"14:30:00"`), więc `GET` → re-`PATCH`
tej samej sekcji musi przejść. Wyeksportować w `module.exports`.

#### 2. Mappery
**File**: `wedding-planner/backend/src/utils/mappers.js`
**Intent**: snake→camel dla trzech encji; agregat złożony zwracany przez `GET /timeline`.
**Contract**: `mapTimeline(row)`, `mapTimelineEvent(row)`, `mapTimelineSong(row)`; eksport w
`module.exports`. `mapTimeline` zwraca pola skalarne (camelCase), `genrePreferences` (array) i
`musicPerStage` (obiekt). **Wszystkie pola `time` mapper tnie do `"HH:MM"`** (`value?.slice(0, 5)`),
żeby front (`<input type="time">`) i walidator round-trip działały spójnie (patrz F1) — dotyczy
`ceremony_time`, `venue_arrival_time`, `first_dance_time`, `parents_thanks_time`, `cake_time`
w `mapTimeline` oraz `event_time` w `mapTimelineEvent`. Pełny obiekt zakładki składany w route (timeline + events[] + songs
rozbite na `mustPlay[]`/`doNotPlay[]`).

#### 3. Router harmonogramu
**File**: `wedding-planner/backend/src/routes/timeline.js`
**Intent**: Jedyny router zasobu, wzorowany na `tasks.js`/`meetings.js`, z lazy-create rekordu
nadrzędnego i pod-CRUD-em list.
**Contract**:
- `express.Router({ mergeParams: true })` + `router.use(requireWeddingMember())`.
- `GET /` → **odczyt bez efektów ubocznych**: jeśli `wedding_timeline` istnieje, zwraca go z
  listami; jeśli nie — zwraca **syntetyczny pusty obiekt** (pola `null`/`[]`/`{}`) bez zapisu do
  bazy, wraz z pustymi `events`, `mustPlay`, `doNotPlay`. Wiersz NIE powstaje przy GET.
- `PATCH /` → tu następuje **lazy-create**: jeśli rekordu brak, wstaw go idempotentnie po
  `wedding_id` (unikat), potem zaktualizuj. Waliduje i zapisuje podzbiór pól skalarnych +
  `genrePreferences`/`musicPerStage` (zapis per sekcja); `requireAtLeastOne`; enumy logistyki przez
  `enumValue`; godziny przez `optionalTimeString`.
- `GET /events`, `POST /events`, `PATCH /events/:eventId`, `DELETE /events/:eventId` — CRUD wierszy,
  `label` wymagany, `event_time` opcjonalny (HH:MM), `sort_order` int; sort po `sort_order` potem `event_time`.
- `POST /events/seed-template` → wstawia predefiniowane etykiety DJ-a **tylko gdy lista pusta**;
  zwraca utworzone wiersze. Lista etykiet (stała w pliku): `Ślub`, `Wejście na salę`, `Życzenia`,
  `Obiad`, `Deser`, `Pierwszy taniec`, `Tort`, `I gorące danie`, `II gorące danie`, `Oczepiny`,
  `III gorące danie`, `Podziękowania dla rodziców`, `Pokaz zimnych ogni`, `Sesja zdjęciowa`
  (z rosnącym `sort_order`).
- `GET /songs`, `POST /songs`, `PATCH /songs/:songId`, `DELETE /songs/:songId` — CRUD; `kind`
  (`must|do_not`) i `title` wymagane, `artist` opcjonalny; przy `POST` z `kind="must"` walidacja
  limitu 50 (policz istniejące must-play dla wesela, rzuć `BadRequestError` po przekroczeniu).
- Wszystkie zapytania filtrowane `.eq("wedding_id", req.params.weddingId)`; load-by-id z
  `NotFoundError` jak w `meetings.js:131-151`.

#### 4. Montaż w serwerze
**File**: `wedding-planner/backend/src/server.js`
**Intent**: Wystawić router pod ścieżką per-wesele z auth.
**Contract**: `app.use("/api/weddings/:weddingId/timeline", requireSsoAuth, timelineRouter);`
(dodać import obok pozostałych route'ów, sekcja `server.js:53-71`).

#### 5. Seedy mock-Supabase + testy
**File**: `wedding-planner/backend/test/helpers/mock-supabase.js`, `wedding-planner/backend/test/timeline-crud.test.js`
**Intent**: Dodać tabele do `db` defaults i pokryć CRUD + walidacje + odrzucanie cross-wedding.
Dodatkowo dopisać `wedding_timeline`, `timeline_events`, `timeline_songs` do listy
`weddingScopedTables` w `cascadeWeddingDelete` (mock-supabase.js:~206), by `wedding-delete.test.js`
weryfikował kaskadowe sprzątanie zgodnie z `on delete cascade` w realnym Postgresie (patrz F6).
**Contract**: `timeline-crud.test.js` pokrywa: lazy-create przez `GET`, PATCH pól skalarnych +
`requireAtLeastOne`, CRUD `events` (w tym `seed-template` nie duplikuje przy ponownym wywołaniu),
CRUD `songs` z odrzuceniem 51. must-play, walidacja HH:MM (zły format → 400), odrzucenie dostępu
do cudzego wesela (jak w pozostałych `*-crud.test.js`).

### Success Criteria:

#### Automated Verification:
- Cały backendowy suite zielony: `npm test` (w `wedding-planner/backend`)
- Nowy `timeline-crud.test.js` przechodzi (CRUD + cross-wedding + limit 50 + walidacja HH:MM)
- Lint przechodzi: `npm run lint` (jeśli skonfigurowany w backendzie)

#### Manual Verification:
- `GET /api/weddings/:id/timeline` na świeżym weselu zwraca syntetyczny pusty obiekt BEZ tworzenia wiersza; wiersz powstaje dopiero po pierwszym `PATCH` — sprawdzone curl-em/Postmanem
- `POST /events/seed-template` dwukrotnie nie tworzy duplikatów
- 51. utwór must-play zwraca 400 z czytelnym komunikatem

**Implementation Note**: Zatrzymaj się po automatycznej weryfikacji i poproś o potwierdzenie ręcznego testu.

---

## Phase 3: Frontend — serwis, strona, nawigacja, reuse danych

### Overview
`TimelineService` (signal-cache), strona `harmonogram` z sekcjami i sub-komponentami, wpięcie do
nawigacji i route'ingu, reuse danych z istniejących serwisów; round-trip do `01-overview.md` i `STATUS.md`.

### Changes Required:

#### 1. Serwis
**File**: `wedding-planner/frontend/src/app/core/services/timeline.service.ts`
**Intent**: Klient HTTP + cache sygnałowy całego harmonogramu, wzorowany na `tasks.service.ts`.
**Contract**: typy `Timeline`, `TimelineEvent`, `TimelineSong` (+ DTO); `load(weddingId)` →
pełny obiekt do sygnału; `patchFields(weddingId, patch)`; `addEvent/updateEvent/removeEvent`,
`seedTemplate(weddingId)`; `addSong/updateSong/removeSong` (z rozróżnieniem `kind`). Każda metoda
zwraca Observable i aktualizuje sygnał przez `tap()`.

#### 2. Strona harmonogramu + sub-komponenty
**File**: `wedding-planner/frontend/src/app/pages/harmonogram/harmonogram.page.{ts,html,scss}` (+ sub-komponenty)
**Intent**: Jedna strona standalone OnPush z sekcjami ankiety; zapis per sekcja, wszystkie pola opcjonalne.
**Contract**: Sekcje odwzorowujące ankietę: Logistyka (pyt. 1–11), Dane kontaktowe (manager+tel,
świadkowie, rodzice), Przebieg dnia (lista zdarzeń), Pierwszy taniec, Podziękowania dla rodziców,
Tort, Preferencje muzyczne (chipy 10 kategorii + muzyka per etap), Listy utworów (must/do-not).
Sub-komponenty: lista zdarzeń (dodaj/usuń + zmiana kolejności przyciskami ↑/↓ zamieniającymi
`sort_order` przez PATCH — **bez drag-and-drop**, klawiaturowo dostępne z definicji, zgodnie z
wymogiem a11y w CLAUDE.md; lista jest krótka ~14 wierszy + przycisk „Wczytaj szablon DJ-a" w
pustym stanie), listy utworów (wiersze tytuł+wykonawca, licznik must-play do 50), chipy gatunków
(multi-select stałych 10 kategorii). Każda sekcja ma własny przycisk zapisu → `patchFields`/CRUD.
Współdzielone UI `PageHeader`/`Icon`/`EmptyState`; tokeny z `_tokens.scss`, brak hardkodów kolorów;
całość po polsku, daty `DD.MM.YYYY` gdzie dotyczy.

#### 3. Reuse danych wesela (read-only prefill)
**Intent**: Pokazać dane już znane (imiona pary, miejsce ceremonii, liczba gości, DJ/sala) bez
ponownego zbierania i bez override.
**Contract**: Strona czyta `WeddingService.wedding()` (imiona, `ceremonyLocation`), liczbę gości z
guests/aggregates oraz DJ/salę z vendors; renderuje je jako read-only nagłówek/kontekst. Źródłem
prawdy pozostają istniejące encje — harmonogram ich nie zapisuje.

#### 4. Route + nawigacja
**File**: `app.routes.ts`, `app-sidebar.ts`, `mobile-bottom-nav.ts`
**Intent**: Dodać trasę `/app/harmonogram` i pozycje nawigacyjne (desktop + mobile).
**Contract**: lazy `loadComponent` dla `HarmonogramPage` w dzieciach `/app`; wpis `{ label: 'Harmonogram',
routerLink: '/app/harmonogram', icon: 'calendar-days', disabled: false }` w obu listach nawigacji.
`IconName` jest zamkniętym unionem (~24 nazwy) — **bez ikony zegara/muzyki**; użyj istniejącego
`calendar-days` (a nie nowego glyphu). Przycisk eksportu w Fazie 4 użyje istniejącego `printer`.

#### 5. Round-trip do dokumentacji zakresu i statusu
**File**: `docs/demo-app/01-overview.md`, `STATUS.md`
**Intent**: Dopisać „Harmonogram" do listy stron (zakres) i odnotować postęp modułu.
**Contract**: Pozycja strony w `01-overview.md`; wpis w `STATUS.md` o nowej zakładce i jej stanie.

### Success Criteria:

#### Automated Verification:
- Front buduje się: `npm run build` (w `wedding-planner/frontend`)
- Testy jednostkowe frontu przechodzą: `npm test` (jeśli dotyczą zmienianych obszarów)
- Typecheck/lint przechodzą: `npm run lint`

#### Manual Verification:
- „Harmonogram" widoczny w sidebarze i mobile-nav, trasa `/app/harmonogram` działa
- Zapis pojedynczej sekcji utrwala dane po odświeżeniu strony
- Lista zdarzeń: szablon DJ-a wczytuje się w pustym stanie, można dodać/usunąć/przesunąć wiersz
- Must-play blokuje 51. wiersz z komunikatem; dane już znane (imiona/miejsce/liczba gości/DJ) są
  pokazane read-only i nie da się ich tu nadpisać
- UI po polsku, kolory z tokenów (brak hardkodów)

**Implementation Note**: Zatrzymaj się po automatycznej weryfikacji i poproś o potwierdzenie ręcznego testu.

---

## Phase 4: Eksport „Wersja dla DJ-a" (druk / PDF)

### Overview
Czytelny, chrome-less widok całej ankiety do druku/zapisu PDF z przeglądarki.

### Changes Required:

#### 1. Widok eksportu
**File**: `wedding-planner/frontend/src/app/pages/harmonogram/dj-export/dj-export.{ts,html,scss}`
oraz trasa w `app.routes.ts`
**Intent**: Sformatowany podgląd wszystkich sekcji harmonogramu (łącznie z danymi reużywanymi),
zoptymalizowany pod druk; bez nawigacji aplikacji.
**Contract**: Osobna trasa (np. `/app/harmonogram/dla-dj`) renderująca komponent poza app-shell
chrome (albo z ukryciem chrome przez `@media print`); sekcje w kolejności ankiety DJ-a; reguły
`@media print` (marginesy, brak elementów UI, czytelna typografia z tokenów serif/sans).

#### 2. Przycisk eksportu na stronie harmonogramu
**File**: `harmonogram.page.{ts,html}`
**Intent**: Wejście do eksportu i wywołanie druku.
**Contract**: Przycisk „Wersja dla DJ-a" otwierający widok eksportu; w widoku eksportu przycisk
„Drukuj / zapisz PDF" wywołujący `window.print()`.

### Success Criteria:

#### Automated Verification:
- Front buduje się: `npm run build`
- Lint/typecheck przechodzą: `npm run lint`

#### Manual Verification:
- „Wersja dla DJ-a" pokazuje wszystkie wypełnione sekcje + dane reużywane
- `window.print()` / podgląd wydruku daje czytelny dokument (zapis do PDF z przeglądarki działa)
- Brak elementów nawigacji/UI aplikacji na wydruku

**Implementation Note**: Po automatycznej weryfikacji poproś o ostateczne potwierdzenie ręcznego testu.

---

## Testing Strategy

### Unit Tests:
- Walidator HH:MM: poprawne i niepoprawne pory dnia (`24:00`, `12:60`, `9:5` → 400).
- Mappery: snake→camel, `genrePreferences`/`musicPerStage` jako array/obiekt.

### Integration Tests (`timeline-crud.test.js`):
- `GET /timeline` na świeżym weselu zwraca pusty obiekt bez tworzenia wiersza; lazy-create przy 1. `PATCH`.
- PATCH pól skalarnych + `requireAtLeastOne`.
- CRUD `events`; `seed-template` idempotentny (brak duplikatów przy 2× wywołaniu).
- CRUD `songs`; odrzucenie 51. must-play; brak limitu dla do-not.
- Odrzucenie dostępu do harmonogramu cudzego wesela (cross-wedding).

### Manual Testing Steps:
1. Wejdź w „Harmonogram", wczytaj szablon DJ-a, ustaw godziny, dodaj i usuń wiersz, zmień kolejność.
2. Zaznacz kilka gatunków, wpisz muzykę per etap, zapisz sekcję, odśwież — dane utrwalone.
3. Dodaj utwory must-play do limitu, sprawdź blokadę 51.
4. Otwórz „Wersję dla DJ-a", wydrukuj/zapisz PDF, sprawdź kompletność i brak chrome.

## Performance Considerations

Zakres danych jest mały (jeden harmonogram, kilkanaście zdarzeń, do ~50+kilka utworów na wesele),
więc bez specjalnych optymalizacji. Zapytania filtrowane po `wedding_id` z indeksem; brak globalnych
selectów bez filtra (zgodnie z konwencją repo).

## Migration Notes

Nowe tabele, brak migracji istniejących danych. `on delete cascade` na `wedding_id` zapewnia, że
hard-delete wesela (M9) usuwa też harmonogram. Eksport JSON wesela (M9) — jeśli ma obejmować
harmonogram, to osobna, późniejsza decyzja PO (poza zakresem tej zmiany).

## References

- Wzorzec route: `wedding-planner/backend/src/routes/tasks.js`, `routes/meetings.js`
- Mount + auth: `wedding-planner/backend/src/server.js:53-71`
- Mappery: `wedding-planner/backend/src/utils/mappers.js:339-366`
- Walidacja: `wedding-planner/backend/src/utils/request-validation.js`
- Serwis/strona front: `core/services/tasks.service.ts`, `pages/tasks/tasks.page.ts`
- Nawigacja: `shared/layout/app-sidebar/app-sidebar.ts:24-34`, `shared/layout/mobile-bottom-nav/mobile-bottom-nav.ts:20-30`
- RLS lockdown: migracja `20260524090000_rls_lockdown.sql`
- Scope/model: `docs/demo-app/01-overview.md`, `docs/demo-app/04-database.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Schemat bazy + migracja

#### Automated
- [x] 1.1 Migracja aplikuje się czysto (`npx supabase db push`)
- [x] 1.2 Liczba migracji na dysku zgadza się z `mcp list_migrations`
- [x] 1.3 Backendowy test suite nadal przechodzi (`npm test`)

#### Manual
- [x] 1.4 Trzy tabele z włączonym RLS widoczne w Supabase
- [x] 1.5 `get_advisors` bez nowych ostrzeżeń bezpieczeństwa

### Phase 2: Backend — route, mappery, walidacja, testy

#### Automated
- [ ] 2.1 Cały backendowy suite zielony (`npm test`)
- [ ] 2.2 `timeline-crud.test.js` przechodzi (CRUD + cross-wedding + limit 50 + HH:MM)
- [ ] 2.3 Lint przechodzi (`npm run lint`)

#### Manual
- [ ] 2.4 `GET /timeline` na świeżym weselu zwraca pusty obiekt bez zapisu; lazy-create dopiero przy 1. PATCH
- [ ] 2.5 `POST /events/seed-template` 2× nie tworzy duplikatów
- [ ] 2.6 51. utwór must-play → 400 z czytelnym komunikatem

### Phase 3: Frontend — serwis, strona, nawigacja, reuse danych

#### Automated
- [ ] 3.1 Front buduje się (`npm run build`)
- [ ] 3.2 Testy jednostkowe frontu przechodzą (`npm test`)
- [ ] 3.3 Typecheck/lint przechodzą (`npm run lint`)

#### Manual
- [ ] 3.4 „Harmonogram" w sidebarze i mobile-nav, trasa `/app/harmonogram` działa
- [ ] 3.5 Zapis sekcji utrwala dane po odświeżeniu
- [ ] 3.6 Lista zdarzeń: szablon DJ-a + dodaj/usuń/przesuń
- [ ] 3.7 Must-play blokuje 51.; dane reużywane read-only (brak override); UI po polsku, tokeny

### Phase 4: Eksport „Wersja dla DJ-a" (druk / PDF)

#### Automated
- [ ] 4.1 Front buduje się (`npm run build`)
- [ ] 4.2 Lint/typecheck przechodzą (`npm run lint`)

#### Manual
- [ ] 4.3 „Wersja dla DJ-a" pokazuje wszystkie sekcje + dane reużywane
- [ ] 4.4 `window.print()` daje czytelny PDF
- [ ] 4.5 Brak chrome aplikacji na wydruku
