# Implementation Plan — Wedding Planner

> **TL;DR**: Plan przepisania prototypu Lovable na produkcyjną aplikację w stosie zgodnym z `CLAUDE.md`: **Angular 20+ standalone + signals + SCSS** (frontend) + **NestJS + PostgreSQL/Supabase + JWT** (backend). Sekwencja: schema → auth → wesele → goście → kontrahenci+umowy → budżet → **catering konfigurator** → zadania → rozsadzenie → polish & ship. Każdy milestone produkuje działający, testowalny pionowy plaster.

Plan zakłada, że przeczytałeś już `01-overview.md`, `02-frontend.md`, `03-backend.md`, `04-database.md`. Tutaj skupiamy się **wyłącznie na sekwencji prac** — nie powtarzamy zawartości tamtych dokumentów.

---

## Project setup (M0)

Cel: monorepo, które się buduje i `npm run dev` startuje obie aplikacje.

- [ ] Zainicjuj monorepo (rekomenduję pnpm workspace):
  - `apps/frontend` — Angular 20+
  - `apps/backend` — NestJS
  - `packages/shared-types` — DTO i enumy używane po obu stronach
- [ ] Frontend scaffold: `ng new apps/frontend --standalone --style=scss --routing --strict`
- [ ] Backend scaffold: `nest new apps/backend --strict --package-manager pnpm`
- [ ] Konfiguracja Prettier (100 chars, single quotes — zgodnie z konwencją repo) + ESLint w obu apkach
- [ ] Tailwind opcjonalnie — *jeśli preferujesz utility classes*; w przeciwnym razie tokeny do SCSS variables (zalecam SCSS, bo `CLAUDE.md` mówi "SCSS scoped")
- [ ] Backend: globalny `ValidationPipe({ whitelist: true, transform: true })`, `@nestjs/config` z `.env`/`.env.example`, helmet, CORS allowlist
- [ ] Frontend: `provideRouter`, `provideHttpClient(withInterceptors([authInterceptor]))`, `provideAnimations`
- [ ] Wspólne DTO w `packages/shared-types` (`Guest`, `Vendor`, `Contract`, …) z enumami z `04-database.md`
- [ ] Docker compose: `postgres:15` + `pgadmin` (lub link do projektu Supabase, jeśli idziemy w Supabase od razu)
- [ ] CI: lint + typecheck + test na push (rekomenduję GitHub Actions, ale zostaw to elastyczne)
- [ ] Setup design tokens: kolory (zielony akcent, kremowe tło, pastele do badge'ów), typografia (szeryfowy heading + sans-serif body), `rounded-2xl`, cienie. Wsadź jako CSS custom properties w `apps/frontend/src/styles/_tokens.scss`.

**Done when**: `pnpm dev` startuje frontend na `:4200` i backend na `:3000`; frontend uderza w `/api/health` i dostaje `200 OK`.

---

## Database (M1)

Cel: schema zaaplikowana do bazy, RLS w miejscu, seed dla dev.

- [ ] Wybierz narzędzie migracyjne i nie zmieniaj go: **Supabase migrations** (jeśli idziemy Supabase) **albo TypeORM migrations** (jeśli own Postgres)
- [ ] Migracja `0001_init.sql` — **cały DDL z `04-database.md` § Full DDL** w kolejności sekcji 1-12 (FK spinają się tylko w tym porządku; szczególnie: `tables` przed `guests`, `meal_options` przed `guests`, `vendors` przed `expenses` i `catering_offers`, `catering_offers` → `catering_packages` → `catering_courses` → `catering_dishes` → junctions → `wedding_catering_selection` → picks → ALTER `contracts`)
- [ ] Migracja `0002_triggers.sql` — `set_updated_at()` + 18 triggerów `tg_*_updated_at` (w tym 6 dla cateringu), `shift_auto_tasks_on_wedding_date_change()` + trigger, `enforce_seating_conflict_wedding_match()` + trigger, `enforce_catering_pick_consistency()` + trigger, `enforce_catering_course_dish_same_offer()` + trigger
- [ ] Migracja `0003_rls.sql` — `ENABLE RLS` + policies dla każdej tabeli z `wedding_id` (w tym `catering_offers`, `wedding_catering_selection`). Specjalna polityka dla `weddings` (delete tylko przez `created_by_user_id`). Policy z join'em dla `payments` (przez `contracts`) i tabel cateringu bez `wedding_id` (przez offer/selection).
- [ ] PG function `bootstrap_wedding(wedding_id uuid, creator_user_id uuid)` — atomowy seed po `INSERT INTO weddings`: wstawia `wedding_members` (creator jako `partner_a`), 15 `budget_categories`, materializuje tasks z `task_templates`. Wywoływane z backendu lub jako trigger AFTER INSERT.
- [ ] Seed `task_templates` (~25 wpisów z prototypu — patrz `screenshots/desktop/07-zadania.png`, lista zadań po prawej z badge'em `auto`; `days_before_wedding` wyciągnij ręcznie z dat względem 25.07.2026)
- [ ] Skrypt `seed-dev.ts`: 1 user (`anna@wesele.pl`/`password123`) jako founder, 1 wesele "Weronika & Kacper" 25.07.2026, 50 gości w 6 grupach (kilka z `diet='pending'`, kilka z konkretnym `meal_option_id`), 5 `meal_options` ("Schab tradycyjny"/"Łosoś z koprem"/"Wegański"/"Bezglutenowy"/"Dziecięce"), 10 kontrahentów (część "rozważany"), 8 umów z ratami, ~25 zadań (część `is_auto=true`), 12 stołów, 3 konflikty, 4 spotkania (DJ/catering/atelier/dekorator)
- [ ] Sanity check: odpal `psql` + jeden query na każdą tabelę; sprawdź że RLS faktycznie blokuje dostęp do danych innego wesela (zaloguj się jako 2. user)

**Done when**: świeży git clone + 1 komenda (`pnpm db:reset`) i masz działającą bazę z mockami dokładnie odzwierciedlającymi wygląd prototypu.

---

## Auth & Wedding bootstrap (M2)

Cel: zarejestrować się, zalogować, utworzyć wesele, zaprosić partnera.

### Backend

- [ ] `AuthModule`: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout`
- [ ] Hashowanie haseł: `argon2` (preferowane) lub `bcrypt` z work factor 12+
- [ ] `JwtStrategy`: access token 15 min, refresh 7 dni z rotacją (zapisywany jako hash w `refresh_tokens(user_id, token_hash, expires_at, revoked_at)`)
- [ ] `JwtAuthGuard` jako global default; endpointy publiczne oznaczane `@Public()`
- [ ] `@CurrentUser()` decorator wyciągający `user` z requestu
- [ ] `WeddingMemberGuard` — sprawdza, czy `req.user.id` jest w `wedding_members(wedding_id = req.params.weddingId)`. Aplikuj na controllery `weddings/:weddingId/*`
- [ ] `WeddingsModule`: `POST /api/weddings` (tworzy wesele + wstawia bieżącego usera jako `partner_a` + seeduje budget categories), `GET /api/weddings/:id`, `PATCH /api/weddings/:id`
- [ ] `POST /api/weddings/:id/invite-partner` — generuje token, zapisuje `partner_invitations`, wysyła e-mail (na MVP: log do konsoli; produkcja: Resend/Postmark)
- [ ] `POST /api/auth/accept-invite` — endpoint publiczny, tworzy nowego usera + wstawia jako `partner_b` + invaliduje token
- [ ] `GET /api/me` — bieżący user z `weddingId` i `partner` (joinem przez `wedding_members`)

### Frontend

- [ ] `AuthService`: signal `user`, metody `login()`, `register()`, `logout()`, `refresh()`, `me()`
- [ ] HTTP interceptor: dorzuca `Authorization: Bearer …`; przy 401 próbuje 1x refresh i retry; przy drugim 401 wyloguj
- [ ] `LoginPage` — split-screen layout zgodny z prototypem (`screenshots/desktop/01-login.png`)
- [ ] `RegisterPage` — analogicznie
- [ ] `AcceptInvitePage` — `/accept-invite?token=…` — formularz z imieniem, nazwiskiem, hasłem
- [ ] `WeddingSetupWizard` — pokazywany po loginie, gdy user nie ma `weddingId` (pola z `Ustawienia > Profil pary`)
- [ ] `authGuard` (route guard): jeśli brak usera → redirect `/`; jeśli user bez wesela → redirect `/setup`
- [ ] `AppShell` z `AppSidebar` + `AppHeader` (oba czytają z `WeddingService` i `AuthService`)
- [ ] `MobileBottomNav` (variant pod `<768px`)

**Done when**:
- Mogę się zarejestrować, zalogować, zobaczyć pusty Dashboard z licznikiem dni do mojej daty ślubu
- Mogę zaprosić partnera mailem (na MVP — sprawdzam logi); on klika link, ustawia hasło, wpada do tego samego wesela
- Refreshing pages utrzymuje sesję; wylogowanie czyści

---

## Goście / RSVP (M3)

Cel: pełny CRUD na gościach + agregaty + filtry.

### Backend
- [ ] `GuestsModule` z controllerem pod `weddings/:weddingId/guests`
- [ ] DTO: `CreateGuestDto` (4 pola: firstName/lastName/relation/diet), `UpdateGuestDto` (wszystkie pola opcjonalne, w tym `mealOptionId`, `tableId`, `isChild`, `hasPlusOne`)
- [ ] Service: list (z filterami i `search`), get one, create (defaults: `rsvpStatus='pending'`, `diet='pending'` jeśli nie podane, `isChild=false`, `hasPlusOne=false`), update, delete
- [ ] `GET /aggregates` — pojedynczy SQL z `COUNT(*) FILTER (WHERE …)`; mapowanie pól patrz `03-backend.md` § Guests
- [ ] `MealOptionsModule` (paralelnie): CRUD pod `weddings/:weddingId/meal-options`
- [ ] Test: happy path tworzenia gościa + pobrania agregatu + walidacja `meal_option_id` należy do tego samego wesela

### Frontend
- [ ] `GuestsService`: signal `guests`, computed `aggregates`, `filteredGuests` (wg search/filters)
- [ ] `MealOptionsService`: signal `mealOptions` (cache, używany w dropdown na ekranie edycji gościa)
- [ ] `GuestsPage`: pasek agregatów (sticky), search input, 3 dropdowny filtrów, sekcje per relacja z tabelami
- [ ] `AddGuestDialog` z formularzem (Reactive Forms) — **tylko 4 pola**: Imię/Nazwisko/Relacja/Dieta (zgodnie ze screenshotem `10-modal-dodaj-goscia.png`); inne pola edytowalne na dedykowanym ekranie szczegółów
- [ ] `EditGuestDialog` (lub `GuestDetailsPage`) — pełny edytor: wszystkie pola w tym `mealOptionId` (dropdown z `meal_options`), `isChild`, `hasPlusOne`, `tableId`, kontakt
- [ ] `RsvpBadge`, `DietBadge` (reużywalne); `MealBadge` opcjonalne
- [ ] Empty state gdy 0 gości po filtrze

**Done when**: dodaję 5 gości w różnych grupach, filtruję po dietach i statusach, agregaty pokazują się poprawnie.

---

## Kontrahenci + Umowy + Płatności (M4)

To jeden milestone, bo te trzy encje są ściśle zazębione i UI Umów konsumuje dane z Kontrahentów.

### Backend
- [ ] `VendorsModule` — CRUD + `GET /missing` (brakujące kategorie wg `status NOT IN ('zarezerwowany','zaplacony','wykonany')`)
- [ ] `ContractsModule` — CRUD + nested `payments` resource + `GET /upcoming-payments` (płatności w 30 dni) + `GET /:id` z włączonymi paymentami (lewy join z agregatem `paidCount/totalCount`)
- [ ] Logika statusu kontraktu: derived (`'paid_in_full'` jeśli wszystkie payments paid, `'deposit_paid'` jeśli zaliczka paid, ...) — albo trigger w bazie albo computed w API
- [ ] Logika statusu płatności `overdue`: cron raz dziennie ustawiający `status='overdue'` na `due_date < today AND status='planned'`. Albo: wyliczać on-the-fly w SELECT.

### Frontend
- [ ] `VendorsService`, `ContractsService` z signalami
- [ ] `VendorsPage`: alert braków, chips filtrów, grid 3-kolumnowy `VendorCard` + `VendorAddCard`
- [ ] `AddVendorDialog` (formularz wg `02-frontend.md` § Inferowane formularze)
- [ ] `VendorEditDialog` — wieloodrębne pole z notatkami, wybór statusu
- [ ] `ContractsPage`: karta `UpcomingPaymentsCard` u góry + tabela wszystkich umów z `PaymentDots`
- [ ] `AddContractDialog` z polem dynamicznym "harmonogram" (lista wierszy: `kind`, `dueDate`, `amount`)
- [ ] `EditPaymentDialog`: zmiana statusu (planned → paid + paid_at), zmiana kwoty/terminu

**Done when**:
- Dodaję kontrahenta, dodaję dla niego umowę z 3 ratami
- Zaliczka oznaczona jako paid → status kontraktu zmienia się na `deposit_paid`
- Tabela "Nadchodzące płatności" pokazuje raty z dziś + 30 dni z prawidłowym `daysUntilDue` i kolorowymi badgeami

---

## Budżet (M5)

Cel: 3 KPI, 15 kategorii, możliwość edycji planu i dodawania wydatków.

### Backend
- [ ] `BudgetModule`: `GET /summary` (3 wyliczane sumy), `GET /categories` (z `spent_amount` z aggregat na expenses), `GET /categories/:id/transactions`, `PATCH /categories/:id`, `POST /expenses`, `PATCH/DELETE /expenses/:id`
- [ ] `summary.reservedFromContracts` = suma `payments.amount` gdzie `status IN ('planned')` (czyli zarezerwowane ale jeszcze nieopłacone)
- [ ] `summary.spent` = suma `expenses.amount` + suma opłaconych `payments.amount`. **Decyzja**: czy płatności do kontrahentów liczą się jako `expenses` automatycznie? Jeśli tak — proste, ale wymaga upsert z paymentu. Jeśli nie — wydatki i płatności to osobne strumienie i `spent` to ich suma. Zalecam drugą opcję, prostsze i mapuje 1:1 z UI

### Frontend
- [ ] `BudgetService`: signals `summary`, `categories`, `transactionsByCategory` (lazy load)
- [ ] `BudgetPage` z `BudgetSummary` + lista `BudgetCategoryRow` z chevronem rozwijającym
- [ ] `AddExpenseDialog`: kategoria (combobox), data, opis, kwota
- [ ] `EditCategoryPlanDialog`: lista wszystkich kategorii z polami estymowanej kwoty (zapisuje hurtem)
- [ ] Pasek postępu z 4 kolorami (zielony/żółty/czerwony/szary) wg progu

**Done when**: dodaję wydatek "Pierścionek 4200 zł" do "Obrączki" → kategoria pokazuje 100% paska + KPI "wydane" rośnie o 4200; estymowana kwota końcowa zostaje (bo plan nie zmieniony).

---

## Catering konfigurator (M6)

Cel: para wprowadza ofertę swojej sali, wybiera pakiet, konfiguruje menu, zaznacza dodatki — i widzi cenę końcową, która zasila Budżet (M5).

### Backend

- [ ] `CateringOffersModule`: CRUD na `catering_offers` (`/api/weddings/:weddingId/catering/offers`)
- [ ] `CateringPackagesModule`: CRUD na `catering_packages`, `catering_courses`, `catering_dishes`, `catering_addons` (zagnieżdżone pod offer)
- [ ] `CateringSelectionModule`: PUT/PATCH na `wedding_catering_selection` + dish_picks + addon_picks; walidacja `count(picks) == course.choice_limit` per course
- [ ] `GET /catering/selection/price` — computed: `package.price × guest_count + Σ(addon.price × multiplier)`. Multiplier wg `pricing_unit`: per_person → guest_count, reszta → 1
- [ ] `POST /catering/selection/sync-meal-options` — idempotentny: dla każdego `course` z `selection_mode='guest_picks'` i wybranymi dish_picks → upsert do `meal_options`. Zwraca `{ created, updated, deleted }`
- [ ] `POST /catering/selection/freeze-into-contract` — tworzy `contracts` z `total_amount = computed_price`, ustawia `wedding_catering_selection_id`, generuje payments wg body
- [ ] Trigger PG `enforce_catering_pick_consistency` (z 04-database.md) i `enforce_catering_course_dish_same_offer` muszą być częścią migracji 0002_triggers.sql
- [ ] Aktualizacja `BudgetService.summary` — kwota z `wedding_catering_selection.total_price` (jeśli istnieje, a brak `contract` → wlicz do `reservedFromContracts`; jeśli `contract` istnieje, zwykła droga `reservedFromContracts` przez `payments`)

### Frontend

- [ ] `CateringService` z signalami: `offers`, `activeOffer`, `selection`, `priceBreakdown`, `mealOptionsInSync`
- [ ] `CateringPage` z 3 stanami (empty / list / configure)
- [ ] `OfferEditor` — modal/page z 4 zakładkami (Pakiety / Kategorie / Dania / Dodatki). Każda z bulk-import textareą i drag-handle do `sortOrder`
- [ ] `PackageTabs`, `PackagePriceCard` z stepperem `guestCountEstimate`
- [ ] `CourseSection` + `DishPickList` z 3 wariantami zachowania (`all_served` / `couple_picks` / `guest_picks`); licznik picks vs `choice_limit` z disabled state
- [ ] `DishCard` z ikonami diet (🌱/🌿/🌾) i tooltipem alergenów
- [ ] `AddonsList` z checkboxami i input quantity (gdzie sensowne)
- [ ] `PriceSummary` (sticky desktop / sticky-bottom mobile) z rozbiciem; przyciski "Synchronizuj z RSVP" + "Zamroź w umowie"
- [ ] `FreezeContractDialog` — vendor combobox (filter category in ['sala','catering']), signedDate, dynamiczna lista płatności
- [ ] Link w `AppSidebar`: "Oferta sali" — między Budżetem a Zadaniami
- [ ] Toast po `sync-meal-options`: "Utworzono N opcji dań do wyboru przez gości" + CTA "Zobacz w Goście"

### Seed dev

- [ ] Wgraj realną ofertę (Pałac Polanka 2026 z `docs/menu/*.pdf`) jako fixture do `seed-dev.ts`:
  - 1 oferta "Pałac Polanka 2026"
  - 4 pakiety (315/339/374/399 zł)
  - ~15 sekcji per pakiet (Obiad/Zupa, Obiad/Danie Główne, ..., Bufet Zimny "8 pozycji do wyboru", Sałatkowy "3 pozycje")
  - ~50 dań w bibliotece (z PDF; oznaczone flagami diety gdzie oczywiste — np. "Mini burrata" = vegetarian)
  - 7 dodatków (Pokrowce per_person, Korkowe per_bottle, Wiejski stół per_event, Słodki stół per_event, Napoje gazowane per_person, Przystawka per_person, Ciastkowe per_event)
  - Dla user-foundera: aktywne `wedding_catering_selection` z Pakietem Złotym, 100 gości, 8 picks bufetu zimnego, 3 picks sałatek, 1 pick zupy, 1 pick dania głównego

**Done when**:
- Wprowadzam ofertę z PDFa (lub używam zaseedowanej) → wybieram Pakiet Złoty, klikam 8 z 20 pozycji bufetu, zaznaczam Pokrowce + Wiejski stół.
- `PriceSummary` pokazuje "374 × 100 + 800 + 1500 = 39 100 zł".
- Klikam "Synchronizuj z RSVP" → przy edycji gościa pojawia się dropdown "Wybór dania głównego" z 3 opcjami.
- Klikam "Zamroź w umowie" → vendor "Pałac Pod Lipami" (kategoria sala), 4 płatności (zaliczka 10 000 + 3 raty po 9 700) → tworzy się `contracts` z linkiem do selection.
- W Budżecie (`/app/budzet`) kategoria "Sala weselna" pokazuje `+39 100 zł` w `reservedFromContracts`, KPI "Zarezerwowane (umowy)" rośnie.

---

## Zadania + auto-timeline (M7)

Cel: lista z 3 sekcjami (Opóźnione / W tym tygodniu / W przyszłości) + auto-generowanie z templates.

### Backend
- [ ] `TasksModule`: CRUD + `POST /regenerate-auto`
- [ ] `regenerate-auto` algorytm:
  1. Pobierz `weddings.wedding_date`
  2. Pobierz `task_templates`
  3. Dla każdego template'u: jeśli istnieje `tasks(wedding_id, template_id)` → zaktualizuj `due_date = wedding_date - days_before_wedding` (jeśli nie został zmodyfikowany ręcznie); jeśli nie istnieje → wstaw nowy
  4. Idempotentne — powtórne wywołanie nie tworzy duplikatów
- [ ] Po `POST /api/weddings` → automatycznie wywołaj `regenerate-auto` (raz, na utworzenie)
- [ ] Po `PATCH /api/weddings/:id` ze zmianą `wedding_date` → wywołaj z parametrem `force` (po potwierdzeniu na froncie)

### Frontend
- [ ] `TasksService`: signal `tasks`, computed `overdueTasks`, `thisWeekTasks`, `futureTasks`
- [ ] `TasksPage`: toggle Lista/Kalendarz, 3 sekcje (każda z `TaskGroupSection`)
- [ ] `TaskRow` z checkboxem (toggle `done`), data, badge kategorii, badge `auto`
- [ ] `AddTaskDialog`: tytuł, kategoria, deadline, opis
- [ ] `TasksCalendarView`: miesięczny grid (uznanie, jak wygodnie zaimplementować — `@angular/cdk` ma narzędzia, można też prostą bibliotekę)
- [ ] Confirm-dialog przy zmianie daty ślubu w Ustawieniach: "Czy przenieść też zadania auto?"

**Done when**: utworzenie wesela z datą `2026-07-25` automatycznie generuje 25+ auto-tasków rozłożonych w czasie. Zaznaczenie checkboxa migruje task'a z "Opóźnione" do "Zrobione" (lub usuwa z listy — decyzja UX).

---

## Rozsadzenie gości (M8)

Cel: drag-and-drop działa, konflikty są wykrywane.

### Backend
- [ ] `SeatingModule`: CRUD na `tables`, endpointy `assign/unassign`, CRUD na `seating_conflicts`, `GET /stats`
- [ ] `POST /tables/:id/assign`: walidacja — nie przekroczyć `seats_count`; opcjonalnie: ostrzeżenie gdy gość w konflikcie z kimś już przy stole (zwracaj `warnings: [...]` w response)

### Frontend
- [ ] `SeatingService`: signals `tables`, `unassignedGuests` (z `guests` filtered), `conflicts`, computed `stats`
- [ ] `SeatingPage` 3-kolumnowy layout
- [ ] Drag-and-drop: użyj `@angular/cdk/drag-drop` z `cdkDrag` na kartach gości i `cdkDropList` na każdym `RoundTable`
- [ ] `RoundTable` — wizualizacja okrągłego stołu z kółkami miejsc; zajęte miejsca pokazują inicjały gości (computed property na froncie)
- [ ] `ConflictsPanel`: lista z linią łączącą wizualnie pary (opcjonalne, można odpuścić w MVP)
- [ ] Walidacja w `cdkDropListEnterPredicate`: blokuj drop, gdy stół pełny; pokaż toast z ostrzeżeniem konfliktu (nie blokuj — para sama decyduje)
- [ ] Toolbar nad gridem: liczba stołów, miejsca per stół (input z hurtową aktualizacją), przycisk "Dodaj stół"
- [ ] Filter "tylko potwierdzeni" w lewej kolumnie

**Done when**: przeciągam gościa na pusty stół, miejsce zajmuje się, statystyka się aktualizuje. Próba przeciągnięcia kogoś, z kim jest konflikt, pokazuje ostrzeżenie ale pozwala dokończyć.

---

## Dashboard + Ustawienia + cross-cutting (M9)

Cel: domknięcie aplikacji.

### Dashboard

- [ ] `GET /api/weddings/:id/dashboard` — zbiorczy endpoint z `kpi`, `attentionItems`, `upcomingMeetings`
- [ ] `DashboardService`: jedno zapytanie, signal `dashboard`
- [ ] `DashboardPage`: hero counter, 4 `KpiCard` warianty, `AttentionList`, `UpcomingMeetings`
- [ ] Logika `attentionItems` w backendzie: opóźnione taski + brakujący kontrahenci + opóźnione/nadchodzące płatności (top 5 ważnych)
- [ ] Endpoint `meetings` minimalny CRUD jeśli nie istnieje (M4 nie pokrywa — można teraz albo dodać do M4 retrospektywnie)

### Ustawienia

- [ ] `SettingsPage` z 5 sekcjami: profil, **menu na wesele**, połączone konto, bezpieczeństwo, eksport
- [ ] `CoupleProfileForm` — `PATCH /api/weddings/:id`; przy zmianie daty otwórz dialog "Czy przesunąć zadania auto?". Trigger `tg_weddings_shift_auto_tasks` zrobi to atomowo na bazie; dialog jedynie wyświetla *konsekwencje* przed `PATCH`.
- [ ] **`MealOptionsCard` (nowy)** — lista `meal_options` per wesele, inline add/edit/delete + drag-handle do `sortOrder`. Zasila dropdown na ekranie edycji gościa (M3).
- [ ] `LinkedAccountCard` — pokazuje partnera (lub stan "Nie zaproszono"); przycisk "Wyślij zaproszenie ponownie" (jeśli `partner_invitations.status='pending'` lub `'expired'`); founder widzi dodatkowo przycisk "Usuń wesele" (`DELETE /api/weddings/:id`) z double-confirm
- [ ] `ChangePasswordForm` — `POST /api/auth/change-password`
- [ ] "Wyloguj ze wszystkich urządzeń" — `POST /api/auth/logout-all` (revoke all refresh tokens for user)
- [ ] "Pobierz JSON" — `GET /api/weddings/:id/export` zwraca pełny dump (z `Content-Disposition: attachment`); bez `password_hash` i `partner_invitations.token`

### Cross-cutting

- [ ] `ToastService` z signalem `toasts: Toast[]`; komponent `ToastContainer` na rooto layoutu
- [ ] HTTP interceptor mapujący błędy backendu na toasty
- [ ] Globalny `ErrorPage` (404 + 500)
- [ ] Loading skeletons na 3 najsłabsze listy: Goście, Umowy, Zadania
- [ ] Empty states z prompt-prototyp-ui (ikona + zdanie + CTA) dla: Gości, Kontrahentów, Zadań, Stołów

---

## Polish & ship (M10)

- [ ] Performance: lazy-load wszystkich routów (`loadComponent: () => import(...)`); analiza bundla (`source-map-explorer`); cel: initial bundle < 250KB gzip
- [ ] Accessibility pass: keyboard navigation w sidebarze, focus-trap w modalach, ARIA labels na ikonach (np. avatary), kontrast badge'ów na pastelach
- [ ] Responsive QA: ręczny przegląd na 1440 / 1024 / 768 / 375 (porównaj ze screenshotami w `docs/love-nest-co-lovable-app/screenshots/`)
- [ ] Security: helmet, rate limit auth (5/min/IP), CORS allowlist, HSTS, CSP nagłówki, sanityzacja inputów (czyste DTO + ValidationPipe wystarczy)
- [ ] Observability: structured logging (`pino`), Sentry albo równoważnik
- [ ] Migracje produkcyjne: skrypt deploy aplikujący migracje przed startem
- [ ] Smoke test w prod: przejście user flowsów z `01-overview.md` (login, dodaj gościa, zapłać ratę, rozsadź gościa, zmień datę ślubu)

---

## Resolved decisions (po przeglądzie screenów — iteracja 2)

Większość pytań produktowych z poprzedniej iteracji została domknięta sensownymi defaultami (patrz `04-database.md` § "Resolved decisions" dla szczegółów). Implementuj według nich; jeśli PO chce inaczej — zmień najpierw `04-database.md`, potem migrację, potem kod.

- ✅ **Meal options** → osobna tabela `meal_options` per-wesele + sekcja w Ustawieniach.
- ✅ **Auto-task regeneration** → trigger PG `tg_weddings_shift_auto_tasks` (ukończonych nie rusza, manualnych nie rusza) + endpoint force-mode.
- ✅ **Symetria partnerów** → CRUD symetryczne, hard-delete wesela tylko przez `created_by_user_id`.
- ✅ **Eksport JSON** → pełny dump bez secrets, oboje partnerzy mają dostęp.
- ✅ **Diet enum** → 5 wartości (`pending` jako default + 4 konkretne).
- ✅ **Conflict reasons** → free text.
- ✅ **Spotkania** vs zadania → niezależne encje, nie łączymy w MVP.
- ✅ **Hard-delete** wszędzie (no soft-delete w MVP).

## Otwarte pytania (do potwierdzenia z PO)

- [ ] **Skala** — limit gości per wesele? (default: setki/niskie tysiące; jeśli >2000 → cursor pagination).
- [ ] **Powiadomienia** — push/email przed deadline'm? Prototyp pokazuje tylko in-app. Rekomendacja: opóźnić do post-MVP.
- [ ] **Inline editing** w tabeli gości — UI sugeruje klikalne badge'e (RSVP/Dieta/Stół), ale prototyp nie wygląda na inline-editable. Decyzja UX: full inline vs. otwórz modal edycji. Implementacja PATCH/REST jest taka sama, różni się tylko interakcja w `02-frontend.md`.
- [ ] **Eksport JSON — szyfrowanie** — wersja "secure" z hasłem (param), default plain JSON.
- [ ] **Meeting → vendor cascade** — `ON DELETE SET NULL` (default) vs CASCADE (decyzja produktowa).

---

## Notes for the implementing agent

- **Source of truth = `04-database.md`**. Jeśli implementacja zmusza Cię do innej nazwy kolumny (reserved word, długość), zmień najpierw ten plik, potem migrację, potem kod. Nie zostawiaj rozjazdu.
- **Nie buduj feature'ów spoza `01-overview.md`** — RE wychwycił konkretną powierzchnię. Wszystko, czego nie ma na liście, to scope creep. Jeżeli widzisz lukę, dopisz pytanie na końcu `01-overview.md` zamiast się zgadywać.
- **Polski UI nie jest opcjonalny** — etykiety, statusy, mock-dane, formaty (`DD.MM.YYYY`, `12 500 zł`) muszą być po polsku od pierwszego commita. Łatwiej napisać po polsku niż później migrować enumy.
- **Estetyka**: zielony akcent `~#3F5C3A`, kremowe tło `~#FAF7EE`, szeryfowe headings (Cormorant/Playfair), sans-serif body (Inter/DM Sans), `rounded-2xl`, subtelne cienie. Trzymaj się tokenów ze `_tokens.scss`, nie hardkoduj kolorów.
- **Drag-and-drop bez fallbacku klawiaturowego = niedopuszczalne** w produkcji. `@angular/cdk` to wspiera; potraktuj poważnie.
- Gdy znajdziesz sprzeczność między dokumentacją a oryginałem — oryginał działa pod `https://love-nest-co.lovable.app/`, możesz tam wrócić. Zgłoś rozbieżność, nie zgaduj milcząco.
- **Każdy milestone musi działać end-to-end**, nie po stronie samego backendu. M3 oznacza "user widzi w UI dodanego gościa", nie "endpoint dodawania zwraca 201".
