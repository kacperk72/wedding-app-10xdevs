---
project: "Wedding Planner (Weronika & Kacper)"
version: 1
status: draft
created: 2026-05-28
updated: 2026-05-28
prd_version: 1
main_goal: market-feedback
top_blocker: none
---

# Roadmap: Wedding Planner (Weronika & Kacper)

> Wyprowadzona z `context/foundation/prd.md` (v1) + auto-zbadanego baseline'u kodu w `wedding-planner/` (frontend + backend, audyt 2026-05-28).
> Edytowalna w miejscu; archiwizowana gdy wyparta.
> Pozycje poniżej są w porządku zależności. Tabela "Na pierwszy rzut oka" jest indeksem.

## Vision recap

Para planująca polski ślub (Weronika & Kacper, ślub `2026-07-25`) dzieli dziś plan między arkusze gości, drugi arkusz na umowy i płatności, wątki czatu z odpowiedziami RSVP i papierowe notatki na timeline dnia ślubu. Aplikacja zamienia tę rozproszoną pracę w jedno źródło prawdy z rankowanym sygnałem priorytetu "co teraz wymaga uwagi" — komponowanym z czterech strumieni domenowych: zadań ślubnych liczonych wstecz od daty, harmonogramu płatności z umów, luki kompletności RSVP i przekroczeń budżetu per kategoria. Insight, na którym budujemy, to **eat-your-own-dogfood** (dwoje użytkowników jest jednocześnie twórcami produktu) — feature backlog jest sterowany tym, czego para realnie potrzebuje przed `2026-07-25`, nie założeniami o generycznym segmencie.

## North star

**S-01: Para zmienia datę ślubu w Ustawieniach, dostaje confirm dialog z dwiema opcjami (przesuń / wygeneruj od nowa), widzi automatycznie wygenerowaną lub przesuniętą listę zadań wstecz od nowej daty.** — to najmniejszy slice, którego dostarczenie domyka 4-strumieniową kompozycję "Wymaga uwagi" (dziś brakuje strumienia zadań-auto), czyli **wedge** produktu — ta jedna cecha, której usunięcie sprawia że wedding-planner staje się generycznym to-do listem zamiast "codziennego sygnału co teraz wymaga uwagi". Bez tego market-feedback jest półmartwy: para otwiera Dashboard po pracy i nie widzi rankowanej listy "co dziś zrobić" — widzi pusty placeholder, więc wraca do Excela.

> "North star" tutaj = najmniejszy end-to-end slice, który jeśli zadziała, dowodzi, że produkt jako całość spełnia swoją główną hipotezę. Wszystko inne (polerka rankingu, alt-view kalendarza, prod cutover) ma sens tylko jeśli ten slice działa.

## At a glance

| ID    | Change ID                          | Outcome (para może…)                                                                              | Prerequisites    | PRD refs               | Status   |
| ----- | ---------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------- | ---------------------- | -------- |
| F-01  | `e2e-golden-flow-test`             | (foundation) Test E2E US-01 (Playwright) odpalany w CI dowodzi cross-account symmetry i 403-gate. | —                | US-01, FR-003          | ready    |
| F-02  | `ci-test-gate-and-smoke`           | (foundation) CI workflow uruchamia lint + backend testy + smoke health-check po deploy.           | —                | Guardrail §Izolacja    | ready    |
| S-01  | `tasks-auto-timeline-and-regen`    | zmienić datę ślubu, wybrać przesuń / wygeneruj od nowa, zobaczyć tasks złożone wstecz od templates | —                | FR-024, FR-027, FR-034 | ready    |
| S-02  | `attention-rank-refinement`        | zobaczyć "Wymaga uwagi" rankowane po pilności (typ × dni do deadlinu), nie po typie sygnału       | S-01             | FR-007                 | proposed |
| S-03  | `vendor-missing-alert-dismissal`   | wyciszyć alert "brakujący w kategorii X" z trwałym stanem per wesele                              | —                | FR-016                 | ready    |
| S-04  | `tasks-calendar-view`              | przełączyć widok zadań z listy na kalendarz miesięczny                                            | S-01             | FR-026                 | proposed |
| S-05  | `production-cutover`               | zalogować się na `wedding-planner-kubitk.pl` z prawdziwego telefonu i widzieć swój real plan      | F-01, F-02, S-01 | FR-001, US-01          | proposed |

## Streams

Pomoc nawigacyjna — grupuje pozycje dzielące łańcuch Prerequisites. Kanoniczne ułożenie jest w grafie zależności poniżej; ta tabela to proponowana kolejność czytania po równoległych torach.

| Stream | Theme                                    | Chain                          | Note                                                                                |
| ------ | ---------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------- |
| A      | Wedge: codzienny sygnał priorytetu       | `S-01` → `S-02` / `S-04`       | Domyka 4-strumieniową "Wymaga uwagi"; główna ścieżka market-feedback.               |
| B      | Release: prod gate i wycięcie            | `F-01` / `F-02` → `S-05`       | F-01 i F-02 niezależne (parallel); S-05 czeka na oba + na S-01 z Stream A.          |
| C      | Refinement: vendor alert dismissal       | `S-03`                         | Standalone — możliwy do dowiezienia kiedykolwiek po wybraniu modelu trwałego stanu. |

## Baseline

Co już jest w kodzie `wedding-planner/` na 2026-05-28 (auto-zbadane + potwierdzone). Foundations poniżej zakładają, że te warstwy istnieją i **nie re-scaffoldują** ich.

- **Frontend:** present — Angular 20+ standalone + signals; 13 pages pokrywają wszystkie 8 modułów MVP + catering + wedding-setup + accept-invite + login + error (`wedding-planner/frontend/src/app/pages/`).
- **Backend / API:** present — Express; 20 route files pokrywają wszystkie 8 modułów MVP + cały podsystem cateringowy (5 plików `catering-*`) + import script `scripts/import-seating.js` (`wedding-planner/backend/src/routes/`).
- **Data:** present — Supabase Postgres; 7 migracji w `wedding-planner/backend/supabase/migrations/`; 25 tabel; RLS deny-all enabled na wszystkich tabelach `public`, service-role backend bypass; `task_templates` seedowane w migracji M1.
- **Auth:** present — external SSO (`kubitksso.pl`); JWKS-verified RS256 JWT (`middleware/jwks-auth.js`) + per-wedding membership guard (`middleware/wedding-member.js`).
- **Deploy / infra:** partial — **frontend FTP-Deploy działa end-to-end** (push do `main` → `.github/workflows/deploy.yml` → `ng build --configuration=production` → FTP do `/public_html/` na `wedding-planner-kubitk.pl`; sekrety `HOSTINGER_FTP_HOST/USER/PASS` ustawione w GH; pierwsza udana publikacja **2026-05-28**). Backend nadal leci przez Hostinger Git auto-pull z `main` **bez** CI test-gate'u. Step `Test` w workflowie jest dziś **no-op placeholder'em** (`package.json` script `"test": "echo ... && exit 0"` — workaround do czasu landingu F-01, bo `angular.json` nie ma target-u `test` i projekt jest bez Karmy/Jasmine). Konfiguracja lintera nie istnieje (CI job ma `npm run lint --if-present` ale brak `.eslintrc*`).
- **Observability:** partial — `morgan` HTTP log + `/api/health` endpoint; brak structured logging (winston/pino), error tracking (sentry), uptime monitoring (UptimeRobot wymieniony w `infrastructure.md` jako post-MVP).

**Pokrycie must-have FR-ów (audyt 2026-05-28, traktowane jako rozszerzenie tej sekcji):**

- **22 shipped end-to-end** — FR-001..006, FR-008..015, FR-017..023, FR-025, FR-028, FR-030..033 (nice-to-have FR-033 też shipped).
- **4 partial** — FR-007 (top-5 bez wewnętrznego rankingu); FR-016 (alert istnieje, brak dismissal state); FR-026 (lista bez widoku Kalendarz); FR-029 (keyboard fallback obecny per commit `b6c5e59`, ale pełen audyt accessibility nieudokumentowany).
- **3 absent** — FR-024, FR-027, FR-034 (cały moduł auto-tasks).

**Otwarte pytania PRD (5):** #1 priorytetyzacja "Wymaga uwagi" → rozstrzygnięte w kodzie (top-5 fixed); #2 vendor threshold → rozstrzygnięte (`'zarezerwowany'`); #4 import gości → istnieje CLI script (`scripts/import-seating.js`); #3 performance NFR i #5 disaster recovery plan B → świadomie odsunięte do post-MVP per `infrastructure.md` i shape-notes.

## Foundations

### F-01: Test E2E golden flow (US-01) w CI

- **Outcome:** (foundation) Jeden test E2E (Playwright) odpalający scenariusz US-01 — login Weroniki przez SSO → dodaj gościa "Anna Kowalska" z dietą vege → Kacper na drugim koncie z osobnej sesji widzi tego samego gościa → trzeci SSO user (z innej apki w bramce) próbuje `GET /api/weddings/:id/guests` i dostaje 403 — jest zielony lokalnie i w CI. Satisfies #5 wymagania kursu i Primary Success Criterion "End-to-end golden flow działa".
- **Change ID:** `e2e-golden-flow-test`
- **PRD refs:** US-01 (Acceptance Criteria), FR-003 (403-gate)
- **Unlocks:** `S-05` (production cutover — nie wycinamy do prod bez zielonego E2E); cross-cutting verification dla 22 shipped FR (regression net dla całego stacka FE+BE+Auth).
- **Prerequisites:** —
- **Parallel with:** F-02, S-01, S-03
- **Blockers:** —
- **Unknowns:**
  - Playwright vs Cypress? Domyślny wybór: Playwright (TS-native, lepiej do Angular 20). Owner: implementer. Block: nie.
  - Dwa konta testowe w SSO — czy admin może wystawić dedykowane test users w `kubitksso.pl`, czy testy startują z mocku JWT? Owner: PO (jeśli wybierze test-users w SSO sandbox). Block: nie (mock JWT jest akceptowalnym fallbackiem do startu).
- **Risk:** Bez tego testu wycięcie do prod jest aktem zaufania — 22 shipped FR są chronione tylko 20 backend integracyjnymi testami; cross-account flow (Weronika dodaje → Kacper widzi) nie jest pokryty w ogóle. Pierwszy bug w tym wektorze w prod = utrata zaufania pary i fallback do Excela.
- **Status:** ready

### F-02: CI test-gate + lint config + smoke health-check po deploy

- **Outcome:** (foundation) F-02 NIE buduje mechanizmu uploadu — frontend FTP-Deploy już istnieje i działa od 2026-05-28. F-02 wrap-uje istniejący pipeline realnym gate'em: konfiguracja ESLint zamiast `--if-present` no-op'a, backend testy + (gdy F-01 wyląduje) E2E uruchamiane przed FTP-deployem frontendu, podmiana placeholder'owego `npm test` na realny test target frontu (lub świadomie zostawiony jako E2E-only); po deployu automatyczny `curl /api/health` na `https://wedding-planner-kubitk.pl/api/health` weryfikuje, że SPA i backend wstały i odpowiadają; backend deploy nadal idzie przez Hostinger auto-pull, ale workflow sygnalizuje "OK/FAIL" w PR.
- **Change ID:** `ci-test-gate-and-smoke`
- **PRD refs:** Guardrail "Izolacja per wesele = krytyczny incydent blokuje wdrożenie na produkcję" (operacjonalizacja gate'u przed prod).
- **Unlocks:** `S-05` (production cutover — nie wycinamy do prod z workflow który nie testuje); regression net dla wszystkich slice'ów post-MVP.
- **Prerequisites:** —
- **Parallel with:** F-01, S-01, S-03
- **Blockers:** —
- **Unknowns:**
  - Linter: ESLint flat config (nowoczesny `eslint.config.js`) czy klasyczny `.eslintrc`? `angular-eslint` plus shared backend rules? Owner: implementer. Block: nie.
  - Backend w workflow vs zostawienie Hostinger auto-pull-a? Decyzja kierunkowa: workflow uruchamia backend testy + lint + (gdy F-01) E2E; jeśli zielone — sygnalizuje OK i Hostinger nadal auto-pulluje (zachowuje obecną topologię, dodaje gate przez PR-check). Owner: implementer. Block: nie.
- **Risk:** Urgency podniesiona od 2026-05-28 — przed tą datą "fat-fingered merge" nie szipował broken FE do prod, bo FTP-Deploy padał na brak sekretów (FE channel był de facto wyłączony). Teraz każdy push do `main` ląduje na `wedding-planner-kubitk.pl` bez żadnego gate'u testowego (step `Test` w workflowie jest no-op'em). Pojedyncza pomyłka w merge'u = broken UI w prod, do następnego dobrego commita. Ryzyko explicit w `infrastructure.md` § Risk Register ("a fat-fingered merge ships broken code through two channels to a single-environment hosting setup").
- **Status:** ready

## Slices

### S-01: Para domyka pętlę auto-zadań ze zmianą daty ślubu (north star)

- **Outcome:** para wchodzi do Ustawień, zmienia `wedding_date` w polu daty, dostaje confirm dialog z dwiema jawnymi opcjami: **"Przesuń zadania (zachowaj zrobione i własne)"** (= merge, default) lub **"Wygeneruj zadania od zera (zachowaj zrobione)"** (= reset). Wybiera tryb, widzi auto-task timeline zaktualizowany; ponowne uruchomienie regeneracji w trybie merge daje identyczny wynik (idempotentność). W obu trybach zadania `completed_at IS NOT NULL` i `source = 'manual'` nie są tknięte.
- **Change ID:** `tasks-auto-timeline-and-regen`
- **PRD refs:** FR-024 (generacja z `task_templates` wstecz od `wedding_date`), FR-027 (dwa tryby regeneracji, nie tyka completed/manual, merge jest idempotentny), FR-034 (confirm dialog z dwiema opcjami); pośrednio FR-007 (uzupełnia 4-ty strumień "Wymaga uwagi" — zadania auto).
- **Prerequisites:** —
- **Parallel with:** F-01, F-02, S-03
- **Blockers:** —
- **Unknowns:**
  - `task_templates` seed istnieje w migracji M1 — czy zawiera kompletny zestaw "typowych zadań ślubnych" o jakim mówi PRD (Rezerwacja sali / -365, Spotkanie z DJ-em / -240, Próba sukni / -30 itd.)? Owner: implementer (audit migracji). Block: nie (jeśli niekompletny — uzupełnić jako część slice'a).
  - Czy `tasks.source` (`'auto'` vs `'manual'`) jest w schemacie? Per CLAUDE.md / shape-notes spodziewane, ale wymaga weryfikacji. Owner: implementer (audit modelu). Block: nie.
- **Risk:** To jedyny moduł post-MVP, który ma logikę "destructive on bad input" (reset mode usuwa wszystkie non-completed auto-tasks). Bug w warunku "nie tykaj completed/manual" = utrata stanu planowania pary — niezaakceptowalne per PRD Guardrail "Regeneracja wbudowanych zadań nie traci stanu pary". Wymaga testów na granicach: completed/non-completed × source=auto/manual × pojedyncze i wielokrotne uruchomienie merge'a (idempotentność).
- **Status:** ready

### S-02: Dashboard "Wymaga uwagi" rankuje pozycje po pilności sygnału

- **Outcome:** para otwiera Dashboard, widzi top-N (≤5) pozycji "Wymaga uwagi" gdzie kolejność wynika z pilności (dni do deadlinu × waga typu sygnału), nie z porządku per-źródło wyliczania. Każda pozycja ma badge typu (zadanie / płatność / RSVP / budżet) i jest klikalna do detalu.
- **Change ID:** `attention-rank-refinement`
- **PRD refs:** FR-007 (sekcja "Wymaga uwagi" z wewnętrzną priorytetyzacją — open question z PRD rozstrzygnięty w kodzie tylko jako top-5 bez rankingu, ten slice domyka refinement).
- **Prerequisites:** S-01 (auto-tasks muszą istnieć, żeby strumień zadań w "Wymaga uwagi" był nie-pusty; bez nich ranking nie ma co rankować w jednym z 4 strumieni).
- **Parallel with:** S-03, S-04
- **Blockers:** —
- **Unknowns:**
  - Konkretna formuła rankingu — `days_until_deadline ASC` z tie-break per typ (płatność > zadanie > RSVP > budżet)? Czy waga × dni? Owner: PO. Block: nie (default proponowany: days ASC + typ jako tie-break; do refinementu post-S-05 na podstawie real-use feedback pary).
- **Risk:** Niska — to polerka istniejącej feature'y; backend już zwraca surowe dane attention items, zmiana siedzi w jednym agregatorze + frontend renderer. Główne ryzyko: para nie będzie miała dobrego sense'u o rankingu dopóki nie zobaczy go w real-life sytuacji (parę tygodni przed ślubem); decyzja "czy ranking jest dobry" jest empiryczna.
- **Status:** proposed

### S-03: Para wycisza alert "brakujący w kategorii X" z trwałym stanem

- **Outcome:** para na widoku Kontrahenci klika "X" (lub "Wycisz") przy alercie "brakujący kontrahent w kategorii Kwiaciarz", alert znika i nie wraca przy następnym otwarciu strony ani po hard-refreshu. Stan dismissalu jest trwały per (wesele, kategoria) i przeżywa restart backendu.
- **Change ID:** `vendor-missing-alert-dismissal`
- **PRD refs:** FR-016 (alert dismissable per kategoria, stan zapisany trwale dla tego wesela).
- **Prerequisites:** —
- **Parallel with:** F-01, F-02, S-01
- **Blockers:** —
- **Unknowns:**
  - Model trwałego stanu: dedicated tabela `vendor_category_dismissals` (1 row per `(wedding_id, category)` z `dismissed_at`), czy boolean kolumna na istniejącej tabeli? Owner: implementer. Block: nie (preferowane: dedicated table z timestamp, łatwiej diagnozować i auto-clear gdy vendor zmienia status na `zarezerwowany`).
- **Risk:** Niska — pojedyncza tabela + 1 endpoint POST/DELETE + 1 UI button. Edge case do zapamiętania: gdy para doda vendora ze statusem `>= zarezerwowany` w wyciszonej kategorii, alert i tak nie zaświeci (bo `missingVendorCategories()` już filtruje); dismissal row staje się no-op — można go zostawić lub czyścić, ale to nie blokuje funkcji.
- **Status:** ready

### S-04: Para przełącza widok zadań na kalendarz miesięczny

- **Outcome:** para na widoku Zadania klika tab "Kalendarz", widzi siatkę miesiąca z zadaniami zaznaczonymi na ich `deadline_date`; klik w zadanie otwiera ten sam dialog edycji co z widoku listy; nawigacja "Poprzedni / Następny miesiąc". Widok listy (Opóźnione / W tym tygodniu / W przyszłości) pozostaje jako pierwszy tab.
- **Change ID:** `tasks-calendar-view`
- **PRD refs:** FR-026 ("widok kalendarza" jako alternatywny do listy).
- **Prerequisites:** S-01 (auto-tasks dają meaningful zawartość kalendarza; pusty kalendarz z 2-3 manual taskami jest UX nieprzekonującą polerką).
- **Parallel with:** S-02, S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Niska — frontend-only; istniejące dane (`tasks` table) są wystarczające. Library decision (własna siatka SCSS vs `angular-calendar`) jest implementation detail, nie projektowa.
- **Status:** proposed

### S-05: Para zaczyna codzienne użycie na produkcyjnym `wedding-planner-kubitk.pl`

- **Outcome:** DNS wskazuje na Hostinger, SSL działa (Let's Encrypt auto-renew aktywny), real-data seed pary jest w prod DB (gościni z arkusza zaimportowani przez CLI, kontrahenci/umowy/płatności wpisane ręcznie lub seedowane), oboje partnerów loguje się ze swojego telefonu z prod URL i widzi swój real plan ślubu — od tego dnia para przestaje używać Excela. Smoke `/api/health` zielony, E2E test z F-01 przeszedł w CI deploy-time. Dashboard pokazuje rankowane (po S-02) "Wymaga uwagi" z 4 strumieni włącznie z auto-tasks z S-01.
- **Change ID:** `production-cutover`
- **PRD refs:** FR-001 (login przez SSO z prod URL), US-01 (cały acceptance flow na prod), Primary Success Criterion #2 (real-world adoption).
- **Prerequisites:** F-01, F-02, S-01
- **Parallel with:** S-02, S-03, S-04 (post-prod polish — slice'y dalej można dowieźć po cutoverze, w trakcie real-use adoption window)
- **Blockers:**
  - SSO admin musi mieć zarejestrowaną apkę `wedding-planner` w `kubitksso.pl/apps` z Domain = `https://wedding-planner-kubitk.pl` (**exact match, brak trailing slash** — per `infrastructure.md` Risk Register, średnia likelihood / średni impact). Bez tego SSO odrzuca redirect po loginie z generic error. Owner: PO (admin SSO).
  - Dwa konta pary muszą istnieć w `kubitksso.pl/users` i być przypisane do apki `wedding-planner`. Owner: PO.
- **Unknowns:**
  - Real data seed: import gości z arkusza pary jest pokryty przez CLI `scripts/import-seating.js` (commit `1d8f706`); kontrahenci / umowy / wydatki / zadania nie mają importu — czy seedujemy ręcznie post-deploy w pierwszej sesji, czy dodajemy minimal seed-script? Owner: implementer + PO. Block: nie (ręcznie post-deploy jest akceptowalne; pierwsza sesja pary i tak jest exploratory).
  - SSL auto-renew weryfikacja przed datą ślubu — `infrastructure.md` Risk Register sugeruje manualny check `2026-07-18` (7 dni przed). Czy ten check trafia do kalendarza pary, czy zostaje on a TODO implementera? Owner: PO. Block: nie (post-cutover, ale do zapisania).
- **Risk:** Single deploy day, single point of failure: jeśli SSO admin nie zarejestrował domeny exactly-as-expected, redirect po loginie zwraca generic error i para nie wchodzi do aplikacji. Mitygacja: smoke check zaraz po deploy (zanim para próbuje zalogować się z telefonu) + weryfikacja Domain string character-for-character w SSO admin panel.
- **Status:** proposed

## Backlog Handoff

| Roadmap ID | Change ID                          | Suggested issue title                                                  | Ready for `/10x-plan` | Notes                                                          |
| ---------- | ---------------------------------- | ---------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------- |
| F-01       | `e2e-golden-flow-test`             | E2E test golden flow (US-01) z Playwright + CI integration             | yes                   | Może lecieć równolegle z S-01 i F-02 — różne powierzchnie.    |
| F-02       | `ci-test-gate-and-smoke`           | CI: lint config + test-gate przed deployem + smoke health-check        | yes                   | Niezależne od F-01; lint config jest brakującym baseline'em.   |
| S-01       | `tasks-auto-timeline-and-regen`    | Tasks: auto-timeline z templates + regeneracja merge/reset + dialog    | yes                   | **North star.** Backend regenerate endpoint + frontend dialog. |
| S-02       | `attention-rank-refinement`        | Dashboard "Wymaga uwagi": ranking po pilności (typ × dni)              | no                    | Czeka na S-01 (4-ty strumień musi mieć dane do rankingu).      |
| S-03       | `vendor-missing-alert-dismissal`   | Kontrahenci: dismiss alertu "brakujący w kategorii" + trwały stan      | yes                   | Standalone — niezależne od pozostałych slice'ów.               |
| S-04       | `tasks-calendar-view`              | Zadania: widok kalendarza jako alternatywa do listy                    | no                    | Czeka na S-01 (kalendarz na pustych tasksach byłby polerką).   |
| S-05       | `production-cutover`               | Production cutover: DNS + SSL + real-data seed + first prod session    | no                    | Czeka na F-01 + F-02 + S-01 (potrójna brama).                  |

## Open Roadmap Questions

1. **Performance / latency NFR dla Dashboardu (z PRD §Open Questions #3)** — Dashboard wykonuje 4 niezależne agregacje + komponuje "Wymaga uwagi" z 4 źródeł. Świadomie odsunięte do post-MVP w shape-notes, ale: jeśli pierwsza sesja pary na prod (S-05) pokaże perceptible lag (>1s na load Dashboardu), będzie to bezpośrednio blokować adopcję (sukces primary = "para realnie używa codziennie"). Owner: PO + implementer. Block: roadmap-wide gate POST-S-05 (mierzymy dopiero po wycięciu, fix wraca jako nowy slice jeśli potrzebny).
2. **Disaster recovery plan B poza daily backup Hostingera (z PRD §Open Questions #5)** — `mysqldump` weekly do lokalnego dysku jest w `infrastructure.md` jako post-MVP. Czy startujemy ten cron **przed** czy **po** `2026-07-18` (7 dni przed ślubem, ten sam dzień co SSL check)? Owner: PO. Block: gates `S-05` jeśli PO zdecyduje "przed cutoverem"; w przeciwnym razie post-S-05.
3. **Doc drift — PRD / `tech-stack.md` / `infrastructure.md` mówią Express + Sequelize + MySQL; kod to Express + Supabase Postgres** — wpływ na samą roadmapę żaden (slice'y są framework-agnostic), ale przed kolejną iteracją PRD (post-wedding v2) warto zaktualizować foundation docs do faktycznego stacka. Owner: implementer. Block: nie.
4. **FR-029 keyboard-only seating — pełny audit accessibility** — commit `b6c5e59` mówi "drag-and-drop + keyboard fallback", ale szczegóły aria-labels / Tab management / Enter-Space announcement nie są udokumentowane. Czy uruchamiamy audit teraz, czy traktujemy jako "polish post-MVP"? Owner: PO. Block: nie (PRD oznacza jako wymóg formalny, nie user-driven; akceptowane minimum jest dostarczone w M8).

## Parked

- **Konfigurator cateringu** — **już dostarczony post-shape** (commit `e504635` "M6 catering: Pałac Polanka 2026 preset"). Pierwotnie w shape-notes Non-Goal jako v2; faktycznie shipped jeszcze przed startem roadmapy.
- **Upload skanów PDF umów / storage plików** — z PRD §Non-Goals. Skany pary trzymane są osobno na dysku. Wraca w v3+ jeśli się pojawi use case.
- **Powiadomienia push / email / SMS** — z PRD §Non-Goals. Wszystkie sygnały biznesowe są pull-based w UI (badge'e, "Wymaga uwagi", KPI).
- **AI features** — z PRD §Non-Goals. MVP wymagań kursu jest spełniony bez AI; dorzucenie tylko jeśli wniesie mierzalną wartość użytkową.
- **Self-service signup / password reset / email verification w wedding-planner** — z PRD §Non-Goals. Konta tworzy admin w panelu SSO; wedding-planner nigdy nie obsługuje account lifecycle.
- **Multi-tenant rendering wielu wesel w jednym deployu** — z PRD §Non-Goals. MVP serwuje dokładnie jedno wesele Weroniki & Kacpra; schemat toleruje wiele `weddings` rows, ale UI i admin flow zakładają jedno.
- **Offline-first / PWA service worker** — z PRD §Non-Goals. Aplikacja wymaga internetu; brak install-as-app, brak offline cache.
- **Pełny audyt WCAG-AA poza FR-029** — z PRD §Non-Goals. Sensowne defaults bez formalnego audytu; jedynie seating ma keyboard fallback jako hard requirement z `CLAUDE.md`.
- **Frontend unit testy do pełnego pokrycia komponentów** — 0 `.spec.ts` dziś; backend ma 20 plików HTTP integracyjnych. Decyzja: zostawić dla post-MVP polish — F-01 (E2E) jest tańszy i daje większą wartość regression-net niż wzór unit testów na każdy Angular component.
- **Observability lite (structured logging, sentry, UptimeRobot)** — wymienione w `infrastructure.md` jako post-MVP. Daily backup Hostingera + morgan logs + manual `/api/health` check jest akceptowalnym minimum dla MVP z 2 użytkownikami.

## Done

(Pusty na pierwszej generacji. `/10x-archive` dopisuje wpis tutaj — i flipuje `Status` pozycji na `done` — gdy change o pasującym `Change ID` jest archiwizowany.)
