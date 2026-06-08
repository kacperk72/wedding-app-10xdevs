# Test Plan

> Phased test rollout for this project. Strategy is frozen at the top
> (§1–§5); cookbook patterns at the bottom (§6) fill in as phases ship.
> Read before writing any new test.
>
> Refresh: re-run `/10x-test-plan --refresh` when stale (see §8).
>
> Last updated: 2026-06-08 (Phase 1 change opened)

## 1. Strategy

Tests follow three non-negotiable principles for this project:

1. **Cost × signal.** The cheapest test that gives a real signal for the
   risk wins. Do not promote to e2e because e2e "feels safer." Do not put a
   vision model on top of a deterministic visual diff that already catches
   the regression. This project already has a meaningful backend integration
   suite (110 tests); new coverage goes where the *signal gap* is, not where
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

## 3. Phased Rollout

Each row is a discrete rollout phase that will open its own change folder
via `/10x-new`. Status moves left-to-right through the values below; the
orchestrator updates Status as artifacts appear on disk.

| # | Phase name | Goal (one line) | Risks covered | Test types | Status | Change folder |
|---|------------|-----------------|----------------|-----------|--------|---------------|
| 1 | E2E golden flow + isolation gate | Bootstrap the e2e layer (none today); prove US-01 cross-account write→read AND foreign-identity 403; assert Polish validation + `DD.MM.YYYY` inline | #1, #2 | e2e | change opened | context/changes/e2e-golden-flow-test/ |
| 2 | CI gate + migration-drift guard + smoke | Add lint config; run BE+FE+E2E before deploy; fail CI on disk-vs-applied migration drift; post-deploy `/api/health` smoke | #3 | quality-gate | not started | — |
| 3 | Money + signal + egress (backend integration, oracle-safe) | Independent-fixture tests for the 30-day payment window, contract-status sync, budget overflow flag, dashboard signal, and export secret-redaction | #4, #5, #6 | integration | not started | — |
| 4 | Seating correctness + accessible fallback | Verify seat assignment + `seat_number` persistence; keyboard-only path equivalence + ARIA announcements | #7 | component/integration | not started | — |

**Status vocabulary** (fixed — parser literals): `not started` → `change opened`
→ `researched` → `planned` → `implementing` → `complete`.

## 4. Stack

The classic test base for this project. AI-native tools (if any) carry a
`checked:` date so future readers can see which lines need re-verification.

| Layer | Tool | Version | Notes |
|-------|------|---------|-------|
| backend unit + integration | node:test (built-in) | Node 20+ | **Meaningful** — 19 files / 110 tests; mock-Supabase + HTTP harness in `wedding-planner/backend/test/helpers/` |
| frontend unit | Vitest (`@angular/build:unit-test`, `ng test`) | Angular 20+ | **Sparse** — 3 specs / 15 tests (formatters + `GuestsService`); seed suite only |
| frontend mocking | Angular `HttpTestingController` | Angular 20+ | Per-service test pattern (see `guests.service.spec.ts`) |
| e2e | none yet — see §3 Phase 1 | — | Playwright is the proposed choice (TS-native, Angular-friendly per roadmap F-01) |
| accessibility | none yet — see §3 Phase 4 | — | Seating keyboard fallback (FR-029) is the only hard a11y requirement; axe-core optional |
| CI quality gate | GitHub Actions | — | `deploy.yml` only; test step is a no-op placeholder — see §3 Phase 2 |

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
| lint + typecheck | local + CI | required after §3 Phase 2 | syntactic / type drift (no lint config exists today) |
| backend unit + integration | local + CI | required after §3 Phase 2 | logic regressions (suite exists; not yet a CI gate) |
| frontend unit | local + CI | required after §3 Phase 2 | service/formatter regressions |
| e2e on critical flows | CI on PR | required after §3 Phase 1 | broken cross-account flow + isolation gate |
| migration-drift check | CI on PR | required after §3 Phase 2 | code referencing unpushed schema |
| pre-prod smoke (`/api/health`) | between merge + prod | required after §3 Phase 2 | environment-specific boot failures |
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
- **Reference test**: `wedding-planner/frontend/src/app/core/services/guests.service.spec.ts`.
- **Run locally**: `ng test` (Vitest via `@angular/build:unit-test`) in `wedding-planner/frontend`.

### 6.3 Adding an e2e test
- TBD — see §3 Phase 1 (cross-account golden flow + 403 isolation gate).

### 6.4 Adding a test for a new API endpoint
- **Test type**: backend integration (preferred) — follow the new-resource convention in CLAUDE.md (router + mapper + `assertWeddingRecordExists` + cross-wedding rejection test).
- **When to add e2e instead**: only when the failure mode needs the full deployed shape (SSO JWT + membership + cross-account), per §3 Phase 1.

### 6.5 Adding a quality gate / migration-drift check
- TBD — see §3 Phase 2.

### 6.6 Per-rollout-phase notes
(Filled in by `/10x-implement` as phases land.)

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
