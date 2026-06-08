---
project: "Wedding Planner (Weronika & Kacper)"
context_type: greenfield
created: 2026-05-19
updated: 2026-05-19
product_type: web-app
target_scale:
  users: small
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-07-25
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  frs_drafted: 34
  quality_check_status: accepted
  gray_areas_resolved:
    - topic: pain category
      decision: "decision paralysis from no priority signal + data trapped across many tools (Excel, chat, paper)"
    - topic: insight
      decision: "eat-your-own-dogfood — the builders ARE the users, feedback loop is instant"
    - topic: primary persona scope
      decision: "one specific couple (Weronika & Kacper); accounts provisioned by admin in SSO; no self-service signup in MVP or v2"
    - topic: wedding members modeling
      decision: "two columns on weddings (partner_a_user_id, partner_b_user_id); wedding_members table abandoned (doc drift in 01-overview.md to be corrected during /10x-prd)"
    - topic: access control changes vs docs
      decision: "totally symmetric CRUD (founder-only hard-delete dropped during Socrates challenge); SSO + two linked accounts + JWKS verification stand"
    - topic: MVP scope vs timeline
      decision: "3-week MVP (8 modules: Auth, Dashboard, Goście/RSVP, Kontrahenci, Umowy, Budżet, Zadania, Seating). Catering configurator → v2 (post-defense, pre-wedding 2026-07-25). Doable in 3 weeks because SSO is shipped, DB is designed in 04-database.md, seating is copied from sibling fit-seats repo and adapted, and there are no design decisions left to relitigate."
    - topic: primary success criterion
      decision: "6-step golden flow (login → dashboard → add guest with diet → aggregates update → second partner sees same guest) + 9-week adoption (couple uses app in production as single source of truth until 2026-07-25, not Excel)"
    - topic: secondary outcomes
      decision: "(a) 10xDevs course defense passes all 6 requirements (access control / CRUD / business logic / artifacts / e2e test / CI/CD); (b) v2 features (catering / day-timeline / playlist) shipped between defense and 2026-07-25"
    - topic: guardrails
      decision: "(a) per-wedding isolation via belongsToWedding middleware on every wedding-scoped endpoint; (b) Polski UI 100% (labels, statuses, dates DD.MM.YYYY, currency '32 000 zł'); (c) auto-task timeline regeneration is idempotent — never overwrites completed or manually-created tasks"
    - topic: business logic one-sentence rule
      decision: "priority signal composition — app turns wedding_date into a continuously-updated ranked list of 'co teraz wymaga uwagi' by composing 4 streams (backward-from-date task timeline, payment schedule, RSVP completeness gap, budget overcommit per category)"
    - topic: Socrates outcomes
      decision: "FR-007 / FR-016 / FR-022 / FR-027 refined with resolutions; FR-029 kept as formal-only (CLAUDE.md hard requirement, not user-driven); FR-033 demoted to nice-to-have; FR-035 / FR-036 removed entirely (hard-delete wedding not needed)"
    - topic: product framing
      decision: "product_type=web-app; target_scale.users=small (exactly 2); timeline_budget=3 weeks after-hours with hard_deadline 2026-07-25"
---

# Shape notes — Wedding Planner

> ⚠️ **Dokument historyczny (zapis shapingu z 2026-05-19).** Nie aktualizowany w
> miejscu — zachowuje „jak myśleliśmy wtedy". Dwie decyzje zostały później odwrócone:
> (1) **baza** — notatki mówią „MySQL na Hostingerze", „MySQL doesn't have RLS",
> „Avoid Supabase/Postgres"; faktycznie wedding-planner używa **Supabase Postgres**
> z **RLS deny-all** (pivot 2026-05-23). MySQL/Sequelize należą tylko do SSO.
> (2) **auto-taski** — opisane jako feature; usunięte 2026-05-26 (`strip_task_auto`),
> tasks są manualne. Aktualny stan: `CLAUDE.md` + `context/foundation/{prd,roadmap,tech-stack,infrastructure}.md`.

Seed source: existing docs in this repo (`docs/demo-app/01-overview.md`, `wedding-planner-deployment.md`, `wedding-planner-koncepcja.md`). Decisions already locked in those docs are echoed back and confirmed here — not relitigated.

## Vision & Problem Statement

A couple planning a Polish wedding (`Weronika & Kacper`, ślub `2026-07-25`) currently splits their plan across a Google Sheets guest list, a separate spreadsheet for vendor contracts and payment schedules, chat threads where RSVP answers and diet preferences arrive, and paper notes for the day-of timeline. The data exists but is rasypana — partner A's chat doesn't auto-sync into partner B's Excel, the dietary aggregate needed for catering is a manual recount, and there is no single signal that says "this week, the photographer's second installment is due and 12 guests still haven't responded." With ~3 months to the wedding, the cost is missed deadlines and duplicated work between the two partners.

The insight worth building against is eat-your-own-dogfood: the two users are the builders, so every awkward UX surfaces in the same week it ships, and the feature backlog is governed by what the couple actually needs before `2026-07-25` rather than by what a generic market segment is assumed to want. Coupled with a domain-coherent data model (guests are one source of truth for RSVP, seating, catering, and budget — not four parallel lists), the product can give the couple a single priority signal each session ("this needs attention now") rather than five lists to reconcile.

## User & Persona

**Primary persona — the couple as a unit, two linked accounts.**

- Names: Weronika and Kacper. Both employed full-time; planning happens after work and on weekends.
- Account model: two separate SSO accounts (provisioned by admin in `kubitksso.pl/users`, no self-service signup), both linked to one `wedding` row via `partner_a_user_id` and `partner_b_user_id`. They have symmetric CRUD permissions on every entity *except* hard-delete of the wedding itself, which is gated by `created_by_user_id` (the founder).
- Reach-for-it moment: an evening, 30 seconds open, want to know "what changed since I last checked, what needs me this week, what's due in the next 30 days." Not browsing — checking.
- Out of scope: no third role for wedding-coordinator / family / witnesses; no public marketing site for other couples. MVP serves exactly this one wedding.

## Access Control

- **Authentication** is external. All login, signup, password handling, email verification, password reset, and session lifetime is owned by the SSO service at `kubitksso.pl` (sibling repo `SSO/`). The wedding-planner backend never sees a password and never issues a session token.
- **Backend authorization** verifies a Bearer JWT (RS256) on every API call by fetching JWKS from `https://kubitksso.pl/.well-known/jwks.json` (cached 1h). Invalid / expired → 401.
- **Per-wedding isolation** is enforced as middleware in the application layer (no DB-level RLS — MySQL doesn't have it). Every wedding-scoped endpoint runs `[ssoAuth, belongsToWedding]`. `belongsToWedding` loads the wedding by id and asserts `JWT.userId ∈ {weddings.partner_a_user_id, weddings.partner_b_user_id}` → else 403.
- **Account provisioning** is admin-only via the SSO admin panel at `https://kubitksso.pl/users`. No self-service registration in MVP or v2. The two accounts are then linked into one `weddings` row by an admin SQL insert that populates `partner_a_user_id` and `partner_b_user_id`.
- **Roles inside a wedding**: flat. Both partners have **totally symmetric** CRUD on every entity. There is NO asymmetric permission anywhere — the previously-planned founder-only hard-delete of the whole wedding was removed during Socrates challenge (no real use case for nuking the entire record post-wedding). `weddings.created_by_user_id` remains in schema as metadata but gates nothing.
- **Wedding membership model**: two columns on `weddings` (`partner_a_user_id`, `partner_b_user_id`). The `wedding_members` n:m table mentioned in `docs/demo-app/01-overview.md` is doc drift — to be corrected when `/10x-prd` runs and propagates to `04-database.md`.

## Success Criteria

### Primary

- **Golden flow przechodzi end-to-end**: użytkownik wchodzi na `wedding-planner-kubitk.pl`, jest przekierowywany na SSO, loguje się, ląduje na Dashboardzie, dodaje gościa z dietą wege z poziomu `/app/goscie`, agregaty u góry listy aktualizują się o +1 zaproszony i +1 wege, kafelek "Goście" na Dashboardzie pokazuje nową liczbę. Drugi partner loguje się ze swojego konta i widzi tego samego gościa — to dowodzi, że "jedno wesele, dwa konta, symetryczny CRUD" działa.
- **Real-world adoption do 2026-07-25**: para realnie używa apki przez 9 tygodni dzielących start kursu od ślubu jako single source of truth — lista gości, kontrahenci, umowy, harmonogram płatności, zadania, rozsadzenie — bez fallbacku do Excela / chatu. Jeśli któryś moduł nie wytrzyma codziennego użycia (zbyt powolny, brakujące pole, blokujący bug), to primary kryterium nie jest spełnione, niezależnie od stanu demo.

### Secondary

- **Obrona kursu 10xDevs zaliczona**: aplikacja spełnia wszystkie 6 wymagań listowanych w `wedding-planner-koncepcja.md` (mechanizm kontroli dostępu, CRUD, logika biznesowa, artefakty modułów 1–3, test e2e weryfikujący przepływ, CI/CD).
- **v2 dorzucone między obroną a ślubem**: catering configurator (`/app/oferta-sali`), timeline dnia ślubu, playlista, dokumenty USC, notatki — co najmniej catering trafia do produkcji przed `2026-07-25`, bo do tego momentu para potrzebuje zbierać wybory dań od gości.

### Guardrails

- **Izolacja per wesele**: każdy wedding-scoped endpoint backendu chroni para middlewarów `[ssoAuth, belongsToWedding]`. Bearer JWT od dowolnego innego usera SSO (ze SSO bramki obsługującej wiele apek) zwraca 403 zamiast danych pary. Przeciek = krytyczny incident, blokuje merge do main.
- **Polski UI 100% od pierwszego commita**: etykiety, statusy enuma, mock-dane w seedach, formaty dat (`DD.MM.YYYY`), kwoty z PLN ze spacją jako separatorem tysięcy (`32 000 zł`). Brak english-leaków. Easier to write Polish than to migrate later.
- **Auto-task timeline idempotentny**: regeneracja zadań typu `auto` po zmianie `weddings.wedding_date` nigdy nie kasuje zadań ukończonych (`completed_at IS NOT NULL`) ani zadań utworzonych ręcznie (`source = 'manual'`). Wielokrotne uruchomienie regeneracji daje identyczny wynik. Jeden bug w tym = utrata stanu pary, niezaakceptowalne.

## Timeline acknowledgment

Acknowledged on 2026-05-19: 3-tygodniowy MVP jest realistyczny, ponieważ większość kosztów projektowych jest już pochłonięta przed startem implementacji. Konkretnie: (a) SSO jest wdrożone i działa pod `kubitksso.pl`, integracja to ~15 linii (interceptor + guard + middleware JWKS); (b) data model jest zaprojektowany w `docs/demo-app/04-database.md` (23 tabele, do portu na MySQL/Sequelize); (c) UI inventory i shape endpointów są spisane w `docs/demo-app/02-frontend.md` i `03-backend.md`; (d) moduł rozsadzania (`/app/rozsadzenie`) jest kopiowany z sibling repo `fit-seats` i adaptowany, nie pisany od zera; (e) catering configurator (najdroższy nieznany kawałek) świadomie schodzi do v2. Akceptujemy ryzyko: pozostają cztery niezerowe koszty — port schema PostgreSQL → MySQL (RLS / trigger / `gen_random_uuid()` → app-layer logic), implementacja auto-task timeline jako Sequelize hook (nie jako trigger), CI/CD setup (FTP-Deploy + SSH), polerka Polski UI od pierwszego commita.

## Functional Requirements

### Auth (SSO integration)

- FR-001: Para może zalogować się przez SSO i wrócić na /app z aktywnym tokenem. Priority: must-have
- FR-002: System odrzuca każde wywołanie wedding-scoped API bez ważnego JWT (RS256) podpisanego przez kubitksso.pl. Priority: must-have
- FR-003: System odrzuca każde wywołanie wedding-scoped API gdy userId z JWT nie jest jednym z partner_a/b_user_id wesela. Priority: must-have
- FR-004: Para może się wylogować i utracić dostęp do /app (redirect do SSO login). Priority: must-have

### Dashboard

- FR-005: Para widzi licznik dni do wedding_date na Dashboardzie. Priority: must-have
- FR-006: Para widzi 4 KPI (goście potwierdzeni / budżet wydany / nadchodzące płatności 30d / zadania w tym tygodniu). Priority: must-have
- FR-007: Para widzi sekcję "Wymaga uwagi" agregującą sygnały biznesowe (opóźnione zadania, zaległe płatności, brakujące dania w RSVP, niepotwierdzeni goście blisko ślubu). Priority: must-have
  > Socrates: Counter-argument considered: "sygnał stanie się szumem gdy parę tygodni przed ślubem WSZYSTKO 'wymaga uwagi' — lista urośnie do kilkunastu pozycji i przestanie filtrować informację." Resolution: kept, ale sekcja musi mieć wewnętrzny priorytet (top-5 najpilniejszych) lub kategoryzację po typie sygnału. Przeniesione do `## Open Questions` jako kwestia projektowa do rozstrzygnięcia w `/10x-prd`.
- FR-008: Para widzi sekcję "Nadchodzące spotkania" z najbliższych meetings. Priority: must-have

### Goście / RSVP

- FR-009: Para może dodać gościa (imię, nazwisko, relacja, dieta, +1 flag, dziecko flag). Priority: must-have
- FR-010: Para może edytować i usunąć gościa. Priority: must-have
- FR-011: Para widzi listę gości pogrupowaną po relacjach z agregatami (zaproszeni, potwierdzeni, oczekujący, odmówieni, wege, dzieci). Priority: must-have
- FR-012: Para może zmienić status RSVP gościa (pending/confirmed/declined). Priority: must-have
- FR-013: Para może przypisać gościa do meal_option (dropdown z per-wedding meal_options w Ustawieniach). Priority: must-have

### Kontrahenci

- FR-014: Para może dodać/edytować/usunąć kontrahenta (10 kategorii: Sala, Catering, Fotograf, DJ, Kwiaciarz, USC, Ksiądz, Makijaż, Dekoracje, Tort) z kontaktem i statusem. Priority: must-have
- FR-015: Para widzi karty kontrahentów z filtrem statusu i kategorii. Priority: must-have
- FR-016: System pokazuje alert "brakujący kontrahent w kategorii X" w stosunku do typowego harmonogramu liczonego wstecz od wedding_date. Priority: must-have
  > Socrates: Counter-argument considered: "false positives — 'typowy harmonogram' nie pasuje do twojego planu (ślub bez DJ-a bo gra zespół, bez kwiaciarza bo dekoruje rodzina); alert stałby się hałasem." Resolution: kept, ale alert musi być dismissable per kategoria, a stan dismissalu zapisany per wedding. Próg statusu który "rozbraja" alert: kategoria ma kontrahenta ze statusem >= 'spotkanie'. Przeniesione do `## Open Questions` jako reguła do doprecyzowania w `/10x-prd`.

### Umowy

- FR-017: Para może dodać/edytować/usunąć umowę linkowaną do kontrahenta (kwota, harmonogram płatności: zaliczka/raty/final z datami). Priority: must-have
- FR-018: Para widzi tabelę umów z mini-paskiem statusu rat (opłacone / do zapłaty w 30d / po terminie / zaplanowane). Priority: must-have
- FR-019: Para widzi sekcję "Nadchodzące płatności (30 dni)" agregowaną z wszystkich harmonogramów. Priority: must-have
- FR-020: Para może oznaczyć ratę jako opłaconą. Priority: must-have

### Budżet

- FR-021: Para widzi 3 KPI budżetu (wydane / zarezerwowane z umów / estymowana kwota końcowa). Priority: must-have
- FR-022: Para widzi 15 kategorii wydatków z paskiem postępu vs estymacja oraz flagą przekroczenia (actual + reserved >= 100% planu = uwaga). Priority: must-have
  > Socrates: Counter-argument considered: "90% jest arbitralne — niektóre kategorie (zaliczka sali) prawidłowo lądują na 100% planu i flag 'uwaga' byłaby false positive." Resolution: zmieniono — flag tylko gdy `(wydane + zarezerwowane z umów) >= planowane`, bez 90% progu. To eliminuje arbitralność i pokazuje real overcommitment, nie pre-ostrzeżenie.
- FR-023: Para może dodać/edytować/usunąć wydatek (kategoria, kwota, data, opis). Priority: must-have

### Zadania

- FR-024: System generuje zadania `auto` wstecz od wedding_date na podstawie task_templates. Priority: must-have
- FR-025: Para może dodać/edytować/usunąć własne zadanie (deadline, opis, tag). Priority: must-have
- FR-026: Para widzi listę pogrupowaną na "Opóźnione / W tym tygodniu / W przyszłości" + widok Kalendarz. Priority: must-have
- FR-027: System regeneruje auto-zadania po zmianie weddings.wedding_date z DWOMA trybami: (a) **merge** (idempotentny, default) — shift dat zadań `source=auto` które nie są `completed`, nie tyka manual-source ani completed; (b) **reset** (cascade) — usuwa wszystkie non-completed auto-zadania i generuje od zera z task_templates, nadal nie tyka completed ani manual. Priority: must-have
  > Socrates: Counter-argument considered: "co jeśli user CHCE pełny reset, np. po dużej zmianie daty z lipca na październik — idempotentny merge zostawia 'zrobione' rzeczy które nie powinny być relewantne dla nowej daty." Resolution: zmieniono — confirm dialog (FR-034) ma 2 wyraźne opcje (merge vs reset), default merge. Idempotentność dotyczy merge mode; reset mode jest jawny i destrukcyjny dla non-completed.

### Rozsadzenie

- FR-028: Para może przeciągnąć potwierdzonego gościa z listy "Nieprzypisani" na okrągły stół (drag-and-drop). Priority: must-have
- FR-029: Para ma keyboard-only alternatywę dla DnD (Tab+Enter/Space, focus management). Priority: must-have
  > Socrates: Counter-argument considered: "para realnie nie użyje klawiatury — ma touch i mysz na każdym urządzeniu; koszt implementacji to ~25% więcej kodu na seating, może pożreć czas innych modułów." Resolution: kept, ale uznane za **wymóg formalny z CLAUDE.md** ("hard requirement, not polish item"), nie user-driven feature. Akceptujemy koszt świadomie — nie traktujemy jako wartości użytkowej. Minimum: focus management + ARIA announcements + Tab/Enter/Space; bez fancy keyboard shortcuts.
- FR-030: Para widzi panel "Konflikty" z parami "nie sadzać razem" (powód: free-text). Priority: must-have

### Ustawienia

- FR-031: Para może edytować profil wesela (imiona, wedding_date, miejsce ceremonii). Priority: must-have
- FR-032: Para może CRUD'ować meal_options dla swojego wesela (źródło dropdownu w edytorze gościa). Priority: must-have
- FR-033: Para może wyeksportować pełny dump danych do JSON (bez sekretów: password_hash, invitation tokens). Priority: nice-to-have
  > Socrates: Counter-argument considered: "scope creep — para nigdy nie użyje, Hostinger robi daily backup, to feature dla 'może kiedyś'." Resolution: DEMOTE z must-have do nice-to-have. Endpoint może istnieć (resolved decision z 05-implementation-plan.md), ale UI button "Eksportuj" nie jest wymagany w MVP. Wraca jako must-have w v2 jeśli pojawi się realna potrzeba.
- FR-034: System pokazuje confirm dialog przy zmianie wedding_date z dwoma jawnymi opcjami: "Przesuń zadania (zachowaj zrobione i własne)" = merge, oraz "Wygeneruj zadania od zera (zachowaj zrobione)" = reset. Default: merge. Priority: must-have

### Pure-CRUD FRs — Socrates sweep

> Socrates: Pozostałe FR-y (FR-001..006, FR-008..015, FR-017..021, FR-023..026, FR-028, FR-030..032, FR-034) stoją bez counter-argumentu — to są fundamentalne CRUD-y i kontrakty UI każdego z 8 modułów MVP. Counter-argument typu "może bez X?" sprowadza się do "wyłącz cały moduł", co jest decyzją scope'u (już rozstrzygniętą w Phase 3), nie problemem z konkretnym FR. Resolution: kept as written.

### Hard-delete wedding — USUNIĘTE

> Socrates: Counter-argument considered: "hard delete całego wesela nie jest potrzebny — po ślubie dane zostają jako archiwum, nie ma sensowanego usecasa kasowania całego rekordu." Resolution: FR-035 i FR-036 USUNIĘTE z MVP i z v2. Per-entity DELETE (gość, kontrahent, umowa, wydatek, zadanie) stoją normalnie — to jest CRUD na podelementach. `created_by_user_id` na `weddings` zostaje w schemacie jako metadana, ale nie jest gate'em dla niczego w aplikacji. Konsekwencja: symetria CRUD jest TOTALNA — partner_a i partner_b mają identyczne uprawnienia na wszystkim. To upraszcza permissions model.

## Business Logic

**Aplikacja zamienia datę ślubu w ciągle aktualizowany sygnał priorytetu: dla każdej wieczornej sesji mówi parze "co teraz wymaga uwagi", komponując cztery niezależne strumienie domenowe — (a) timeline zadań liczony wstecz od wedding_date z task_templates, (b) harmonogram nadchodzących płatności z umów, (c) lukę kompletności RSVP (niepotwierdzeni / brak diety / brak wyboru dania), (d) przekroczenia budżetowe per kategoria — w jedną rankowaną listę "opóźnione + due w 30 dniach".**

To jest reguła kompozycji, nie pojedyncza decyzja. Wejścia (user-facing):
- `wedding_date` — wpisana w Ustawieniach przez parę.
- `task_templates` — globalna, niezmienna w MVP biblioteka typowych zadań ślubnych z `offset_days_before_wedding` (np. "Rezerwacja sali" / -365 dni, "Spotkanie z DJ-em" / -240, "Próba sukni" / -30).
- Stan kontrahentów + harmonogram płatności w umowach.
- Stan RSVP gości + ich wybory dań.
- Pozycje budżetowe (plan + actual + rezerwacje z umów).

Wyjście (user-facing): sekcja "Wymaga uwagi" na Dashboardzie (FR-007), sekcja "Nadchodzące płatności 30 dni" (FR-019), 4 KPI kafelki na Dashboardzie (FR-006), alert "brakujący kontrahent w kategorii X" (FR-016), flaga przekroczenia per kategoria budżetu (FR-022) — wszystkie konsumują tę samą regułę z różnymi projekcjami.

Jak para encounteruje regułę w product flow: otwiera Dashboard po pracy → widzi top-N pozycji "Wymaga uwagi" → klika w jedną → ląduje na detalu (kontrahent / umowa / gość / kategoria budżetu) → rozwiązuje → wraca → lista się aktualizuje. Cała wartość produktu siedzi w fakcie, że ten sygnał jest **jednym miejscem** zamiast pięcioma osobnymi widokami które para musi codziennie obchodzić.

## Non-Functional Requirements

- **Polski UI 100% od pierwszego commita.** Każdy widoczny string, każda etykieta, każdy enum value renderowany w UI, każdy error i validation message — po polsku. Formaty: data `DD.MM.YYYY` (nie `2026-05-19`), waluta `32 000 zł` ze spacją jako separatorem tysięcy. Outside-observable: ktokolwiek otwierający aplikację bez znajomości tła musi rozpoznać produkt jako polskojęzyczny od pierwszego ekranu.

(Performance, backward compat z Excel, disaster recovery NFR-y nie zostały explicit wybrane przez PO; patrz `## Open Questions` — `/10x-prd` lub downstream stack-selection step musi rozważyć czy ich nieobecność jest świadoma czy luka.)

## Open Questions

1. **Priorytetyzacja wewnątrz "Wymaga uwagi" (FR-007)** — przy końcówce przygotowań sekcja urośnie do kilkunastu pozycji; jak ją rankować (top-5? per kategoria? per liczba dni do deadlinu?). Owner: PO. By: przed implementacją Dashboardu (Sprint 1).
2. **Definicja "kontrahent rozbrojony" (FR-016)** — który status karty kontrahenta (`rozważany` / `spotkanie` / `zarezerwowany` / `zapłacony` / `wykonany`) wycisza alert "brakujący w kategorii X"? Domyślne: `>= spotkanie`. Owner: PO. By: przed implementacją Kontrahentów (Sprint 1).
3. **Performance / latency targets nie zostały captured** — Dashboard ma 4 niezależne zapytania agregujące + sekcję "Wymaga uwagi" (kompozycja z 4 źródeł). Brak NFR-u oznacza zero-budget na optymalizację. Owner: PO. By: przed `/10x-prd`.
4. **Backward compat / import danych z Excel** — para już ma listę gości w arkuszu; brak importu CSV oznacza ręczne przepisanie ~150 wierszy. Świadome czy luka? Owner: PO. By: przed Sprint 2.
5. **Disaster recovery beyond Hostinger daily backup** — JSON export został zdemoted (FR-033 nice-to-have). Jeśli backup Hostinger zawiedzie tydzień przed ślubem, plan B jest jaki? Owner: PO. By: przed prod-deploy.
6. **Doc drift `wedding_members` vs `weddings(partner_a/b_user_id)`** — `docs/demo-app/01-overview.md` mówi o n:m, `wedding-planner-deployment.md` o 1:1. Decyzja w Phase 2: kolumny na `weddings`. `04-database.md` musi zostać zaktualizowane podczas `/10x-prd` lub zaraz po. Owner: implementer. By: przed M0 scaffold.

## Non-Goals

Explicit scope-avoids for the 3-week MVP. Items pulled from the docs that are already locked-by-koncepcja-resolved-decisions are noted with `(locked)` even if not selected during Phase 6.

- **Catering configurator (`/app/oferta-sali`)** — cały subsystem pakietów / dań / dodatków / kalkulacji ceny / freeze-to-contract dialog. Schema cateringowa (5 tabel `catering_*`) nawet nie tworzy się w MVP migration. Wraca w v2 między obroną a `2026-07-25`.
- **Upload skanów PDF umów / storage plików** — `(locked w koncepcji)`. Brak storage, brak viewera, brak upload UI. Skany pary trzymane osobno na dysku. Aplikacja przechowuje tylko dane z umów: kontrahent, kwoty, harmonogram płatności.
- **Powiadomienia push / email / SMS** — `(locked w koncepcji)`. Żaden zewnętrzny kanał. Wszystkie sygnały biznesowe widoczne jako badge'e, sekcje "Wymaga uwagi" i karty KPI w UI. Para wchodzi do apki sama, kiedy chce sprawdzić stan.
- **AI features** — `(locked w koncepcji: "AI sztuczne, dorzucasz tylko jeśli pasuje, nie żeby odhaczyć")`. Brak integracji z LLM, brak sugestii zadań przez AI, brak generowania draftu maila. MVP wymagań kursu jest spełnione bez AI.

Items below were not selected during Phase 6 elicitation but are still implicit scope-avoids per the docs — captured here for `/10x-prd` to surface as explicit non-goals if it judges they need pinning:

- **Self-service signup / password reset / email verification** — `(locked w koncepcji)`. Konta tworzy admin w panelu SSO (`https://kubitksso.pl/users`). Wedding-planner backend nie obsługuje żadnego account lifecycle.
- **Multi-tenant rendering** — MVP serwuje dokładnie jedno wesele (Weroniki & Kacpra). Schema tolerates wiele `weddings` rows (FK wsz)dzie), ale UI i admin flow zakładają jedno. Wiele wesel = v3+, świadomie poza scope MVP i v2.
- **Offline-first / PWA service worker** — apka wymaga internetu. Brak service worker, brak install-as-app, brak offline cache. Może v3+ jeśli pojawi się use case.
- **Pełne WCAG-AA poza FR-029** — kolor kontrast, screen reader support, alt-texty na poziomie minimalnym (sensowne defaults, brak audytu formalnego). Jedynie seating ma keyboard fallback jako hard requirement z CLAUDE.md.

## Forward: tech-stack

(Informacyjne — nie część PRD schema. Forward-looking notes dla downstream chain step po `/10x-prd`.)

Stack jest już rozstrzygnięty w `wedding-planner-deployment.md` i nie jest do relitygacji:

- Frontend: Angular 20+ standalone components + signals + SCSS, single SPA.
- Backend: Node.js + Express + Sequelize.
- Database: MySQL na Hostingerze (osobna od bazy SSO).
- Auth: external SSO (`kubitksso.pl`), backend weryfikuje RS256 JWT przez JWKS (cache 1h).
- Hosting: Hostinger Business — SPA via FTP do `wedding-planner-kubitk.pl`, backend jako Node.js app na tym samym hoście.
- CI/CD: GitHub Actions (FTP-Deploy dla FE, SSH dla BE).

Avoid-list zebrana z docs (technology avoids, nie scope avoids):
- Avoid: Supabase / Postgres / PostgreSQL-only features (RLS, triggers, enum types, `gen_random_uuid()`) — całość portowana do MySQL + app-layer logic.
- Avoid: NestJS — Express jest świadomym wyborem, ten sam stack co SSO.
- Avoid: monorepo workspace tooling (pnpm workspaces, Nx, Turborepo) — repo trzyma dwie niezależne apki (frontend / backend), deployowane osobno na Hostinger; nie potrzebne build orchestracja.
- Avoid: file storage / blob storage (S3, Hostinger files API) — brak uploadu w MVP.

## Forward: technical-roadmap

(Informacyjne — nie część PRD schema. Forward-looking notes dla downstream chain step.)

Plan implementacji jest w `docs/demo-app/05-implementation-plan.md` (milestones M0–M10), ale jest stary (NestJS/Supabase). Po `/10x-prd` należy przepisać te milestones pod aktualny stack. Skrót:

- **M0 — scaffold**: monorepo `frontend/` + `backend/`, Angular SPA empty + Express skeleton, SSO interceptor + `ssoAuth` middleware działa end-to-end (Bearer JWT → user info). Owner: implementer.
- **M1 — Dashboard + Goście (vertical slice)**: para loguje się przez SSO, widzi pusty Dashboard, dodaje gościa, widzi agregat. End-to-end deploy na Hostinger.
- **M2..M8 — pozostałe 7 modułów** po jednym milestone na moduł, każdy ship end-to-end (CLAUDE.md: "Each milestone ships an end-to-end vertical slice").
- **M9 — e2e test + CI/CD** (test e2e z koncepcji punktu 5).
- **M10 — production cutover** (DNS / SSL / final deploy / dane pary inicjalne).

Po obronie kursu: catering configurator + Timeline dnia ślubu + Playlista + Dokumenty USC + Notatki (v2 wave).

## User Stories

### US-01: Para dodaje pierwszego gościa i widzi spójność danych między dwoma kontami

- **Given** dwóch zalogowanych partnerów (Weronika i Kacper), każdy z osobnego urządzenia, oba konta są zlinkowane z jednym `weddings` row jako `partner_a_user_id` i `partner_b_user_id`, lista gości jest pusta.
- **When** Weronika klika **Dodaj gościa** na `/app/goscie`, wpisuje imię "Anna", nazwisko "Kowalska", relację "Rodzina (panna młoda)", dietę "vege", zaznacza dziecko=nie i +1=nie, klika **Dodaj**.
- **Then** modal się zamyka, gość pojawia się w grupie "Rodzina (panna młoda)" tabeli; agregat u góry zmienia się z "0 zaproszonych" na "1 zaproszony" i z "0 wege" na "1 wege"; kafelek "Goście" na Dashboardzie pokazuje "1/1 potwierdzonych".

#### Acceptance Criteria

- Kacper (drugi partner) w ciągu 5 sekund po zalogowaniu się na własnym koncie widzi tego samego gościa pod tym samym adresem `/app/goscie` z identycznymi danymi.
- Jeśli Kacper zmieni status RSVP Anny z `pending` na `confirmed`, Weronika po odświeżeniu widzi tę zmianę.
- Trzeci user SSO (dowolny inny zalogowany do innej apki w bramce SSO) próbujący `GET /api/weddings/:id/guests` dostaje 403, nie 200 z pustą listą i nie 404.
- Pola formularza walidują się po polsku (`Imię jest wymagane`, `Dieta musi być wybrana`); brak english-leaków.
- Format daty w meta-polu `created_at` na widoku gościa to `DD.MM.YYYY` (np. `19.05.2026`), nie `2026-05-19`.

