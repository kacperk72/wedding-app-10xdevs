# Implementation Plan — Wedding Planner

> **TL;DR**: Plan przepisania prototypu Lovable na produkcyjną aplikację w aktualnym stosie: **Angular standalone + signals + SCSS** (frontend) + **Express + Supabase Postgres + zewnętrzne SSO/JWKS** (backend). Sekwencja: schema → integracja SSO + wesele → goście → kontrahenci+umowy → budżet → **catering konfigurator** → zadania → rozsadzenie → polish & ship. Każdy milestone produkuje działający, testowalny pionowy plaster.

Plan zakłada, że przeczytałeś już `01-overview.md`, `02-frontend.md`, `03-backend.md`, `04-database.md`. Tutaj skupiamy się **wyłącznie na sekwencji prac** — nie powtarzamy zawartości tamtych dokumentów.

---

## Project setup (M0)

Cel: istniejący katalog `wedding-planner/` buduje frontend i backend, a backend ma połączenie z Supabase oraz SSO JWKS.

- [x] Frontend scaffold: `wedding-planner/frontend` — Angular standalone + SCSS.
- [x] Backend scaffold: `wedding-planner/backend` — Express.
- [ ] Konfiguracja Prettier (100 chars, single quotes — zgodnie z konwencją repo) + ESLint w obu apkach
- [ ] Tailwind opcjonalnie — *jeśli preferujesz utility classes*; w przeciwnym razie tokeny do SCSS variables (zalecam SCSS, bo `CLAUDE.md` mówi "SCSS scoped")
- [x] Backend: `dotenv`, helmet, CORS allowlist, JSON body parser.
- [x] Backend: Supabase service-role client w `src/config/database.js`.
- [x] Backend: JWKS auth middleware w `src/middleware/jwks-auth.js`.
- [ ] Frontend: `provideRouter`, `provideHttpClient(withInterceptors([authInterceptor]))`, `provideAnimations`
- [ ] Wspólne DTO / typy można dodać później, jeśli backend i frontend zaczną duplikować kontrakty.
- [x] Supabase project: `SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY` w `.env` (gitignored, `.env.example` jako template).
- [ ] CI: lint + typecheck + test na push (rekomenduję GitHub Actions, ale zostaw to elastyczne)
- [x] Setup design tokens w `wedding-planner/frontend/src/styles/_tokens.scss`.

**Done when**: frontend działa na `:4200`, backend na `:3000`/`:3001`, `/api/health` zwraca status procesu i reachability Supabase.

---

## Database (M1)

Cel: schema zaaplikowana do Supabase, seed globalny i atomiczny bootstrap nowego wesela.

- [x] Narzędzie migracyjne: Supabase SQL migrations w `wedding-planner/backend/supabase/migrations`.
- [x] Migracja M1 `20260523233000_m1_schema_and_seed.sql` — DDL 25 tabel, indeksy, triggery i funkcje.
- [x] PG function `bootstrap_wedding(p_wedding_id, p_creator_user_id)` — seeduje `wedding_members`, 15 `budget_categories`, 12 stołów i auto-zadania.
- [x] PG function `create_wedding_with_bootstrap(...)` — atomowo tworzy wesele i odpala bootstrap.
- [x] Seed `task_templates` w migracji + `npm run db:seed` jako idempotentny upsert.
- [x] Migracje wykonane na zdalnym projekcie przez `npx supabase link` + `npx supabase db push` (z `wedding-planner/backend/`).
- [x] RLS lockdown jako osobna migracja `20260524090000_rls_lockdown` — RLS deny-all na wszystkich 25 tabelach `public`, `search_path` zapinane na 8 funkcjach. Backend (service_role) omija RLS; `anon`/`authenticated` bez polityk = każdy ich request to 0 wierszy.
- [x] Lockdown SECURITY DEFINER RPCs — migracja `20260524093000_revoke_security_definer_from_public` (revoke EXECUTE od PUBLIC na `bootstrap_wedding` i `create_wedding_with_bootstrap`). Tylko `service_role` może je wywołać.
- [x] `supabase get_advisors` (security): 0 ERROR, 1 zaakceptowany WARN (`citext` w `public` — przeniesienie wymaga drop'a `users.email`).
- [ ] Seed dev danych domenowych: 1 user SSO-mapowany przez `sso_user_id`, 1 wesele "Weronika & Kacper" 25.07.2026, goście, meal_options, kontrahenci, umowy, stoły, konflikty, spotkania.

**Done when**: świeża baza Supabase po migracji ma schemat M1, `task_templates`, a `POST /api/weddings` tworzy wesele z kategoriami budżetu, stołami i auto-zadaniami.

---

## SSO integration & Wedding bootstrap (M2)

Cel: zalogować się przez SSO, zmapować użytkownika SSO do lokalnego `users`, utworzyć wesele i zaprosić partnera.

### Backend (zamknięte)

- [x] `jwks-auth.js`: weryfikuje `Authorization: Bearer <token>` przez `JWKS_URL`; backend nie zna haseł.
- [x] `ensureUserFromSsoPayload()`: upsert do `users` po `sso_user_id`; lokalne `users.id` jest FK dla `wedding_members`.
- [x] `GET /api/me`: bieżący user, `weddingId`, `weddingMembership` (rola + linkedAt), partner z `linkStatus`.
- [x] `POST /api/weddings`: wywołuje PG RPC `create_wedding_with_bootstrap`; zwraca status/error jako jsonb (migracja `20260524123000`), Express mapuje `data.error` na `ConflictError`/`BadRequestError`.
- [x] `GET /api/weddings/:id`: chroniony przez `requireWeddingMember({paramName:'id'})`, zwraca wesele + members.
- [x] `PATCH /api/weddings/:id`: pod tym samym guardem, partial update przez `buildWeddingPatch`.
- [x] **Membership guard** `middleware/wedding-member.js` — factory `requireWeddingMember({paramName})`, lazy `getCurrentUser`, ustawia `req.currentUser` i `req.weddingMembership`. Stosowany przez `router.use(...)` na poziomie nested router (`guests`, `meal-options`, `tables`).
- [x] `POST /api/weddings/:id/invite-partner` — generuje 32-byte hex token, TTL 7 dni (stała `INVITE_TTL_MS`), upsert na `(wedding_id, email)` jeśli poprzednia invite jest `pending`/`expired` (`accepted`/`declined` → 409). Rate limit 5/min. MVP: link logowany do konsoli.
- [x] `POST /api/weddings/accept-invite` — wywołuje atomową PG RPC `accept_partner_invite(p_token, p_user_id)` (migracja `20260524120000`), `SELECT FOR UPDATE` na invitation + `unique_violation` handler na `wedding_members.user_id`. Rate limit 10/min.

### Frontend

- [ ] Integracja SDK SSO: redirect do `kubitksso.pl/login`, exchange kodu na token, logout przez SSO.
- [ ] `AuthService`: signal `user`, metody `loginWithSso()`, `logout()`, `me()`.
- [ ] HTTP interceptor: dorzuca `Authorization: Bearer …`; przy 401 wyloguj/ponów flow SSO zgodnie z SDK.
- [ ] `LoginPage` — split-screen layout zgodny z prototypem (`screenshots/desktop/01-login.png`)
- [ ] `RegisterPage` — tylko jeśli SSO wystawia osobny flow rejestracji; nie implementować haseł w wedding-plannerze.
- [ ] `AcceptInvitePage` — `/accept-invite?token=…` — potwierdza token zaproszenia; jeśli user nie ma sesji SSO, przekierowuje do SSO login/register.
- [ ] `WeddingSetupWizard` — pokazywany po loginie, gdy user nie ma `weddingId` (pola z `Ustawienia > Profil pary`)
- [ ] `authGuard` (route guard): jeśli brak usera → redirect `/`; jeśli user bez wesela → redirect `/setup`
- [ ] `AppShell` z `AppSidebar` + `AppHeader` (oba czytają z `WeddingService` i `AuthService`)
- [ ] `MobileBottomNav` (variant pod `<768px`)

**Done when**:
- Mogę zalogować się przez SSO, wejść do wedding-plannera, utworzyć wesele i zobaczyć Dashboard z licznikiem dni.
- W Supabase powstają `users`, `weddings`, `wedding_members`, budżet startowy, stoły i auto-zadania.
- Mogę zaprosić partnera mailem (na MVP — sprawdzam logi); po zalogowaniu przez SSO wpada do tego samego wesela.

---

## Goście / RSVP (M3) — zamknięty end-to-end

Cel: pełny CRUD na gościach + agregaty + filtry.

### Backend (zamknięte)
- [x] `routes/guests.js` jako nested router pod `/api/weddings/:weddingId/guests` (mergeParams + `router.use(requireWeddingMember())`).
- [x] Walidacja przez helpery z `utils/request-validation.js` zamiast DTO klas: `requireString`/`optionalEnum`/`optionalBoolean`/`optionalDateString` + `enumValue` na `relation`.
- [x] Endpointy: list z filtrami (`rsvp`/`diet`/`relation`/`search`) i sortowaniem (`sort=firstName|lastName`, `direction=asc|desc`), POST/PATCH/DELETE. Defaults: `rsvpStatus='pending'`, `diet='pending'`, `isChild=false`, `hasPlusOne=false`.
- [x] `GET /aggregates` jako PG RPC `guest_aggregates(p_wedding_id)` — `count(*) filter (where ...)` zwracający 7 KPI (`invited`, `confirmed`, `pending`, `declined`, `vegeOrVegan`, `children`, `noMealPick`). Migracja `20260524190000_guest_aggregates_rpc.sql`. Express endpoint `router.get('/aggregates', ...)` zarejestrowany **przed** routami parametrycznymi.
- [x] `routes/meal-options.js` jako nested router pod `/api/weddings/:weddingId/meal-options` — CRUD.
- [x] **Bonus z M8 wcześniej**: `routes/tables.js` pod `/api/weddings/:weddingId/tables` — CRUD z walidacją `seatsCount 1..24`. Potrzebne do edytora gościa (dropdown `tableId`).
- [x] Cross-wedding FK guard: helper `assertWeddingRecordExists(table, id, weddingId, label)` — gwarantuje, że `mealOptionId`/`tableId` należą do tego samego wesela.
- [x] Test infrastructure: `test/helpers/mock-supabase.js` (in-memory QueryBuilder + mock RPC `accept_partner_invite`) + `test/helpers/http-app.js` (`createTestServer({seed})` + `request()`). Reuse'owalne dla M4+.

### Frontend (zamknięte)
- [x] `GuestsService`: signal `guests`, computed `aggregates` (z fallbackiem klient-side gdy serwerowych jeszcze nie ma), `filteredGuests`, `loadAggregates(weddingId)` wywoływane przez Dashboard. Server-aggregates invalidowane po każdej mutacji (create/update/remove).
- [x] `MealOptionsService` + `TablesService`: list/create/update/remove na właściwych ścieżkach scoped.
- [x] `GuestsPage`: konsumuje `GuestsService` (zero local mock'ów). Pasek agregatów, search input, filtry, grupowanie per relacja.
- [x] Modal dodawania gościa — 4 pola (zgodnie z Resolved decisions).
- [x] Inline edit / row actions dla rsvp/diet/table assignment.
- [x] `SettingsPage` z sekcjami "Menu na wesele" (MealOptionsService) + "Stoły" (TablesService).

**Done when** (✅): dodaję 5 gości w różnych grupach, filtruję po dietach i statusach, agregaty pokazują się poprawnie. Dashboard countdown + KPI bar konsumuje `WeddingService.daysUntilWedding` + `GuestsService.aggregates`.

---

## Kontrahenci + Umowy + Płatności (M4) — zamknięty end-to-end

To jeden milestone, bo te trzy encje są ściśle zazębione i UI Umów konsumuje dane z Kontrahentów.

### Backend (zamknięte)
- [x] `routes/vendors.js` — CRUD + `GET /missing` (brakujące kategorie wg `status NOT IN ('zarezerwowany','zaplacony','wykonany')`); 10 kategorii (`sala`/`catering`/`fotograf`/`dj`/`kwiaciarz`/`usc`/`ksiadz`/`makijaz`/`dekoracje`/`tort`), 5 statusów (`rozwazany`/`spotkanie`/`zarezerwowany`/`zaplacony`/`wykonany`).
- [x] `routes/contracts.js` — CRUD + `GET /upcoming-payments` (płatności w 30 dni, `status='planned'`); list zwraca contract'y z zagnieżdżonym `vendor` + `payments` z poprawnymi filtrami `.in("contract_id", ids)` (perf-correct, nie pulluje globalnie).
- [x] `routes/payments.js` — nested pod `contracts/:contractId/payments`; `assertContractBelongsToWedding` na każdej mutacji.
- [x] **`syncContractStatus(contractId)` w `payments.js`** — po każdej mutacji payment'a przelicza i ustawia `contracts.status`: `pending` jeśli brak payment'ów, `paid_in_full` jeśli wszystkie `paid`, `deposit_paid` jeśli `zaliczka paid`, inaczej `in_progress`. Działa w obrębie pojedynczej requesty Express'a (nie trigger DB — łatwiejsze testy, mniej ukrytej magii).
- [x] **Security hardening**: migracja `20260524193000_revoke_rpc_execute_from_client_roles.sql` — `revoke execute ... from anon, authenticated` na wszystkich 4 SECURITY DEFINER RPCs. Bez tego Supabase auto-grant'uje `EXECUTE` dla client roles, a `revoke from public` nie tyka explicit-grantów. Lekcja: zawsze `revoke from anon, authenticated` oprócz `revoke from public`.
- [x] Pokrycie testowe: vendors CRUD (happy + cross-wedding rejection + `/missing`), contracts CRUD z payment lifecycle (POST zaliczka → status `deposit_paid`, POST rata final → `paid_in_full`), `GET /upcoming-payments` smoke. **36 testów / 11 suites, all green.**

### Frontend (zamknięte)
- [x] `VendorsService`, `ContractsService`, `PaymentsService` — wszystkie z signalami, ten sam wzorzec co `GuestsService`.
- [x] `vendors.page.ts` — konsumuje `VendorsService` (list + missing), `wedding.wedding()?.id` ze `WeddingService`, alert braków, dialog dodawania, edit/delete.
- [x] `contracts.page.ts` — konsumuje `ContractsService` + `VendorsService` (dropdown vendor) + `PaymentsService` (CRUD nested), `upcoming-payments` na górze.
- [x] Dashboard pokazuje countdown + KPI gości; resztę KPI (budżet, kontrahenci do działania) zostawione na M5/M9.

**Done when** (✅): dodaję kontrahenta, dodaję dla niego umowę z 3 ratami, zaliczka oznaczona jako paid → status kontraktu zmienia się na `deposit_paid` (sprawdzone testem), tabela "Nadchodzące płatności" pokazuje raty z dziś + 30 dni.

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
- [ ] Responsive QA: ręczny przegląd na 1440 / 1024 / 768 / 375 (porównaj ze screenshotami w `docs/demo-app/screenshots/`)
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
