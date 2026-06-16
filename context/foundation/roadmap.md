---
project: "Wedding Planner (Weronika & Kacper)"
version: 1
status: draft
created: 2026-05-28
updated: 2026-06-09
prd_version: 1
main_goal: market-feedback
top_blocker: none
---

> **Reconciliation note (2026-06-08):** the original 2026-05-28 baseline audit
> was run against a stale view that **missed migration `20260526150000_strip_task_auto`**
> (2026-05-26), which deliberately removed the entire auto-task subsystem
> (`task_templates`, `tasks.is_auto`, `tasks.template_id`, the regen trigger).
> Tasks are **manual-only** and stay that way per `CLAUDE.md` (no restore without
> PO approval). Consequently the former north star **S-01 `tasks-auto-timeline-and-regen`
> is parked** (see ## Parked), the baseline below is corrected, and the new north
> star is **S-05 production cutover**. PRD FR-024/FR-027/FR-034 are descoped (see PRD).

# Roadmap: Wedding Planner (Weronika & Kacper)

> Wyprowadzona z `context/foundation/prd.md` (v1) + auto-zbadanego baseline'u kodu w `wedding-planner/` (frontend + backend, audyt 2026-05-28).
> Edytowalna w miejscu; archiwizowana gdy wyparta.
> Pozycje poniżej są w porządku zależności. Tabela "Na pierwszy rzut oka" jest indeksem.

## Vision recap

Para planująca polski ślub (Weronika & Kacper, ślub `2026-07-25`) dzieli dziś plan między arkusze gości, drugi arkusz na umowy i płatności, wątki czatu z odpowiedziami RSVP i papierowe notatki na timeline dnia ślubu. Aplikacja zamienia tę rozproszoną pracę w jedno źródło prawdy z rankowanym sygnałem priorytetu "co teraz wymaga uwagi" — komponowanym z czterech strumieni domenowych: zadań ślubnych liczonych wstecz od daty, harmonogramu płatności z umów, luki kompletności RSVP i przekroczeń budżetu per kategoria. Insight, na którym budujemy, to **eat-your-own-dogfood** (dwoje użytkowników jest jednocześnie twórcami produktu) — feature backlog jest sterowany tym, czego para realnie potrzebuje przed `2026-07-25`, nie założeniami o generycznym segmencie.

## North star

**S-05: Oboje partnerów loguje się przez SSO na produkcyjnym `wedding-planner-kubitk.pl` z własnego telefonu, widzi swój realny plan ślubu i od tego dnia przestaje używać Excela.** — z 22 must-have FR-ami już dostarczonymi end-to-end, hipoteza produktowa nie czeka już na żadną feature'ę; czeka na **realną adopcję**. 4-strumieniowa kompozycja "Wymaga uwagi" jest kompletna (zadania **manualne** + płatności + luki RSVP + przekroczenia budżetu) — wedge jest zaszipowany. Tym, co jeszcze nie udowodniło głównej hipotezy (`main_goal: market-feedback`), jest oddanie produktu w codzienne ręce pary przed `2026-07-25`. S-05 jest bramkowane przez foundations F-01 + F-02 (test E2E golden flow + CI gate), które są obecnie aktywnym rolloutem w `context/foundation/test-plan.md`.

> "North star" tutaj = najmniejszy end-to-end slice, który jeśli zadziała, dowodzi, że produkt jako całość spełnia swoją główną hipotezę. Po dostarczeniu całego MVP tym slice'em nie jest już żadna feature, tylko **wycięcie na produkcję i pierwsza realna sesja pary**.
>
> _(Poprzedni north star S-01 `tasks-auto-timeline-and-regen` został parkowany 2026-06-08 — auto-taski usunięte produktową decyzją z 2026-05-26; patrz ## Parked.)_

## At a glance

| ID    | Change ID                          | Outcome (para może…)                                                                              | Prerequisites    | PRD refs               | Status   |
| ----- | ---------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------- | ---------------------- | -------- |
| F-01  | `e2e-golden-flow-test`             | (foundation) Test E2E US-01 (Playwright) odpalany w CI dowodzi cross-account symmetry i 403-gate. | —                | US-01, FR-003          | done     |
| F-02  | `ci-test-gate-and-smoke`           | (foundation) CI workflow uruchamia lint + backend testy + smoke health-check po deploy.           | —                | Guardrail §Izolacja    | done     |
| S-01  | `tasks-auto-timeline-and-regen`    | ~~auto-taski wstecz od daty + regeneracja~~ — **PARKED** (auto-taski usunięte 2026-05-26)         | —                | ~~FR-024/027/034~~     | parked   |
| S-02  | `attention-rank-refinement`        | zobaczyć "Wymaga uwagi" rankowane po pilności (typ × dni do deadlinu), nie po typie sygnału       | —                | FR-007                 | proposed |
| S-03  | `vendor-missing-alert-dismissal`   | wyciszyć alert "brakujący w kategorii X" z trwałym stanem per wesele                              | —                | FR-016                 | ready    |
| S-04  | `tasks-calendar-view`              | przełączyć widok zadań z listy na kalendarz miesięczny                                            | —                | FR-026                 | proposed |
| S-05  | `production-cutover` ⭐             | (**north star**) zalogować się na `wedding-planner-kubitk.pl` z prawdziwego telefonu i widzieć swój real plan | F-01, F-02 ✅     | FR-001, US-01          | done     |

## Streams

Pomoc nawigacyjna — grupuje pozycje dzielące łańcuch Prerequisites. Kanoniczne ułożenie jest w grafie zależności poniżej; ta tabela to proponowana kolejność czytania po równoległych torach.

| Stream | Theme                                    | Chain                          | Note                                                                                |
| ------ | ---------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------- |
| A      | Release: prod gate i wycięcie (north star) | `F-01` / `F-02` → `S-05`     | F-01 i F-02 niezależne (parallel); S-05 (north star) czeka na oba. Główna ścieżka market-feedback. |
| B      | Polish: zadania i sygnał priorytetu      | `S-02` / `S-04`                | Standalone po parkowaniu S-01 — wedge "Wymaga uwagi" już kompletny (zadania manualne); to refinement, nie blokery. |
| C      | Refinement: vendor alert dismissal       | `S-03`                         | Standalone — możliwy do dowiezienia kiedykolwiek po wybraniu modelu trwałego stanu. |

## Baseline

Co już jest w kodzie `wedding-planner/` na 2026-05-28 (auto-zbadane + potwierdzone). Foundations poniżej zakładają, że te warstwy istnieją i **nie re-scaffoldują** ich.

- **Frontend:** present — Angular 20+ standalone + signals; 13 pages pokrywają wszystkie 8 modułów MVP + catering + wedding-setup + accept-invite + login + error (`wedding-planner/frontend/src/app/pages/`).
- **Backend / API:** present — Express; 20 route files pokrywają wszystkie 8 modułów MVP + cały podsystem cateringowy (5 plików `catering-*`) + import script `scripts/import-seating.js` (`wedding-planner/backend/src/routes/`).
- **Data:** present — Supabase Postgres; **15 migracji** w `wedding-planner/backend/supabase/migrations/` (korekta 2026-06-08; audyt z 2026-05-28 mówił błędnie "7"); **24 tabele** (25 minus `task_templates`, usunięte migracją `20260526150000_strip_task_auto`); RLS deny-all enabled na wszystkich tabelach `public`, service-role backend bypass. **Auto-taski usunięte** — `task_templates`, `tasks.is_auto`, `tasks.template_id` i trigger regeneracji nie istnieją; tasks są manualne.
- **Auth:** present — external SSO (`kubitksso.pl`); JWKS-verified RS256 JWT (`middleware/jwks-auth.js`) + per-wedding membership guard (`middleware/wedding-member.js`).
- **Deploy / infra:** partial — **frontend FTP-Deploy działa end-to-end** (push do `main` → `.github/workflows/deploy.yml` → `ng build --configuration=production` → FTP do `/public_html/` na `wedding-planner-kubitk.pl`; sekrety `HOSTINGER_FTP_HOST/USER/PASS` ustawione w GH; pierwsza udana publikacja **2026-05-28**). Backend nadal leci przez Hostinger Git auto-pull z `main` **bez** CI test-gate'u. Step `Test` w workflowie jest dziś **no-op placeholder'em** (`package.json` script `"test": "echo ... && exit 0"` — workaround do czasu landingu F-01, bo `angular.json` nie ma target-u `test` i projekt jest bez Karmy/Jasmine). Konfiguracja lintera nie istnieje (CI job ma `npm run lint --if-present` ale brak `.eslintrc*`).
- **Observability:** partial — `morgan` HTTP log + `/api/health` endpoint; brak structured logging (winston/pino), error tracking (sentry), uptime monitoring (UptimeRobot wymieniony w `infrastructure.md` jako post-MVP).

**Pokrycie must-have FR-ów (audyt 2026-05-28, skorygowany 2026-06-08):**

- **22 shipped end-to-end** — FR-001..006, FR-008..015, FR-017..023, FR-025, FR-028, FR-030..033 (nice-to-have FR-033 też shipped).
- **4 partial** — FR-007 (top-5 bez wewnętrznego rankingu); FR-016 (alert istnieje, brak dismissal state); FR-026 (lista bez widoku Kalendarz); FR-029 (keyboard fallback obecny per commit `b6c5e59`, ale pełen audyt accessibility nieudokumentowany).
- **3 descoped** — FR-024, FR-027, FR-034 (auto-tasks). **Nie "absent" — świadomie usunięte** decyzją produktową z 2026-05-26 (migracja `strip_task_auto`); PRD oznacza je jako descoped. Tasks pozostają manualne; nie przywracać bez zgody PO (`CLAUDE.md`).

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
- **Status:** done

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

### S-01: ~~Para domyka pętlę auto-zadań ze zmianą daty ślubu~~ — PARKED

- **Status:** **parked (2026-06-08).** Auto-taski (FR-024/027/034) zostały **usunięte** produktową decyzją z 2026-05-26 (migracja `20260526150000_strip_task_auto`: zniknęły `task_templates`, `tasks.is_auto`, `tasks.template_id`, trigger `tg_weddings_shift_auto_tasks` i funkcja `shift_auto_tasks_on_wedding_date_change`). Tasks są **manualne**. Ten slice był wpisany jako north star przez audyt z 2026-05-28, który przeoczył strip; nie reprezentuje żywej decyzji produktowej.
- **Dlaczego nie blokuje niczego:** 4-strumieniowa kompozycja "Wymaga uwagi" jest kompletna bez auto-tasków — strumień zadań zasilają zadania manualne (FR-025), obok płatności / RSVP / budżetu. Wedge jest zaszipowany.
- **Wskrzeszenie:** wymaga **zgody PO** (`CLAUDE.md`). Gdyby PO chciał przywrócić: nowa migracja odtwarzająca `task_templates` + `tasks.source`, endpoint regeneracji (merge/reset, idempotentny, nie tyka completed/manual), confirm dialog (FR-034), testy na granicach. Do tego czasu — patrz ## Parked.

### S-02: Dashboard "Wymaga uwagi" rankuje pozycje po pilności sygnału

- **Outcome:** para otwiera Dashboard, widzi top-N (≤5) pozycji "Wymaga uwagi" gdzie kolejność wynika z pilności (dni do deadlinu × waga typu sygnału), nie z porządku per-źródło wyliczania. Każda pozycja ma badge typu (zadanie / płatność / RSVP / budżet) i jest klikalna do detalu.
- **Change ID:** `attention-rank-refinement`
- **PRD refs:** FR-007 (sekcja "Wymaga uwagi" z wewnętrzną priorytetyzacją — open question z PRD rozstrzygnięty w kodzie tylko jako top-5 bez rankingu, ten slice domyka refinement).
- **Prerequisites:** — (po parkowaniu S-01: strumień zadań w "Wymaga uwagi" zasilają zadania **manualne**, które już istnieją, więc ranking ma co rankować bez auto-tasków).
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
- **Prerequisites:** — (po parkowaniu S-01: kalendarz renderuje zadania **manualne**; nie ma twardej zależności. UX-caveat zostaje: kalendarz z 2-3 manualnymi taskami jest mniej przekonujący — to argument za priorytetem, nie blocker).
- **Parallel with:** S-02, S-03
- **Blockers:** —
- **Unknowns:** —
- **Risk:** Niska — frontend-only; istniejące dane (`tasks` table) są wystarczające. Library decision (własna siatka SCSS vs `angular-calendar`) jest implementation detail, nie projektowa.
- **Status:** proposed

### S-05: Para zaczyna codzienne użycie na produkcyjnym `wedding-planner-kubitk.pl` ⭐ (north star)

- **Outcome:** DNS wskazuje na Hostinger, SSL działa (Let's Encrypt auto-renew aktywny), real-data seed pary jest w prod DB (gościni z arkusza zaimportowani przez CLI, kontrahenci/umowy/płatności wpisane ręcznie lub seedowane), oboje partnerów loguje się ze swojego telefonu z prod URL i widzi swój real plan ślubu — od tego dnia para przestaje używać Excela. Smoke `/api/health` zielony, E2E test z F-01 przeszedł w CI deploy-time. Dashboard pokazuje "Wymaga uwagi" z 4 strumieni: zadania **manualne** + płatności + luki RSVP + przekroczenia budżetu (ranking refinement to S-02, opcjonalny po cutoverze).
- **Change ID:** `production-cutover`
- **PRD refs:** FR-001 (login przez SSO z prod URL), US-01 (cały acceptance flow na prod), Primary Success Criterion #2 (real-world adoption).
- **Prerequisites:** F-01, F-02 (auto-task S-01 **usunięty z prerequisitów** — parked 2026-06-08)
- **Parallel with:** S-02, S-03, S-04 (post-prod polish — slice'y dalej można dowieźć po cutoverze, w trakcie real-use adoption window)
- **Blockers:**
  - SSO admin musi mieć zarejestrowaną apkę `wedding-planner` w `kubitksso.pl/apps` z Domain = `https://wedding-planner-kubitk.pl` (**exact match, brak trailing slash** — per `infrastructure.md` Risk Register, średnia likelihood / średni impact). Bez tego SSO odrzuca redirect po loginie z generic error. Owner: PO (admin SSO).
  - Dwa konta pary muszą istnieć w `kubitksso.pl/users` i być przypisane do apki `wedding-planner`. Owner: PO.
- **Unknowns:**
  - Real data seed: import gości z arkusza pary jest pokryty przez CLI `scripts/import-seating.js` (commit `1d8f706`); kontrahenci / umowy / wydatki / zadania nie mają importu — czy seedujemy ręcznie post-deploy w pierwszej sesji, czy dodajemy minimal seed-script? Owner: implementer + PO. Block: nie (ręcznie post-deploy jest akceptowalne; pierwsza sesja pary i tak jest exploratory).
  - SSL auto-renew weryfikacja przed datą ślubu — `infrastructure.md` Risk Register sugeruje manualny check `2026-07-18` (7 dni przed). Czy ten check trafia do kalendarza pary, czy zostaje on a TODO implementera? Owner: PO. Block: nie (post-cutover, ale do zapisania).
- **Risk:** Single deploy day, single point of failure: jeśli SSO admin nie zarejestrował domeny exactly-as-expected, redirect po loginie zwraca generic error i para nie wchodzi do aplikacji. Mitygacja: smoke check zaraz po deploy (zanim para próbuje zalogować się z telefonu) + weryfikacja Domain string character-for-character w SSO admin panel.
- **Status:** **done (2026-06-16)** — cutover osiągnięty: apka żyje na `wedding-planner-kubitk.pl`, oboje partnerów loguje się przez SSO, działa na realnych danych pary; F-01+F-02 done; SSL pokrywa dzień ślubu (cert do 2026-08-08). Runbook + dowody: `context/deployment/s05-cutover-runbook.md`. Pozostaje wyłącznie **realna adopcja** (`main_goal: market-feedback`) — okno obserwacji, nie zadanie. Opcjonalny polish post-cutover: S-02/S-03/S-04.

## Backlog Handoff

| Roadmap ID | Change ID                          | Suggested issue title                                                  | Ready for `/10x-plan` | Notes                                                          |
| ---------- | ---------------------------------- | ---------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------- |
| F-01       | `e2e-golden-flow-test`             | E2E test golden flow (US-01) z Playwright + CI integration             | yes                   | Może lecieć równolegle z S-01 i F-02 — różne powierzchnie.    |
| F-02       | `ci-test-gate-and-smoke`           | CI: lint config + test-gate przed deployem + smoke health-check        | yes                   | Niezależne od F-01; lint config jest brakującym baseline'em.   |
| S-01       | `tasks-auto-timeline-and-regen`    | ~~Tasks: auto-timeline + regeneracja~~                                 | —                     | **PARKED** — auto-taski usunięte 2026-05-26; wskrzeszenie wymaga zgody PO. |
| S-02       | `attention-rank-refinement`        | Dashboard "Wymaga uwagi": ranking po pilności (typ × dni)              | yes                   | Standalone po parkowaniu S-01 — rankuje istniejące dane (zadania manualne + 3 strumienie). |
| S-03       | `vendor-missing-alert-dismissal`   | Kontrahenci: dismiss alertu "brakujący w kategorii" + trwały stan      | yes                   | Standalone — niezależne od pozostałych slice'ów.               |
| S-04       | `tasks-calendar-view`              | Zadania: widok kalendarza jako alternatywa do listy                    | yes                   | Standalone po parkowaniu S-01 — renderuje zadania manualne.    |
| S-05       | `production-cutover` ⭐             | Production cutover: DNS + SSL + real-data seed + first prod session    | done                  | **North star OSIĄGNIĘTY (2026-06-16)** — apka live na realnych danych, oboje partnerów się loguje. Runbook: `context/deployment/s05-cutover-runbook.md`. Zostaje tylko adopcja. |

## Open Roadmap Questions

1. **Performance / latency NFR dla Dashboardu (z PRD §Open Questions #3)** — Dashboard wykonuje 4 niezależne agregacje + komponuje "Wymaga uwagi" z 4 źródeł. Świadomie odsunięte do post-MVP w shape-notes, ale: jeśli pierwsza sesja pary na prod (S-05) pokaże perceptible lag (>1s na load Dashboardu), będzie to bezpośrednio blokować adopcję (sukces primary = "para realnie używa codziennie"). Owner: PO + implementer. Block: roadmap-wide gate POST-S-05 (mierzymy dopiero po wycięciu, fix wraca jako nowy slice jeśli potrzebny).
2. **Disaster recovery plan B poza daily backup Hostingera (z PRD §Open Questions #5)** — `mysqldump` weekly do lokalnego dysku jest w `infrastructure.md` jako post-MVP. Czy startujemy ten cron **przed** czy **po** `2026-07-18` (7 dni przed ślubem, ten sam dzień co SSL check)? Owner: PO. Block: gates `S-05` jeśli PO zdecyduje "przed cutoverem"; w przeciwnym razie post-S-05.
3. ~~**Doc drift — `tech-stack.md` / `infrastructure.md` mówią Express + Sequelize + MySQL**~~ — **ROZWIĄZANE 2026-06-08.** `tech-stack.md` i `infrastructure.md` poprawione na Express + Supabase Postgres (z korektą-banerem); `docs/demo-app/04-database.md` posprzątane z auto-tasków. `wedding-planner-deployment.md` (source of truth #1) był już poprawny. **Pozostały dryf** (nie-foundation, do decyzji PO): `wedding-planner-koncepcja.md`, `context/foundation/shape-notes.md`, `context/deployment/deploy-plan.md` nadal mówią MySQL/Sequelize dla wedding-plannera (dokumenty pre-pivot / historyczne).
4. **FR-029 keyboard-only seating — pełny audit accessibility** — commit `b6c5e59` mówi "drag-and-drop + keyboard fallback", ale szczegóły aria-labels / Tab management / Enter-Space announcement nie są udokumentowane. Czy uruchamiamy audit teraz, czy traktujemy jako "polish post-MVP"? Owner: PO. Block: nie (PRD oznacza jako wymóg formalny, nie user-driven; akceptowane minimum jest dostarczone w M8).

## Parked

- **Auto-taski (S-01 `tasks-auto-timeline-and-regen`, FR-024/027/034)** — **usunięte produktową decyzją z 2026-05-26** (migracja `20260526150000_strip_task_auto`: zniknęły `task_templates`, `tasks.is_auto`, `tasks.template_id`, trigger `tg_weddings_shift_auto_tasks`, funkcja `shift_auto_tasks_on_wedding_date_change`; `bootstrap_wedding` przepisane bez seedowania tasków). Tasks są w pełni manualne (FR-025). Pierwotny audyt roadmapy z 2026-05-28 przeoczył ten strip i błędnie wpisał S-01 jako north star — skorygowane 2026-06-08. **Wskrzeszenie wymaga zgody PO** (`CLAUDE.md`); nie przywracać domyślnie. PRD oznacza FR-024/027/034 jako descoped.
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

- **F-01: (foundation) Jeden test E2E (Playwright) odpalający scenariusz US-01 — login Weroniki przez SSO → dodaj gościa "Anna Kowalska" z dietą vege → Kacper na drugim koncie z osobnej sesji widzi tego samego gościa → trzeci SSO user (z innej apki w bramce) próbuje `GET /api/weddings/:id/guests` i dostaje 403 — jest zielony lokalnie i w CI. Satisfies #5 wymagania kursu i Primary Success Criterion "End-to-end golden flow działa".** — Archived 2026-06-09 → `context/archive/2026-06-08-e2e-golden-flow-test/`. Lesson: —.
