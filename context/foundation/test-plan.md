# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-17 (§3 Phase 5 — **COMPLETE**: frontend unit batch for
> Risk #8 — Tier-1 derivations + CRUD scoping sweep; frontend unit 15 → 61 tests;
> §2 risk map + guidance, §4/§5 counts synced. Earlier: 2026-06-16 §3 Phase 2 — all CI gates wired in
> `deploy.yml`, green `main` run proved deterministic gates + migration-drift +
> post-deploy smoke. Phases 1–2 remain complete; 3–4 not started.)

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression. This project already has a meaningful backend integration
   suite (133 tests); new coverage goes where the *signal gap* is, not where
   it is cheapest to pile on more of what already exists.
2. **User concerns are first-class evidence.** Risks anchored in "the couple
   is worried about X, and the failure would surface somewhere in <area>"
   carry the same weight as PRD lines or hot-spot data. The two users are the
   product's authors; their lived fears (cross-account staleness, migration
   drift, seating roulette) drove this risk map directly.
3. **Risks are scenarios, not code locations.** This plan documents *what
   could fail* and *why we believe it's likely* — drawn from documents,
   interview, and codebase *signal* (churn, structure, test base). It does
   NOT claim to know which line owns the failure. That knowledge is produced
   by `/10x-research` during each rollout phase. If the plan and research
   disagree about where the failure lives, research is the ground truth.

Hot-spot scope used for likelihood weighting: `wedding-planner/backend/src`,
`wedding-planner/frontend/src` (build output and vendored code excluded;
28 commits/30d — sufficient signal).

## 2. Risk Map

The top failure scenarios this project must protect against, ordered by
risk = impact × likelihood. Risks are failure scenarios in user / business
terms, not test names. The Source column cites the *evidence that surfaced
this risk* — never a specific file as "where the failure lives" (that is
research's job, see §1 principle #3).

| # | Risk (failure scenario) | Impact | Likelihood | Source (evidence — not anchor) |
|---|--------------------------|--------|------------|--------------------------------|
| 1 | A logged-in identity from another wedding — or from another app in the SSO ecosystem — reads or mutates this wedding's data, **or** is handed an empty list / 404 instead of an explicit **403**. Data crosses the wedding boundary. | High | Medium | PRD §Access Control + Guardrail "Izolacja per wesele", FR-003, US-01 AC; interview Q4; hot-spot dir `wedding-planner/backend/src/routes/` (35 commits/30d); no E2E exists |
| 2 | After a refresh, partner B does not see partner A's committed change (stale/cached read or mis-scoped query), so B acts on outdated guest/payment data and double-books or misses a payment. | High | Medium | PRD US-01 ("po odświeżeniu widzi…"), Primary Success Criterion #1; interview Q1; no E2E exists |
| 3 | A migration is authored on disk but never pushed; code referencing the new column passes locally and fails only in production. | High | Medium | Interview Q2; CLAUDE.md "Drift check" ritual (self-identified most-common mistake in this repo); 13+ migrations on disk |
| 4 | Contract-status sync or the 30-day "upcoming payments" window is wrong — a due installment drops out of the signal, or the budget overflow flag misfires — and a payment is missed. | High | Medium | PRD FR-017–022 (Business Logic); interview Q1 ("miss a payment"); oracle-risk on existing vendor/budget tests |
| 5 | The Dashboard "Wymaga uwagi" / KPI signal under-reports — says nothing is due when a payment or task actually is — so the couple loses trust and reverts to Excel. | High | Medium | PRD §Business Logic, FR-006/FR-007; interview Q1; hot-spot dir `wedding-planner/frontend/src/app/` (dashboard among most-churned pages) |
| 6 | A JSON export leaks secrets — `password_hash` or invitation `token` — into the dump. | High | Low | PRD FR-033 + Resolved decision "JSON export is a full dump minus secrets"; abuse lens (secret/PII leakage) |
| 7 | A guest lands on the wrong table/seat, `seat_number` does not persist, or the keyboard-only fallback (FR-029, hard requirement) silently breaks — seating becomes unusable or inaccessible. | Medium | High | Interview Q3; hot-spot dir `wedding-planner/frontend/src/app/` (seating = most-churned page, 6 commits/30d); FR-028–030 |
| 8 | A per-resource frontend service mis-scopes `weddingId` (wrong URL), mis-derives a client-side aggregate/filter/sort, or leaves a stale signal cache after a mutation — the UI shows wrong or stale data and no test catches it (frontend is sparse). | High | Medium | Hot-spot `wedding-planner/frontend/src/app/core/services` + `core/models` churn; PRD US-01 wedding-scoping; baseline was 3 specs / 15 tests (derivations only) |

**Impact × Likelihood rubric.** High = user loses access/data/money or failure
is publicly visible / area changes weekly or already burned us. Medium =
feature degrades with a workaround / touched occasionally, has bugged before.
Low = cosmetic, easily reverted / stable code rarely touched.

**Abuse lens applied.** Risk #1 is the authorization/IDOR row (endpoint must
verify *this wedding is yours*, not merely *you are logged in*). Risk #6 is
the secret/PII-leakage row. Untrusted-input parity is partly covered by the
existing `request-validation.test.js`; resource-abuse (rate-limiting) is out
of scope for a two-user MVP and is noted in §7.

### Risk Response Guidance

| Risk | What would prove protection | Must challenge | Context `/10x-research` must ground | Likely cheapest layer | Anti-pattern to avoid |
|------|-----------------------------|----------------|--------------------------------------|-----------------------|-----------------------|
| #1 | A foreign SSO identity hitting a wedding resource gets **403** (not `[]`/404) on both read and write paths | "Logged-in ⇒ authorized" — authentication is not membership | The membership-enforcement boundary; how a non-member identity is shaped; read vs write parity | E2E (golden flow) + backend integration (cross-wedding) | Asserting only happy-path member access; treating empty list as "secure" |
| #2 | After B re-fetches, B's view contains A's exact committed write | "Same DB ⇒ both accounts see it" — ignores caching, wedding-scoping, and signal refresh | How a second authenticated session is established; what triggers the client re-fetch; wedding-scoping of the read | E2E (two sessions) | Single-session test that never simulates the second account |
| #3 | CI fails when migrations-on-disk ≠ applied schema; smoke confirms the app boots after deploy | "Local green ⇒ prod green" | How applied migration state is queried vs the on-disk list; what a meaningful boot/health signal is | CI gate + post-deploy `/api/health` smoke | A check that only counts files instead of comparing to applied state |
| #4 | A payment due in 30d **appears**; one due in 31d does **not**; status transitions match the rules; overflow flag fires exactly at `(spent + reserved) ≥ planned` | Boundary (30 vs 31 days); the flag threshold is `≥`, not `>` or a 90% heuristic | The 30-day window definition; the status-transition rules; the overflow formula source of truth | Backend integration with an independent fixture | Oracle problem — asserting the value the implementation already computes |
| #5 | Given seeded due/overdue/RSVP-gap items, the signal lists them; given none, it is empty | "Top-5 returned ⇒ the right 5" | What each of the four streams contributes; how items are selected into the signal | Backend integration (aggregate) | Mirroring `dashboard.test.js` instead of supplying an independent oracle |
| #6 | An export of a wedding that has a password_hash and an invite token contains **neither** | "Spec says minus-secrets ⇒ code redacts" | Which fields the export traverses; where secrets live in the dumped graph | Backend integration | Asserting only that the export is non-empty / well-formed |
| #7 | Drag assigns to the correct table and persists `seat_number`; Tab + Enter/Space achieves the same assignment; ARIA announces the result | "Mouse works ⇒ keyboard works" | The seat-assignment persistence path; the keyboard focus/activation model; the ARIA contract | Frontend component/integration | Snapshot-without-meaning; testing drag while never exercising the fallback |
| #8 | `list/create/update/remove` hit the wedding-scoped URL and correctly mutate the signal cache; aggregate/filter/sort matches an independent oracle | "Compiles ⇒ scoping ok"; "signal emits ⇒ value ok" | Which derivations are client-side vs server-computed; where `weddingId` enters the URL; what resets a cached aggregate | Frontend unit (Vitest + `HttpTestingController`) | Oracle problem — copying the service's own derivation into the assertion; live-clock date math (time-bomb) instead of a frozen clock |

**Phase 1 research correction (2026-06-09).** Risk #1 proved cheapest at the
**backend integration** layer, not e2e: the membership guard runs above every
method, so 403 read/write parity is one integration file against the existing
harness. Risk #2's API half ("B's GET returns A's write") is low-signal — the
read is wedding-scoped by construction, so an API symmetry test mirrors the
implementation. The genuine #2 signal is the browser re-fetch (two-context
e2e) plus the cheap cache-header contract (`no-store` + `Vary: Authorization`)
at integration level. §3 Phase 1 is therefore `integration + e2e`.

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|------------|-----------------|----------------|-----------|--------|---------------|
| 1 | E2E golden flow + isolation gate | Bootstrap the e2e layer (none today); prove US-01 cross-account write→read AND foreign-identity 403; assert Polish validation + `DD.MM.YYYY` inline | #1, #2 | integration + e2e | complete | context/changes/e2e-golden-flow-test/ |
| 2 | CI gate + migration-drift guard + smoke | Add lint config; run BE+FE+E2E before deploy; fail CI on disk-vs-applied migration drift; post-deploy `/api/health` smoke | #3 | quality-gate | complete | context/changes/ci-test-gate-and-smoke/ |
| 3 | Money + signal + egress (backend integration, oracle-safe) | Independent-fixture tests for the 30-day payment window, contract-status sync, budget overflow flag, dashboard signal, and export secret-redaction | #4, #5, #6 | integration | not started | — |
| 4 | Seating correctness + accessible fallback | Verify seat assignment + `seat_number` persistence; keyboard-only path equivalence + ARIA announcements | #7 | component/integration | implementing | (ad-hoc) |
| 5 | Frontend unit coverage (high-churn services) | Oracle-safe scoping/derivation/cache-mutation tests for the high-churn per-resource services | #8 | frontend unit | complete | context/changes/frontend-unit-coverage/ |

**Status vocabulary** (fixed — parser literals): `not started` → `change opened`
→ `researched` → `planned` → `implementing` → `complete`.

**Phase 5 scope (2026-06-17; Tier-1 deep batch).** Landed three oracle-safe
specs: `tasks.service.spec.ts` (overdue/this-week/future/completed date buckets
on a **frozen clock** + scoping/cache mutation), `wedding.service.spec.ts`
(`daysUntilWedding` + couple labels + `loadCurrent` weddingId scoping), and an
extension to `guests.service.spec.ts` (create/update/remove cache mutation + the
server→client aggregates fallback reset). Then the **CRUD scoping sweep** across
the simpler services — vendors, contracts, tables (incl. the `seatsCount` 1–24
guard that throws before any HTTP), meal-options, budget (newest-first prepend +
`loadSummary` cascade on every mutation), meetings (dual `meetings`/`upcoming`
signals + sorted insert) — each proving `list/create/update/remove` hit the
wedding-scoped URL and mutate the signal cache. Frontend unit: 15 → 61 tests.
**Phase 6 started (e2e primary flows):** catering price→freeze landed as
`e2e/catering-freeze.spec.ts` (Risk #9 / Flow 5) — builds the Pałac Polanka
preset offer via the real API, captures the rendered price as the oracle, freezes
into a contract, and asserts the contract row carries that exact price;
break-verified (wrong `total_amount` → red). **Still pending:** guest→group and
payments-30d (mostly covered by units + golden-flow per triage), and seating
Flow 4 (coordinate with Phase 4, don't duplicate).
Note: the refresh brief flagged `guests.service.spec.ts` as red ("httpMock
undefined"); verified green this session — the baseline never regressed.

**Phase 4 started (2026-06-17; seating accessible fallback).** Landed
`pages/seating/seating.page.spec.ts` (3 component-class tests, Risk #7): the
keyboard fallback (`openGuestMenu`→`assignFromMenu`) reaches the **same**
`seating.assignTable(weddingId, guestId, tableId)` call as drag (`dropGuest`) —
equivalence proven, not drag-only; the per-seat select fallback
(`assignSeatById`) persists `seat_number` via `guests.update`; an assignment
conflict surfaces to the user as a warning toast carrying the reason. First
component-level test in the repo (TestBed + mocked services, no render).
Backend already covers `seat_number` persistence + conflicts in
`seating-crud.test.js`. **Gap found (not yet built → not tested):** there is no
`aria-live` announcement on a *successful* assignment — only conflict/error
toasts (which render `role="status"`). "ARIA announces the result" (FR-029) is
therefore only partially satisfied; building a polite success announcement is a
follow-up, and the browser-level keyboard-nav reach (Tab/Enter focus order) is
e2e-tier, both still pending.

**Phase 2 split (2026-06-15; completed 2026-06-16).** Phase 2 is `complete`.
Wired in `.github/workflows/deploy.yml`: the *deterministic* gates (backend
lint+tests, frontend lint+unit+build, hermetic Playwright E2E) plus the two
*networked* gates — the Supabase migration-drift guard (Risk #3) and the
post-deploy `/api/health` smoke (change `ci-test-gate-and-smoke`, Phases 1–4).
The three Supabase secrets are configured and a green `main` run on 2026-06-16
proved the drift + smoke steps pass against the live project. See §6.6.

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| backend unit + integration | node:test (built-in) | Node 20+ | **Meaningful** — 24 files / 133 tests (verified 2026-06-17); mock-Supabase + HTTP harness in `wedding-planner/backend/test/helpers/` |
| frontend unit + component | Vitest (`@angular/build:unit-test`, `ng test`) | Angular 20+ | **Growing** — 12 specs / 64 tests: formatters + per-resource service scoping/derivation/cache (guests/tasks/wedding/vendors/contracts/tables/meal-options/budget/meetings, §3 Phase 5) + first **component test** `seating.page.spec.ts` (Risk #7 keyboard fallback, §3 Phase 4). Baseline verified green 2026-06-17 |
| frontend mocking | Angular `HttpTestingController` | Angular 20+ | Per-service test pattern (see `guests.service.spec.ts`) |
| e2e | Playwright (`@playwright/test`) | ^1.60 | Shipped in §3 Phase 1 — hermetic FE+BE boot via `webServer`; see §6.3 |
| accessibility | none yet — see §3 Phase 4 | — | Seating keyboard fallback (FR-029) is the only hard a11y requirement; axe-core optional |
| CI quality gate | GitHub Actions | — | `deploy.yml` runs real gates (BE lint+tests, FE lint+unit+build, hermetic E2E) before FTP deploy, plus migration-drift guard + post-deploy `/api/health` smoke — all green on `main` 2026-06-16; see §3 Phase 2 / §6.5 |
| lint | ESLint (`eslint.config.js`) | flat config | Shipped both packages: BE `src/**/*.js`+`test/**/*.js`, FE `src/**/*.ts`+`*.html`; `npm run lint` in each (gate, not auto-fix) |

**Stack grounding tools (current session):**
- Docs: none (Context7 / framework docs MCP not available in current session) — relied on local manifests, `package.json` scripts, and known Angular/Express stack; checked: 2026-06-08
- Search: none (Exa.ai / web search MCP not available in current session); checked: 2026-06-08
- Runtime/browser: Playwright MCP — available; candidate driver for the §3 Phase 1 e2e bootstrap and for the cross-account two-session flow; checked: 2026-06-08
- Provider/platform: Supabase MCP — available; relevant to §3 Phase 2 migration-drift verification (applied vs on-disk) and to confirming RLS deny-all on the isolation gate; checked: 2026-06-08

## 5. Quality Gates

The full set of gates that must pass before a change reaches production.
"Required after §3 Phase <N>" means the gate is enforced once that rollout
phase lands; before that, the gate is `planned`.

| Gate | Where | Required? | Catches |
|------|-------|-----------|---------|
| lint + typecheck | local + CI | **live in CI** (`deploy.yml`) | syntactic / type drift (eslint configs shipped both packages; typecheck via `build-prod`) |
| backend unit + integration | local + CI | **live in CI** (`deploy.yml`) | logic regressions (133-test suite now gates the deploy) |
| frontend unit + component | local + CI | **live in CI** (`deploy.yml`) | service/formatter/component regressions (`test:ci`; 64 tests after §3 Phase 5 + Phase 4 seating fallback) |
| e2e on critical flows | CI on push to `main` | **live in CI** (`deploy.yml`) | broken cross-account flow + isolation gate (hermetic Playwright) |
| migration-drift check | CI on push | **live in CI** (`deploy.yml`) | code referencing unpushed schema (compares versions, not counts) |
| pre-prod smoke (`/api/health`) | after FTP deploy | **live in CI** (`deploy.yml`) | environment-specific boot failures; backend ↔ Supabase reachability |
| accessibility (seating keyboard path) | local/CI | optional after §3 Phase 4 | broken keyboard fallback (FR-029) |

## 6. Cookbook Patterns

How to add new tests in this project. Each sub-section is filled in once
the relevant rollout phase ships; before that, it reads "TBD — see §3 Phase <N>".

### 6.1 Adding a backend integration test
- **Location**: `wedding-planner/backend/test/<resource>-crud.test.js`.
- **Harness**: mock-Supabase + HTTP test harness in `wedding-planner/backend/test/helpers/`; seed defaults in `mock-supabase.js`'s `db`.
- **Mocking policy**: mock at the Supabase/network edge only; never mock internal route/service modules.
- **Oracle rule (from §3 Phase 3)**: expected values come from the PRD/business rule or an independent fixture — never copied from the code under test.
- **Reference test**: `wedding-planner/backend/test/resource-crud.test.js` (CRUD + cross-wedding rejection); `budget-crud.test.js` (overflow logic).
- **Time-bomb caution**: seed dates relative to `now` via `isoDaysFromNow`/`dateDaysFromNow` — never hardcode dates, or the "upcoming" window expires and tests go red.
- **Run locally**: `npm test` in `wedding-planner/backend`.

### 6.2 Adding a frontend unit test
- **Location**: next to the unit, `*.spec.ts` under `wedding-planner/frontend/src/app/`.
- **Mocking**: `HttpTestingController` for service HTTP; signal assertions for state.
- **Reference test**: `wedding-planner/frontend/src/app/core/services/guests.service.spec.ts` (derivations + cache mutation); `tasks.service.spec.ts` (frozen-clock date buckets); `wedding.service.spec.ts` (AuthService stub for `loadCurrent` scoping).
- **Oracle rule**: expected aggregate/filter/sort values are hand-computed from the fixture or a PRD definition — never produced by calling the unit under test.
- **Frozen clock**: any date-dependent derivation (`daysUntilWedding`, task buckets) must run under `vi.useFakeTimers()` + `vi.setSystemTime(...)`, restored in `afterEach` — never assert against a live `new Date()` (time-bomb).
- **Run locally**: `ng test` (Vitest via `@angular/build:unit-test`) in `wedding-planner/frontend`.

### 6.3 Adding an e2e test
- **Location**: `wedding-planner/frontend/e2e/*.spec.ts` (outside `src/`, so Vitest ignores it).
- **Runner**: Playwright (`@playwright/test`); config in `wedding-planner/frontend/playwright.config.ts` boots BOTH servers (`webServer`): the Express backend with `NODE_ENV=test AUTH_TEST_MODE=1 DB_TEST_MODE=1` (hermetic: locally-signed HS256 tokens + in-memory seeded DB — no Supabase, no `kubitksso.pl`) and `ng serve`.
- **Auth pattern**: never drive the real SSO. Call `authenticateAs(context, 'a' | 'b')` from `e2e/support/sso-stub.ts` — it injects a fake `window.SSOAuth` via `addInitScript`, signs the token locally, and aborts the real SDK `<script>`.
- **Two-account pattern**: create two `browser.newContext()`s and `authenticateAs` each as a different member; contexts have separate storage by construction. Seeded members live in `wedding-planner/backend/test/helpers/e2e-seed.js` (`user-a`/`user-b`, both members of `wedding-1`, wedding date `2026-09-12`).
- **Assertion rule**: target rendered DOM only (toasts via `ToastService`, `formatDDMMYYYY` output) — backend error bodies are mixed-locale.
- **Reference tests**: `e2e/golden-flow.spec.ts` (two-context cross-account read), `e2e/smoke.spec.ts` (auth harness), `e2e/catering-freeze.spec.ts` (catering price→freeze→contract journey; preset built via real API, price-as-oracle).
- **Seeding non-trivial flows**: hand-seed only the irreducible bit in `backend/test/helpers/e2e-seed.js` (e.g. one `sala` vendor for the freeze flow); build relational data (catering offer/package/selection) through the real API in the test, since the route guards' join queries need genuine relationships.
- **Prerequisite**: `npx playwright install chromium` (see `e2e/README.md`).
- **Run locally**: `npm run e2e` in `wedding-planner/frontend`.

### 6.4 Adding a test for a new API endpoint
- **Test type**: backend integration (preferred) — follow the new-resource convention in CLAUDE.md (router + mapper + `assertWeddingRecordExists` + cross-wedding rejection test).
- **When to add e2e instead**: only when the failure mode needs the full deployed shape (SSO JWT + membership + cross-account), per §3 Phase 1.

### 6.5 Adding a quality gate / migration-drift check
- **Workflow**: `.github/workflows/deploy.yml`, job `gates-and-deploy` (triggers: push to `main` + `workflow_dispatch`). Deterministic gates run *before* the FTP deploy step.
- **Live gates** (shipped 2026-06-10): backend `npm ci && npm run lint && npm test`; frontend `npm ci && npm run lint && npm run test:ci && npm run build-prod`; then `npx playwright install --with-deps chromium && npm run e2e`. All package-local (no root workspace) — add a new gate as its own `working-directory` step before the deploy step.
- **Topology caveat**: the backend is **not** deployed by this workflow — Hostinger auto-pulls `main`. CI hard-blocks only the frontend FTP deploy; a bad push still reaches the backend. Never present CI as a hard backend block.
- **Migration-drift gate** (shipped 2026-06-15): `wedding-planner/backend/scripts/check-migration-drift.js`, run via `npm run migration:check`. Compares 14-digit **versions** parsed from `supabase/migrations/*.sql` filenames against the *applied* remote versions read from `supabase migration list --linked` — never a file count (a count can match while versions differ; unit-tested in `test/migration-drift.test.js`). Exits 1 listing the unpushed version(s). In CI the `Setup Supabase CLI` + `Migration drift guard` steps run *after* E2E and *before* FTP deploy. **Required secrets** (configure in repo settings): `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, and `SUPABASE_DB_PASSWORD` (the CLI's `link` + `migration list` reach the remote DB, so the DB password is required beyond the access token — this is the third secret the original plan under-counted).
- **Post-deploy smoke** (shipped 2026-06-15): the `Post-deploy backend health smoke` step curls `https://deeppink-mole-431102.hostingersite.com/api/health` and fails unless HTTP 2xx **and** the JSON carries `"status":"ok"` + `"supabase":"reachable"`. Always hit the **backend Hostinger host**, never the frontend domain (`wedding-planner-kubitk.pl` serves only the SPA). Because the backend deploys via Hostinger auto-pull, this smoke is a release signal, not a hard backend gate.

### 6.6 Per-rollout-phase notes
(Filled in by `/10x-implement` as phases land.)

- **§3 Phase 1 (e2e golden flow + isolation gate, shipped 2026-06-09)** — landed as `integration + e2e`, not pure e2e (research: Risk #1 and the 401 auth boundary are cheapest at the backend integration layer; only Risk #2's browser re-fetch needs e2e). Backend: `isolation-gate.test.js` (non-member 403 parity on read+write + cache headers), `jwks-auth.test.js` (401 paths), `test-auth-seam.test.js` + `db-seam.test.js` (hermetic seams, fail-closed boot guards verified under `NODE_ENV=production`). Frontend: Playwright bootstrap + `smoke.spec.ts` + `golden-flow.spec.ts`. The two prod-safety boot guards (`AUTH_TEST_MODE`, `DB_TEST_MODE`) are the security-critical invariant — never weaken them.

- **§3 Phase 2 (CI quality gate — COMPLETE 2026-06-16)** — `deploy.yml` runs, before the FTP deploy: backend lint+tests, frontend lint+unit+build, hermetic Playwright E2E, then the **migration-drift guard** (`Setup Supabase CLI` + `Migration drift guard` → `npm run migration:check`), and after deploy the **`/api/health` smoke**. ESLint flat configs + `lint` scripts shipped for both packages (Phases 1–2; lint baseline at commit f4a5407). Migration-drift script + fixture tests and the smoke step shipped in Phases 3–4. The three Supabase secrets (`SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`) are configured and a green `main` run on 2026-06-16 proved the drift + smoke steps pass against the live project (one false start: a wrong `SUPABASE_DB_PASSWORD` secret → SASL `28P01`, fixed by resetting the DB password and re-saving the secret). Drift compares versions not counts; smoke targets the backend Hostinger host, not the frontend domain (§6.5). Topology caveat: backend deploys via Hostinger auto-pull, so CI hard-blocks only the frontend FTP deploy.

## 7. What We Deliberately Don't Test

Exclusions agreed during the rollout (Phase 2 interview, Q5) plus PRD non-goals.
Future contributors should respect these unless the underlying assumption changes.

- **SSO service internals** — token minting, password/session lifecycle, reset, email verification live in the separate `kubitksso.pl` app with its own tests. Wedding-planner is tested only for *verifying* the JWT (JWKS) and enforcing per-wedding membership. Re-evaluate if auth is ever brought in-app. (Source: Phase 2 interview Q5.)
- **Exhaustive mapper-field mirroring** — `mappers.js` churns too fast (11 commits/30d) for field-by-field unit assertions to pay off; mapper output is covered indirectly through the integration/E2E flows that consume it. Re-evaluate if a mapper becomes a stable contract boundary. (Source: Phase 2 interview Q5; hot-spot data.)
- **PRD non-goals** — catering-configurator depth (v2), push/email/SMS, AI features, offline/PWA, multi-tenant, and full WCAG-AA audit beyond the seating keyboard fallback. (Source: PRD §Non-Goals.)
- **Resource-abuse / rate-limiting** — out of scope for a fixed two-user MVP; revisit only if the app opens to more weddings. (Source: §2 abuse-lens triage.)

## 8. Freshness Ledger

- Strategy (§1–§5) last reviewed: 2026-06-08
- Stack versions last verified: 2026-06-08
- AI-native tool references last verified: 2026-06-08

Refresh (`/10x-test-plan --refresh`) when:

- a new top-3 risk surfaces from the roadmap or archive,
- a recommended tool's `checked:` date is older than three months,
- the project's tech stack changes (new framework, new test runner),
- §7 negative-space no longer matches what the team believes.
