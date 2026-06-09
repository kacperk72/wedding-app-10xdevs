---
date: 2026-06-08 (Europe/Warsaw)
researcher: Claude (Opus 4.8)
git_commit: d51d8232a555ea5b27f79bee66ef90e5a3f0fa79
branch: main
repository: wedding-app-10xdevs (10xdevs/)
topic: "Ground rollout Phase 1 — E2E golden flow + isolation gate (risks #1, #2)"
tags: [research, codebase, auth, authorization, isolation, cross-account, e2e, testing]
status: complete
last_updated: 2026-06-08
last_updated_by: Claude (Opus 4.8)
---

# Research: E2E golden flow + isolation gate (test-plan Phase 1)

**Date**: 2026-06-08 (Europe/Warsaw)
**Researcher**: Claude (Opus 4.8)
**Git Commit**: d51d8232a555ea5b27f79bee66ef90e5a3f0fa79
**Branch**: main
**Repository**: wedding-app-10xdevs

## Research Question

Ground Phase 1 of `context/foundation/test-plan.md` against current code:
- **Risk #1 — per-wedding isolation breach**: a foreign SSO / cross-wedding identity must get **403** (not `[]`/404) on **read AND write**.
- **Risk #2 — cross-account stale read**: after refresh, partner B must see partner A's committed write.

For each: find the real failure path, quote the code, verify/correct the test-plan response guidance, locate existing tests, identify the cheapest useful test layer, and flag speculative risks or misleading hot-spot evidence.

## Summary

The findings produce **three load-bearing corrections** to the Phase 1 plan:

1. **Risk #1 (403 gate) is structurally present but has ZERO test coverage, and the cheapest layer is backend integration — not e2e.** `requireWeddingMember` throws `NotMemberError` (→403) before any handler runs, so 403-on-all-methods is guaranteed *if* the guard is mounted on each router (it is). The existing HTTP harness already supports multiple identities via the bearer-token arg, so covering #1 is a small, deterministic, dependency-free integration test. **No existing test exercises the non-member 403 path** — every current test calls as `sso-a` = `user-a`, who is always seeded as a member of `wedding-1`.

2. **Risk #2 (stale read) splits: its API half is near-tautological; its real signal is the browser layer.** The guest GET is **wedding-scoped, not user-scoped** (`.eq("wedding_id", ...)`), so "member B sees member A's guest" is architecturally guaranteed at the API — an API-level symmetry test is low-signal (implementation mirror). The genuine stale-read failure modes — HTTP caching and the Angular signal not refreshing on navigation — live at the browser/e2e layer. The backend already mitigates caching with `Cache-Control: no-store` + `Vary: Authorization` (server.js:44-48), which is cheaply assertable.

3. **The "new e2e layer" cost is real and gated on an auth-injection decision.** Frontend auth is fully delegated to an **external SSO SDK** (`window.SSOAuth` from `kubitksso.pl`); backend verifies RS256 via **live JWKS**. A hermetic CI e2e therefore needs BOTH a FE SDK stub AND a backend test-auth seam. This is the roadmap F-01 unknown ("test users vs mock JWT") and must be decided in `/10x-plan`.

**Net recommendation for `/10x-plan`:** carry **#1 at the backend integration layer** (cheap, high-value, fills a real gap; it is also the *sole* line of defense — see Architecture Insights re service_role/RLS). Carry the **#2-UI half + login redirect + Polish/`DD.MM.YYYY` DOM assertions at the browser e2e layer**, plus a cheap header-assertion for `no-store`/`Vary`. Update test-plan §3 Phase 1 "Test types" from `e2e` to **`integration + e2e`**.

## Detailed Findings

### Risk #1 — the isolation/403 path

**Auth (authentication) — `middleware/jwks-auth.js`**
- Verifies `Authorization: Bearer <token>` as RS256 against keys pulled from `JWKS_URL` (jwks-auth.js:8-15, 24, 40).
- Missing token → **401** (jwks-auth.js:34-38); expired/invalid → **401** (jwks-auth.js:42-49).
- On success attaches `req.user = decoded` with shape `{ userId, email, firstName, lastName, role, isActive, apps }` (jwks-auth.js:28-29, 51).
- **Does NOT check `apps`/audience.** A valid token minted by the SSO for *any* ecosystem app passes authentication. Therefore the "another app's user" defense is **not** at the auth layer — it rests entirely on membership (below). (jwks-auth.js has no reference to `apps`.)

**Authorization (membership) — `middleware/wedding-member.js`**
- `requireWeddingMember()` reads `req.params.weddingId`, maps the SSO payload to a local user via `getCurrentUser` → `ensureUserFromSsoPayload` (upsert by `sso_user_id`), then loads `wedding_members` by `(wedding_id, user_id)` (wedding-member.js:24-34).
- No membership row → `throw new NotMemberError()` (wedding-member.js:32).
- `NotMemberError` carries `status: 403` and `isDomainError: true` (errors/domain-errors.js:17-21); `error-handler.js:3-8` returns `err.status` for domain errors → **403** with `{ error: "You are not a member of this wedding" }`.
- **Side effect to know:** `ensureUserFromSsoPayload` *upserts* a `users` row for any valid token before the membership check (users.js:15-29), so even a rejected foreign user gets persisted as a `users` row. Not a leak, but a behavior.

**The guard runs before every handler, on every method** — `router.use(requireWeddingMember())` sits at the top of the resource router (guests.js:187), above GET `/aggregates`, GET `/`, POST `/`, POST `/:id/assign-table`, PATCH, DELETE. Combined with `requireSsoAuth` at the mount prefix (server.js:54), 403-for-non-members is structurally method-agnostic. So a non-member never reaches the list query → they get **403, never `[]`**.

**Why "empty list / 404 instead of 403" cannot happen for a non-member:** the 403 fires in middleware before the wedding-scoped query. The `[]`/404 outcomes only occur for a *member of wedding-1* reaching into another wedding's row through wedding-1's path (query filter finds nothing) — a different scenario, already covered (see existing tests).

### Risk #2 — the cross-account read path

**Backend read is wedding-scoped, not user-scoped** — guests GET filters `.eq("wedding_id", req.params.weddingId)` only (guests.js:205-208); no `user_id` filter anywhere. So *every* member of a wedding sees *all* that wedding's guests. "B sees A's guest" is therefore architecturally guaranteed at the API; a pure API symmetry assertion is close to an implementation mirror (low signal).

**Where the stale-read failure actually lives:**
- **HTTP caching** — mitigated centrally: `app.use("/api", ...)` sets `Cache-Control: no-store` and `res.vary("Authorization")` (server.js:44-48). This is cheaply assertable (header check) and is the real guard against a browser/CDN serving B a cached pre-write response.
- **Frontend signal refresh** — `GuestsService.list()` does `this._guests.set(guests)` on each GET (guests.service.ts:82-91); pages call `list()` on init. There is **no websocket/polling** — data is pull-on-load. So "after refresh B sees A's write" reduces to: B's page re-initialises → fresh GET → render. `create()` optimistically appends locally for the *acting* user only (guests.service.ts:99-108), so B genuinely depends on a re-fetch. This is the behavior an e2e must prove.
- **weddingId provenance** — `WeddingService.loadCurrent()` = `auth.me()` then GET `/weddings/:id` using `user.weddingId` from the `/me` payload (wedding.service.ts:43-57). For B to load wedding-1 at all, B's `/me` must report `weddingId = wedding-1`, i.e. B is a member.

### Frontend auth & routing (e2e surface)

- **External SSO SDK**: `AuthService` wraps `window.SSOAuth` (injected by a `<script>` from `kubitksso.pl/sdk/sso-sdk.js`); the SDK owns code exchange, CSRF state, refresh rotation (auth.service.ts:9-34). `token` = `sdk.getToken()`; `loginWithSso()` → `sdk.login(returnUrl)` (auth.service.ts:46, 93-97).
- **Route guard**: `/app/**` uses `authGuard` (app.routes.ts:23-27). It calls `ensureToken()` → no token ⇒ redirect `/`; then `ensureUser()` → no user ⇒ `/`; no `weddingId` ⇒ `/app/setup` (auth.guard.ts:12-26). So an e2e for B must satisfy: has token AND `/me` returns `weddingId`.
- **API base URL**: `apiUrl()` = `appEnv.apiBaseUrl + path` (http/api-url.ts:3-4) — cross-origin in prod; configurable for test.
- **Polish strings**: page-level user feedback is Polish toasts via `ToastService` (guests.page.ts:95,107,163,199,217 — "Nie udało się dodać gościa.", etc.). `DD.MM.YYYY` rendering is `formatDDMMYYYY` → `dd.mm.yyyy` (format/date.format.ts:1-8). **Note:** backend error messages are *inconsistently* localized (mix of English "Guest not found", "table is full" and Polish "To krzesło jest już zajęte") — so Polish-UI assertions must target the rendered DOM, not backend error bodies.

### Existing test coverage (what NOT to rebuild)

- **Harness** (`test/helpers/http-app.js`): boots the real Express app with two modules swapped in `require.cache` — `config/database` → in-memory mock, `middleware/jwks-auth` → `makeAuthMock` (http-app.js:35-46). `request(server, method, path, body, token="sso-a")` selects identity via the bearer string (http-app.js:53).
- **Auth mock** (`test/helpers/mock-supabase.js:1-17`): maps `sso-a→user-a`, `sso-b→user-b`, `sso-c→user-c`; accepts *any* token string and synthesises `req.user` — faithfully mirroring that real auth doesn't gate by app. Default seed `wedding_members` = only `{wedding-1, user-a, partner_a}` (mock-supabase.js:379-386).
- **`resource-crud.test.js`** existing "cross-wedding" tests are **NOT** the membership gate:
  - "rejects guest foreign keys from another wedding" (line 195) → FK-contamination via `assertWeddingRecordExists`, returns 400.
  - "does not mutate vendors from another wedding" (line 325) → query-scoping: a *member of wedding-1* PATCH/DELETE on a wedding-2 row via wedding-1's path → 404 (filter finds no row).
  - Both call as `sso-a` (a member). **The `NotMemberError`/403 path is never hit.** ← the Risk #1 gap.
- Backend suite: **110 tests / 19 files**, runner `node --test test/*.test.js` (backend/package.json:10).
- Frontend: **15 tests / 3 specs** (formatters + `GuestsService`), runner `ng test` (Vitest via `@angular/build:unit-test`) (frontend/package.json:10-12). **No e2e framework, no Playwright** in devDependencies (frontend/package.json:39-46).

## Code References

- `wedding-planner/backend/src/middleware/jwks-auth.js:30-54` — RS256/JWKS verify; 401 paths; `req.user` shape; no `apps` check
- `wedding-planner/backend/src/middleware/wedding-member.js:24-34` — membership lookup → `NotMemberError` on miss
- `wedding-planner/backend/src/errors/domain-errors.js:17-21` — `NotMemberError` status 403
- `wedding-planner/backend/src/middleware/error-handler.js:3-8` — domain error → `err.status`
- `wedding-planner/backend/src/services/users.js:7-29` — SSO→local user upsert (side effect for non-members too)
- `wedding-planner/backend/src/server.js:44-48` — `Cache-Control: no-store` + `Vary: Authorization`
- `wedding-planner/backend/src/server.js:54` + `routes/guests.js:187` — `requireSsoAuth` at mount, `requireWeddingMember()` at router top
- `wedding-planner/backend/src/routes/guests.js:202-232` — wedding-scoped (not user-scoped) GET
- `wedding-planner/backend/test/helpers/http-app.js:35-53` — auth/db module-swap harness, token-as-identity
- `wedding-planner/backend/test/helpers/mock-supabase.js:1-17, 379-386` — token→user map; default single-member seed
- `wedding-planner/backend/test/resource-crud.test.js:195, 325` — existing FK/scoping tests (NOT the 403 gate)
- `wedding-planner/frontend/src/app/core/services/auth.service.ts:9-97` — external SSO SDK wrapper
- `wedding-planner/frontend/src/app/core/guards/auth.guard.ts:6-27` — token+user+weddingId gate
- `wedding-planner/frontend/src/app/core/services/guests.service.ts:82-108` — pull-on-load signal set; optimistic local append
- `wedding-planner/frontend/src/app/core/services/wedding.service.ts:43-57` — `loadCurrent` via `/me`.weddingId
- `wedding-planner/frontend/src/app/core/format/date.format.ts:1-8` — `formatDDMMYYYY`

## Architecture Insights

- **The Express membership guard is the SOLE authorization enforcement.** RLS is deny-all on every table, but the backend connects as `service_role`, which **bypasses RLS** (CLAUDE.md §Current stack; config/database.js comment lines 13-15). So if `requireWeddingMember` were bypassed or mis-mounted on a router, the DB would *not* catch it. This sharply raises the value of an explicit 403 integration test for Risk #1 — it guards the only gate that exists.
- **Identity is double-keyed:** SSO `userId` (string) → local `users.id` (uuid) via upsert; membership is on the local id. Tests must seed `wedding_members` against the *mapped* local id (`user-a`/`user-b` per the harness map), not the token string.
- **Pull-based consistency:** no realtime; cross-account propagation is entirely "re-GET on navigation" + `no-store`. This is the whole of the #2 mechanism.

## Cost × signal verdict (for `/10x-plan`)

| Risk | Cheapest layer with real signal | Why |
|---|---|---|
| **#1** 403 isolation (read+write) | **Backend integration** (existing harness) | Non-member token (`sso-b`, not seeded into wedding-1) → assert 403 on GET `/`, GET `/aggregates`, POST, PATCH, DELETE. Fills a real gap; guards the sole enforcement layer. ~dependency-free. |
| **#2** stale read — API symmetry | **Skip / minimal** | Architecturally guaranteed (wedding-scoped query); a pure symmetry assertion is an implementation mirror. At most: assert `no-store`/`Vary` headers (server.js:44-48). |
| **#2** stale read — UI re-fetch | **Browser e2e** (new layer) | The genuine failure (signal not refreshing / cache) only manifests in the browser: B navigates/reloads `/app/goscie` → A's guest renders. |
| US-01 format | **Browser e2e** (DOM) | Polish validation + `DD.MM.YYYY` must be asserted in rendered DOM, not backend strings (which are mixed-locale). |

**Verify-don't-accept outcomes vs the change brief:**
- "#1 on read AND write" — confirmed reachable and currently untested; cheapest at integration, not e2e. ✅ (refines brief)
- "#2 after refresh B sees A's write" — confirmed pull-on-load; real signal is browser, API half is low-signal. ⚠️ (refines brief — see Open Questions backport)
- "challenge logged-in implies authorized" — confirmed: auth ≠ membership, and auth doesn't even check `apps`. ✅

## Open Questions (decide in `/10x-plan`)

1. **E2E auth strategy (blocker for the e2e half).** Options: (a) real SSO test users at `kubitksso.pl` — needs admin provisioning, networked, flaky; (b) **hermetic stub** — Playwright `addInitScript` injects a fake `window.SSOAuth` returning a known token + a backend `AUTH_TEST_MODE` seam that accepts a locally-signed token (mirrors the existing `http-app.js` module-swap, but for a *running* server; must be impossible to enable in prod); (c) API-only "e2e" via the existing harness — rejected, doesn't cover #2-UI/login/format. **Recommend (b)** for CI determinism.
2. **Does real-JWKS authentication (401 paths) get any coverage?** Currently untested (harness swaps the module out). A thin unit test on `jwks-auth` with a locally-signed token + stubbed `getSigningKey` could cover 401/expired cheaply; or accept it as out-of-scope for Phase 1 (lower risk than the 403 authorization gate).
3. **Test-plan backport:** update §3 Phase 1 "Test types" `e2e` → `integration + e2e`, and note in §2 Risk Response Guidance that #1 is integration-cheap and #2's API half is low-signal (real signal is browser + header check). This is a Source/response-guidance edit only (no file anchors), allowed via the post-research backport path.

## Historical Context (from prior changes)

- `context/foundation/roadmap.md` F-01 (`e2e-golden-flow-test`) flagged the same two unknowns this research resolves: Playwright vs Cypress (→ Playwright, TS-native) and "test users in SSO vs mock JWT" (→ Open Question #1 here).
- `CLAUDE.md` §M2 documents the membership guard (`middleware/wedding-member.js`) and the invite/accept flow as the origin of the two-member model this isolation test depends on.

## Related Research

- None yet — this is the first research artifact under `context/changes/`. (`context/archive/` holds only a README.)
