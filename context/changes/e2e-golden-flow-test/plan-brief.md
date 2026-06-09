# E2E Golden Flow + Isolation Gate — Plan Brief

> Full plan: `context/changes/e2e-golden-flow-test/plan.md`
> Research: `context/changes/e2e-golden-flow-test/research.md`

## What & Why

Phase 1 of the frozen test-plan. Close two top risks and bootstrap the
project's first browser e2e layer: **(#1)** a foreign SSO / cross-wedding
identity must get **403** — not `[]`/404 — on read **and** write; **(#2)** after
a refresh, partner B must see partner A's exact committed write. These are the
product's headline guardrails ("izolacja per wesele", US-01 cross-account).

## Starting Point

Authorization rests on a single Express guard (`requireWeddingMember`) that
already returns 403 for non-members on every method — but **no test exercises
it** (all current tests run as a seeded member). The read is wedding-scoped, so
the API half of #2 is tautological; the real stale-read signal (signal re-fetch
+ caching) is browser-only. There is **no e2e framework today**, and both FE
(`window.SSOAuth` SDK) and BE (live JWKS) auth are external — a hermetic e2e
needs an injection seam on both sides.

## Desired End State

Backend integration proves the 403 gate (read+write parity), the 401 auth
boundary, and the `no-store`/`Vary` cache contract. A prod-safe backend
test-auth seam plus a Playwright + fake-`SSOAuth` harness lets a two-context
golden-flow e2e prove partner B sees partner A's guest after re-fetch, with
Polish copy and `DD.MM.YYYY` asserted in the DOM. The test-plan is backported
(`integration + e2e`, §6.3 cookbook filled).

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Risk #1 layer | Backend integration, not e2e | Guard fires before every handler; existing harness selects identity by token — cheap, fills the sole-enforcement gap | Research |
| Risk #2 layer | Browser e2e + cheap header check | API symmetry is an implementation mirror; real signal is signal-refresh/cache | Research |
| E2E auth | Hermetic stub (FE `addInitScript` + BE `AUTH_TEST_MODE`) | Deterministic, networkless CI; mirrors existing module-swap harness | Plan |
| Prod-safety | Env-gated + fail-closed + boot guard | A misconfig must crash loudly, not silently open an auth bypass | Plan |
| Cross-account proof | Two browser contexts in one test | Genuinely simulates two independent sessions — the true #2 scenario | Plan |
| Flow scope | Login → guest add → cross-account read (guests only) | Thin vertical slice covering #2-UI + US-01 without over-reaching | Plan |
| 401 coverage | Thin `jwks-auth` unit test | Cheaply closes a real gap the integration harness swaps away | Plan |
| E2E home | `wedding-planner/frontend/e2e/` | Co-located with the FE it drives; matches per-package tooling | Plan |
| Header check | Backend integration | Deterministic, fast, no browser needed | Plan |

## Scope

**In scope:** non-member 403 parity, 401 auth unit test, cache-header
assertion, prod-safe BE test-auth seam, Playwright + SSO stub, two-context
golden flow, Polish/`DD.MM.YYYY` DOM assertions, test-plan §3/§6 backport.

**Out of scope:** CI wiring (test-plan Phase 2), multi-resource e2e, real SSO
test users / live JWKS in CI, API-level #2 symmetry test, realtime,
`apps`/audience enforcement changes.

## Architecture / Approach

Cheapest-signal-first: Phase 1 lands all backend-integration value with zero new
infra. Phases 2–3 build the e2e enablement chain — a prod-safe BE seam that
accepts a locally-signed token, then Playwright with a fake `window.SSOAuth`
booting FE + BE. Phase 4 is the two-context golden flow plus the documentation
backport.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. BE integration | 403 gate + 401 auth + cache headers | Stubbing `jwks-auth` signing path without network |
| 2. Test-auth seam | Prod-safe `AUTH_TEST_MODE` backend seam | Prod-safety invariant must be airtight |
| 3. Playwright + stub | e2e harness + login smoke | FE+BE boot orchestration; flake |
| 4. Golden flow + backport | Two-context cross-account e2e + docs | Two-session determinism; DOM-targeted assertions |

**Prerequisites:** Phases 2–4 are sequential (each unblocks the next); Phase 1
is independent. `npx playwright install` before Phase 3.
**Estimated effort:** ~3–4 sessions across 4 phases.

## Open Risks & Assumptions

- The `jwks-auth` signing-key stub seam is determined at implementation time
  (module is constructed at load against `JWKS_URL`).
- E2e flake is the main risk for Phases 3–4; mitigated by deterministic stub
  tokens and the 3-run check.
- Assumes both `user-a` and `user-b` can be seeded as members of one wedding for
  the golden flow (else the route guard bounces B to `/app/setup`).

## Success Criteria (Summary)

- A non-member gets 403 on read and write; a member does not.
- Partner B sees partner A's committed guest after a fresh browser load.
- Polish validation and `DD.MM.YYYY` are visible in the rendered UI, and the
  backend test-auth seam cannot authenticate in production.
