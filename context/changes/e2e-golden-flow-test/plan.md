# E2E Golden Flow + Isolation Gate — Implementation Plan

## Overview

Phase 1 of the frozen `context/foundation/test-plan.md` rollout. It closes two
named risks and bootstraps the project's first browser e2e layer:

- **Risk #1 — per-wedding isolation breach**: a foreign SSO / cross-wedding
  identity must receive **403** (not `[]`/404) on **read AND write** paths.
- **Risk #2 — cross-account stale read**: after refresh, partner B must see
  partner A's exact committed write.

Per `research.md`, the work splits by cost × signal rather than landing
everything in e2e: Risk #1 and the auth boundary are cheapest at the **backend
integration** layer (the existing harness already supports multiple
identities), while Risk #2's genuine signal — the Angular signal re-fetch and
HTTP caching — lives only in the **browser**. Phase 1's test type therefore
becomes **`integration + e2e`** (a backport into test-plan §3, done in Phase 4).

## Current State Analysis

- **Authorization is a single Express guard.** `requireWeddingMember()`
  (`wedding-planner/backend/src/middleware/wedding-member.js:24-34`) maps the
  SSO payload to a local user, loads `wedding_members` by `(wedding_id,
  user_id)`, and `throw`s `NotMemberError` (status 403,
  `errors/domain-errors.js:17-21`) on a miss. It is mounted via
  `router.use(requireWeddingMember())` at the top of each resource router
  (`routes/guests.js:187`), above every method — so 403-for-non-members is
  structurally method-agnostic. RLS is deny-all but the backend connects as
  `service_role` which **bypasses RLS**, so this guard is the *sole*
  authorization enforcement — raising the value of an explicit 403 test.
- **No test exercises the non-member path.** Every current test calls as
  `sso-a` = `user-a`, always seeded as a member of `wedding-1`. The existing
  "cross-wedding" tests (`resource-crud.test.js:195,325`) cover FK contamination
  (400) and query-scoping (404) — **not** the `NotMemberError`/403 gate.
- **The read is wedding-scoped, not user-scoped** (`routes/guests.js:205-208`,
  `.eq("wedding_id", ...)` with no `user_id` filter), so "B sees A's guest" is
  architecturally guaranteed at the API. A pure API symmetry assertion is an
  implementation mirror; the real stale-read signal is the browser.
- **Caching is mitigated centrally**: `app.use("/api", ...)` sets
  `Cache-Control: no-store` and `res.vary("Authorization")`
  (`wedding-planner/backend/src/server.js:44-48`) — cheaply assertable.
- **Authentication uses live JWKS.** `requireSsoAuth`
  (`wedding-planner/backend/src/middleware/jwks-auth.js:30-54`) verifies RS256
  against keys from `JWKS_URL`; missing/expired/invalid → 401. It does **not**
  check the `apps` audience — so the "another app's user" defense rests
  entirely on membership, not authentication. The 401 paths are currently
  untested (the integration harness swaps the module out).
- **Frontend auth is fully delegated to an external SSO SDK.** `AuthService`
  wraps `window.SSOAuth` (injected by a `<script>` from `kubitksso.pl`):
  `token = sdk.getToken()`, `loginWithSso() → sdk.login(returnUrl)`
  (`auth.service.ts:46,93-97`). The `/app/**` route guard requires token AND
  `/me`-reported `weddingId` (`auth.guard.ts:12-26`).
- **Pull-on-load consistency, no realtime.** `GuestsService.list()` does
  `this._guests.set(...)` on each GET; pages call `list()` on init.
  `create()` optimistically appends locally for the *acting* user only
  (`guests.service.ts:82-108`) — so B genuinely depends on a re-fetch.
- **No e2e framework exists.** Frontend devDependencies have no Playwright;
  the backend integration harness (`test/helpers/http-app.js`) boots the real
  Express app with `config/database` and `middleware/jwks-auth` swapped in
  `require.cache`, and `request(server, method, path, body, token="sso-a")`
  selects identity by bearer string. The auth mock maps `sso-a→user-a`,
  `sso-b→user-b`, `sso-c→user-c`; default `wedding_members` seed is only
  `{wedding-1, user-a, partner_a}`.

## Desired End State

- A backend integration test proves a non-member (`sso-b`, not seeded into
  `wedding-1`) gets **403** on GET `/`, GET `/aggregates`, POST, PATCH, and
  DELETE under `/api/weddings/wedding-1/guests` — read and write parity.
- A thin unit test proves `jwks-auth` returns **401** for missing, expired, and
  malformed tokens (locally-signed token + stubbed signing key).
- A backend integration test asserts `Cache-Control: no-store` and
  `Vary: Authorization` on an `/api` response.
- A backend test-auth seam exists, **gated** behind an explicit env flag,
  **fail-closed** (never active under `NODE_ENV=production`), and a **boot
  guard** that throws if the flag is ever set in production. A test proves both
  the accept-when-enabled and refuse-to-boot-in-prod behaviors.
- Playwright runs from `wedding-planner/frontend` (`npm run e2e`) with a fake
  `window.SSOAuth` injected via `addInitScript`, booting FE + BE for the suite;
  a smoke spec proves login lands on `/app`.
- A golden-flow e2e proves, in two browser contexts within one test, that
  partner B sees partner A's committed guest after re-fetch, and asserts Polish
  validation copy and `DD.MM.YYYY` rendering in the DOM.
- `test-plan.md` §6.3 / §6.6 are filled and §3 Phase 1 is backported to
  `integration + e2e` and marked `complete`.

### Key Discoveries:

- `requireWeddingMember` runs before every handler on every method
  (`wedding-member.js:24-34`, mounted `guests.js:187`) — 403 parity is free.
- Harness already selects identity by bearer string; `sso-b` is a non-member
  by default (`http-app.js:53`, `mock-supabase.js:1-17,379-386`).
- `no-store` + `Vary` already set centrally (`server.js:44-48`).
- FE auth is `window.SSOAuth` only (`auth.service.ts:25-34`) — a stub is the
  single injection point for hermetic e2e.
- BE auth is `module.exports = requireSsoAuth` (a single function,
  `jwks-auth.js:56`) — the seam wraps/replaces this one export.

## What We're NOT Doing

- **No multi-resource e2e.** The golden flow exercises guests only; other
  resources stay on backend integration (cost × signal).
- **No real SSO test users / live JWKS in CI.** Auth is hermetic (decided).
- **No API-level #2 symmetry test** — it is an implementation mirror; the
  cheap header check replaces it and the browser test carries the real signal.
- **No CI wiring.** GitHub Actions integration of these gates is test-plan §3
  Phase 2, explicitly out of scope here.
- **No realtime/websocket** — consistency is pull-on-load by design.
- **No `apps`/audience enforcement change** — auth not checking `apps` is
  existing behavior; we test the membership gate, not redesign auth.

## Implementation Approach

Ship the cheapest, highest-value signal first (Phase 1, backend integration —
no new infra), then build the minimum infrastructure to unlock the browser
layer (Phase 2 test-auth seam, Phase 3 Playwright + SDK stub), then the
golden-flow e2e and documentation backport (Phase 4). Each phase is
independently verifiable; Phases 2–4 form the e2e enablement chain.

## Critical Implementation Details

**Prod-safety of the test-auth seam (Phase 2).** The seam must be defense-in-
depth: it activates only when an explicit env flag is set **and**
`NODE_ENV !== "production"`; if the flag is ever set while
`NODE_ENV === "production"`, the server must **throw at boot** rather than
start. A single env check is insufficient — a misconfig must crash loudly, not
silently accept test tokens. This is the security-critical invariant of the
whole change.

**Identity is double-keyed (Phases 1, 2, 4).** SSO `userId` (string) maps to
local `users.id` (uuid) via upsert; membership is on the local id. Tests must
seed `wedding_members` against the *mapped* local id (`user-a`/`user-b` per the
harness map), not the token string. For the e2e, partner B must be a seeded
member of the same wedding or the route guard bounces B to `/app/setup` before
the read can be proven.

**Backend error bodies are mixed-locale (Phase 4).** Some backend messages are
English ("Guest not found"), some Polish. Polish-UI assertions must target the
**rendered DOM** (toasts via `ToastService`, `formatDDMMYYYY` output), never
backend error strings.

---

## Phase 1: Backend integration — isolation 403 + 401 auth + header contract

### Overview

Close Risk #1 (the 403 gate) and the 401 authentication boundary, plus the
cheap half of Risk #2 (cache headers), entirely within the existing backend
test infrastructure. No new dependencies.

### Changes Required:

#### 1. Non-member 403 gate (Risk #1, read + write parity)

**File**: `wedding-planner/backend/test/isolation-gate.test.js` (new)

**Intent**: Prove a foreign identity that is authenticated but **not** a member
of `wedding-1` is rejected with 403 on every method, never handed `[]`/404.
This guards the sole authorization enforcement layer.

**Contract**: Using the existing harness, issue requests as `token="sso-b"`
(maps to `user-b`, not seeded into `wedding-1`) against
`/api/weddings/wedding-1/guests`: GET `/`, GET `/aggregates`, POST (valid
body), PATCH `/:id`, DELETE `/:id`. Each must return **403** with the
`NotMemberError` body shape (`{ error: "You are not a member of this wedding" }`).
Add one positive control: the same calls as `sso-a` are **not** 403 (proves the
test distinguishes the gate from a blanket failure). Follow the
`resource-crud.test.js` structure and `createTestServer`/`request`/`close`
lifecycle.

#### 2. JWKS 401 authentication paths

**File**: `wedding-planner/backend/test/jwks-auth.test.js` (new)

**Intent**: Cover the 401 paths that the integration harness swaps away —
missing, expired, and malformed tokens — without contacting the live SSO.

**Contract**: Unit-test `requireSsoAuth` (`middleware/jwks-auth.js`) directly
with a mocked Express `req`/`res`/`next`. Stub the signing-key lookup so a
locally-signed RS256 token verifies, and assert: no `Authorization` header →
401 "Access denied"; an expired token → 401 "Token expired."; a malformed/
wrong-signature token → 401 "Invalid token."; a valid token → `next()` called
with `req.user` populated. Because `jwks-auth.js` constructs its `jwksClient`
at module load against `process.env.JWKS_URL`, the test must control the signing
path — either by injecting/stubbing `getSigningKey` (e.g. via `jwks-rsa` mock
or a module-level seam) or by signing with a key the stub returns. Determine the
cleanest stub seam during implementation; do not reach the network.

#### 3. Cache-header contract (Risk #2, cheap half)

**File**: extend `wedding-planner/backend/test/isolation-gate.test.js` (or a
small dedicated `cache-headers.test.js` — implementer's call)

**Intent**: Assert the central cache mitigation so a browser/CDN can't serve a
cached pre-write response.

**Contract**: On a successful `/api` response (e.g. GET guests as `sso-a`),
assert `res.headers["cache-control"]` includes `no-store` and
`res.headers["vary"]` includes `Authorization` (`server.js:44-48`).

### Success Criteria:

#### Automated Verification:

- [ ] Backend suite passes: `npm test` in `wedding-planner/backend`
- [ ] New `isolation-gate.test.js` asserts 403 on GET `/`, GET `/aggregates`, POST, PATCH, DELETE as `sso-b`
- [ ] Positive control (`sso-a` not 403) passes in the same file
- [ ] `jwks-auth.test.js` asserts 401 for missing / expired / malformed tokens and `next()` for a valid token
- [ ] Cache-header assertion (`no-store` + `Vary: Authorization`) passes
- [ ] No network calls occur during the suite (JWKS not contacted)

#### Manual Verification:

- [ ] Test count and file count increase as expected; no time-bomb dates introduced

**Implementation Note**: After completing this phase and all automated
verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Backend test-auth seam (`AUTH_TEST_MODE`, prod-safe)

### Overview

Add the backend seam that lets a running server accept a locally-signed test
token instead of live JWKS — the prerequisite for hermetic e2e — with
prod-safety as the load-bearing invariant.

### Changes Required:

#### 1. Test-auth middleware seam

**File**: `wedding-planner/backend/src/middleware/jwks-auth.js` (or a sibling
`test-auth.js` selected at wiring time)

**Intent**: When test mode is active, verify a locally-signed token and attach
the same `req.user` shape `requireSsoAuth` produces; otherwise behave exactly
as today.

**Contract**: Activation requires **both** an explicit env flag (e.g.
`AUTH_TEST_MODE=1`) **and** `NODE_ENV !== "production"`. When active, verify the
incoming bearer token against a locally-held test key/secret (HS256 with a test
secret, or a fixed local RS256 keypair — implementer's choice) and set
`req.user = { userId, email, firstName, lastName, role, isActive, apps }`
(same shape as `jwks-auth.js:28-29,51`). When inactive, the live JWKS path is
unchanged. The exported function signature `(req, res, next)` and the mount in
`server.js:54` stay the same.

#### 2. Boot guard (fail-closed)

**File**: `wedding-planner/backend/src/server.js` (or the config/env-load
module it imports)

**Intent**: Make a production misconfiguration crash loudly instead of silently
opening an auth bypass.

**Contract**: At startup, if `AUTH_TEST_MODE` is truthy while
`NODE_ENV === "production"`, **throw** (refuse to boot) with a clear message.
This runs before the server listens. Document the env contract alongside
existing env vars (deployment doc / `.env` example).

#### 3. Seam tests

**File**: `wedding-planner/backend/test/test-auth-seam.test.js` (new)

**Intent**: Prove the seam accepts a valid test token when enabled and that the
boot guard refuses production.

**Contract**: (a) With test mode enabled and `NODE_ENV=test`, a request bearing
a correctly-signed local token reaches a handler with the expected `req.user`;
a wrong-signature token → 401. (b) Setting `AUTH_TEST_MODE` with
`NODE_ENV=production` makes the boot/guard function throw. Keep these
hermetic — no live JWKS.

### Success Criteria:

#### Automated Verification:

- [ ] Backend suite passes: `npm test` in `wedding-planner/backend`
- [ ] Seam accepts a valid locally-signed token (correct `req.user`) when enabled
- [ ] Seam rejects a wrong-signature token with 401 when enabled
- [ ] Boot guard throws when `AUTH_TEST_MODE` set under `NODE_ENV=production`
- [ ] Live JWKS path unchanged when test mode off (existing auth-dependent tests still pass)

#### Manual Verification:

- [ ] Env contract documented; default (unset) behavior is the live JWKS path
- [ ] Confirm by inspection that no prod entrypoint can reach the seam without the env flag

**Implementation Note**: Pause for manual confirmation after automated
verification — this phase carries the security-critical invariant.

---

## Phase 3: Playwright bootstrap + FE SDK stub

### Overview

Stand up the e2e layer: install Playwright in the frontend package, inject a
fake `window.SSOAuth`, orchestrate booting FE + BE, and prove the harness with
a login-redirect smoke spec.

### Changes Required:

#### 1. Playwright install + config

**File**: `wedding-planner/frontend/package.json`,
`wedding-planner/frontend/playwright.config.ts` (new)

**Intent**: Add Playwright as a devDependency with a config that boots both the
Angular dev server and the Express backend (in test-auth mode) for the run.

**Contract**: Add `@playwright/test` to devDependencies and an `e2e` script
(e.g. `npm run e2e`). `playwright.config.ts` sets `testDir: "e2e"`, a
`baseURL`, and `webServer` entries that start the FE and the BE with
`AUTH_TEST_MODE=1 NODE_ENV=test` (and the BE pointed at a test database/mock as
appropriate). Decide FE/BE boot orchestration (two `webServer` entries vs a
script) during implementation; the BE must run with the Phase 2 seam enabled.

#### 2. Fake `window.SSOAuth` injection

**File**: `wedding-planner/frontend/e2e/support/sso-stub.ts` (new)

**Intent**: Provide a hermetic SDK so `AuthService` reads a known token without
contacting `kubitksso.pl`.

**Contract**: An `addInitScript` payload that defines `window.SSOAuth`
implementing the `SsoSdk` interface (`auth.service.ts:12-21`): `getToken()`
returns the locally-signed test token (matching Phase 2's expected signature),
`isAuthenticated()` true, `login`/`logout`/`refresh` no-op or navigate,
`onAuthChange` registers and can fire once. Expose a helper to build a context
seeded for a given member (partner A vs partner B → distinct tokens / `userId`).
The token's `userId` must map to a `wedding_members` row for the target wedding,
or the route guard redirects to `/app/setup`.

#### 3. Login-redirect smoke spec

**File**: `wedding-planner/frontend/e2e/smoke.spec.ts` (new)

**Intent**: Prove the harness end-to-end before writing the golden flow.

**Contract**: With the SSO stub injected for a seeded member, navigating to
`/app` passes the `authGuard` (token + `/me` returns `weddingId`) and lands on
an authenticated route rather than redirecting to `/`. Assert a stable
authenticated-shell element is visible.

### Success Criteria:

#### Automated Verification:

- [ ] `npm run e2e` boots FE + BE and runs Playwright headless
- [ ] Smoke spec passes: stubbed login lands on `/app` (no redirect to `/`)
- [ ] `npx playwright install` documented as a prerequisite (browsers fetched)

#### Manual Verification:

- [ ] BE under e2e runs with `AUTH_TEST_MODE` and is confirmed not reachable as prod
- [ ] SSO stub requires no network to `kubitksso.pl`
- [ ] Smoke run is deterministic across 3 consecutive runs (no flake)

**Implementation Note**: Pause for manual confirmation after automated
verification before proceeding.

---

## Phase 4: Golden-flow e2e + cookbook / test-plan backport

### Overview

The headline test: two browser contexts prove the cross-account read (Risk #2),
with Polish validation + `DD.MM.YYYY` DOM assertions (US-01). Then backport the
documentation into the test-plan.

### Changes Required:

#### 1. Cross-account golden-flow spec

**File**: `wedding-planner/frontend/e2e/golden-flow.spec.ts` (new)

**Intent**: Prove, in one test with two independent contexts, that partner B
sees partner A's committed guest after re-fetch, and that the add-guest flow
shows Polish copy and `DD.MM.YYYY` formatting.

**Contract**: Seed `wedding_members` with both `user-a` (partner_a) and
`user-b` (partner_b) for the same wedding (a Phase-3 seeding helper or BE seed).
Context A (stub token for partner A) navigates to the guests page
(`/app/goscie`), adds a guest; assert Polish validation/feedback copy in the DOM
on the add path and `DD.MM.YYYY` rendering where a date is shown. Context B
(stub token for partner B, separate storage) loads the guests page **fresh** and
asserts partner A's guest renders (re-fetch carries the write; `create()`'s
optimistic append is local to A only). Target rendered DOM, not backend error
bodies (mixed-locale).

#### 2. Cookbook §6.3 + §6.6 fill-in

**File**: `context/foundation/test-plan.md`

**Intent**: Make the e2e pattern reproducible per the cookbook convention.

**Contract**: Replace §6.3 "TBD" with: location (`wedding-planner/frontend/e2e/`),
SSO-stub + two-context pattern, the `AUTH_TEST_MODE` BE requirement, the
reference spec (`golden-flow.spec.ts`), and the run command (`npm run e2e`).
Add a §6.6 per-phase note for this rollout phase.

#### 3. Test-plan §3 + §2 backport

**File**: `context/foundation/test-plan.md`

**Intent**: Record the research-driven correction and close the phase.

**Contract**: Change §3 Phase 1 "Test types" from `e2e` to `integration + e2e`;
set its Status to `complete`. Add a note in §2 Risk Response Guidance that #1 is
integration-cheap and #2's API half is low-signal (real signal is browser +
header check). Update the §1 freshness/last-updated line as appropriate. This is
a Source/response-guidance edit only (no file anchors).

### Success Criteria:

#### Automated Verification:

- [ ] `npm run e2e` passes including `golden-flow.spec.ts`
- [ ] Two-context test: B's page renders A's guest after fresh load
- [ ] Polish validation/feedback copy asserted in the DOM
- [ ] `DD.MM.YYYY` formatting asserted in the DOM
- [ ] Full backend suite (`npm test`) and frontend unit suite (`ng test`) still green

#### Manual Verification:

- [ ] Golden-flow run is deterministic across 3 consecutive runs (no flake)
- [ ] test-plan §6.3, §6.6, §3 Phase 1 (`integration + e2e`, `complete`), and §2 note all updated and internally consistent
- [ ] Visual confirmation in `--headed` mode that B genuinely loads a separate session

**Implementation Note**: Pause for manual confirmation after automated
verification before marking the phase complete.

---

## Testing Strategy

### Unit Tests:

- `jwks-auth` 401 paths (missing/expired/malformed) with stubbed signing key.
- Test-auth seam: accept valid local token, reject wrong signature, boot guard
  throws under prod.

### Integration Tests:

- Non-member 403 parity across GET `/`, GET `/aggregates`, POST, PATCH, DELETE.
- Positive control (member is not 403).
- `no-store` + `Vary: Authorization` header assertion.

### E2E (new layer):

- Login-redirect smoke (stubbed SSO lands on `/app`).
- Two-context cross-account golden flow with Polish + `DD.MM.YYYY` DOM
  assertions.

### Manual Testing Steps:

1. Run `npm test` (backend) and confirm new isolation/auth/header tests.
2. Run `npm run e2e` headless; confirm smoke + golden flow pass.
3. Run `npm run e2e --headed` once; visually confirm two distinct sessions.
4. Set `AUTH_TEST_MODE=1 NODE_ENV=production` and confirm the server refuses to
   boot.

## Performance Considerations

E2e adds a browser-bound suite; keep it to the two specs (smoke + golden flow)
to bound runtime. Backend integration and unit tests remain in the fast
existing suite. No production hot path changes.

## Migration Notes

No schema changes. The only production-surface change is the auth seam, which
must be inert without the env flag and must refuse to boot if the flag is set
under production (Phase 2 boot guard). Document the new env var in the
deployment doc.

## References

- Change brief: `context/changes/e2e-golden-flow-test/change.md`
- Research: `context/changes/e2e-golden-flow-test/research.md`
- Test plan (Phase 1 source): `context/foundation/test-plan.md` §2–§3, §6.3
- Membership guard: `wedding-planner/backend/src/middleware/wedding-member.js:24-34`
- Auth (JWKS): `wedding-planner/backend/src/middleware/jwks-auth.js:30-56`
- Cache headers: `wedding-planner/backend/src/server.js:44-48`
- Test harness: `wedding-planner/backend/test/helpers/http-app.js:30-101`
- FE SSO wrapper: `wedding-planner/frontend/src/app/core/services/auth.service.ts:12-97`
- FE route guard: `wedding-planner/frontend/src/app/core/guards/auth.guard.ts:6-27`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Backend integration — isolation 403 + 401 auth + header contract

#### Automated

- [x] 1.1 Backend suite passes: `npm test` in `wedding-planner/backend`
- [x] 1.2 `isolation-gate.test.js` asserts 403 on GET `/`, GET `/aggregates`, POST, PATCH, DELETE as `sso-b`
- [x] 1.3 Positive control (`sso-a` not 403) passes in the same file
- [x] 1.4 `jwks-auth.test.js` asserts 401 for missing / expired / malformed tokens and `next()` for valid
- [x] 1.5 Cache-header assertion (`no-store` + `Vary: Authorization`) passes
- [x] 1.6 No network calls occur during the suite (JWKS not contacted)

#### Manual

- [x] 1.7 Test/file counts increase as expected; no time-bomb dates introduced

### Phase 2: Backend test-auth seam (`AUTH_TEST_MODE`, prod-safe)

#### Automated

- [ ] 2.1 Backend suite passes: `npm test` in `wedding-planner/backend`
- [ ] 2.2 Seam accepts a valid locally-signed token (correct `req.user`) when enabled
- [ ] 2.3 Seam rejects a wrong-signature token with 401 when enabled
- [ ] 2.4 Boot guard throws when `AUTH_TEST_MODE` set under `NODE_ENV=production`
- [ ] 2.5 Live JWKS path unchanged when test mode off (existing tests pass)

#### Manual

- [ ] 2.6 Env contract documented; unset default is the live JWKS path
- [ ] 2.7 Inspection confirms no prod entrypoint reaches the seam without the env flag

### Phase 3: Playwright bootstrap + FE SDK stub

#### Automated

- [ ] 3.1 `npm run e2e` boots FE + BE and runs Playwright headless
- [ ] 3.2 Smoke spec passes: stubbed login lands on `/app` (no redirect to `/`)
- [ ] 3.3 `npx playwright install` documented as a prerequisite

#### Manual

- [ ] 3.4 BE under e2e runs with `AUTH_TEST_MODE` and is confirmed not reachable as prod
- [ ] 3.5 SSO stub requires no network to `kubitksso.pl`
- [ ] 3.6 Smoke run deterministic across 3 consecutive runs (no flake)

### Phase 4: Golden-flow e2e + cookbook / test-plan backport

#### Automated

- [ ] 4.1 `npm run e2e` passes including `golden-flow.spec.ts`
- [ ] 4.2 Two-context test: B's page renders A's guest after fresh load
- [ ] 4.3 Polish validation/feedback copy asserted in the DOM
- [ ] 4.4 `DD.MM.YYYY` formatting asserted in the DOM
- [ ] 4.5 Full backend suite (`npm test`) and frontend unit suite (`ng test`) still green

#### Manual

- [ ] 4.6 Golden-flow run deterministic across 3 consecutive runs (no flake)
- [ ] 4.7 test-plan §6.3, §6.6, §3 Phase 1 (`integration + e2e`, `complete`), §2 note updated and consistent
- [ ] 4.8 Visual confirmation in `--headed` mode that B loads a separate session
