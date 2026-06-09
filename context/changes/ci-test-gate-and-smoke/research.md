---
date: 2026-06-09T22:00:00+02:00
researcher: Codex
git_commit: 3f963002ac938c4e757e1f6dd4eff3a1ad736369
branch: main
repository: 10xdevs
topic: "CI test gate, migration drift guard, and smoke check"
tags: [research, codebase, ci, github-actions, supabase, e2e, deployment]
status: complete
last_updated: 2026-06-09
last_updated_by: Codex
---

# Research: CI test gate, migration drift guard, and smoke check

**Date**: 2026-06-09T22:00:00+02:00
**Researcher**: Codex
**Git Commit**: 3f963002ac938c4e757e1f6dd4eff3a1ad736369
**Branch**: main
**Repository**: 10xdevs

## Research Question

Ground `/10x-research ci-test-gate-and-smoke`: determine the current CI/deploy
shape, available test commands, lint/typecheck gaps, migration-drift options,
and smoke-check target for test-plan Phase 2 / roadmap F-02.

## Summary

F-02 is correctly the next quality rollout: F-01 shipped the hermetic Playwright
layer, but `.github/workflows/deploy.yml` still only installs the frontend,
runs a frontend-local `npm run lint --if-present`, runs frontend `test:ci`, builds,
and deploys the SPA by FTP. Backend tests, Playwright e2e, migration drift, and
post-deploy health smoke are not wired into CI.

The plan should split the work into four gates:

1. **Local deterministic gates**: backend `npm test`, frontend `npm run test:ci`,
   frontend build/typecheck, and Playwright `npm run e2e`.
2. **Lint baseline**: add explicit lint scripts/config instead of relying on
   `--if-present`.
3. **Networked drift gate**: compare local Supabase migration files against the
   applied remote migration state using Supabase credentials in GitHub Secrets.
   Do not implement this as a plain file count.
4. **Production smoke**: curl the real backend health endpoint after FTP deploy
   and assert HTTP 200 plus `status: ok` / `supabase: reachable`.

There is one important deployment caveat: the backend currently deploys by
Hostinger Git auto-pull on `main`, independent of GitHub Actions. With that
topology, CI can block frontend FTP deploy and produce a red signal, but it
cannot strictly prevent the backend from auto-pulling a bad commit after push.
A truly hard backend gate would require changing backend deployment topology.

## Detailed Findings

### Scope From Test Plan And Roadmap

- Test-plan Phase 2 is explicitly `CI gate + migration-drift guard + smoke` and
  covers Risk #3: migration authored on disk but not pushed before production
  code depends on it (`context/foundation/test-plan.md:49`,
  `context/foundation/test-plan.md:96`).
- The required gates after Phase 2 are lint/typecheck, backend unit/integration,
  frontend unit, migration drift, and pre-prod smoke (`context/foundation/test-plan.md:131`,
  `context/foundation/test-plan.md:132`, `context/foundation/test-plan.md:133`,
  `context/foundation/test-plan.md:135`, `context/foundation/test-plan.md:136`).
- The cookbook still has a deliberate blank for this work:
  `context/foundation/test-plan.md:173` says `Adding a quality gate /
  migration-drift check`, and `context/foundation/test-plan.md:174` is still TBD.
- Roadmap F-02 says this change should wrap the existing FTP pipeline, add ESLint,
  run backend tests and E2E, replace/no longer rely on placeholder testing, and
  add a health curl after deploy (`context/foundation/roadmap.md:97`,
  `context/foundation/roadmap.md:99`).
- F-02 unlocks S-05 production cutover (`context/foundation/roadmap.md:102`,
  `context/foundation/roadmap.md:163`, `context/foundation/roadmap.md:184`).

### Current GitHub Actions Workflow

- The current workflow is push-to-main plus manual dispatch only
  (`.github/workflows/deploy.yml:3`, `.github/workflows/deploy.yml:5`,
  `.github/workflows/deploy.yml:6`).
- The only job is named `Build & deploy Angular SPA` and sets the default working
  directory to `wedding-planner/frontend` (`.github/workflows/deploy.yml:15`,
  `.github/workflows/deploy.yml:19`).
- It installs only frontend dependencies with `npm ci`
  (`.github/workflows/deploy.yml:31`, `.github/workflows/deploy.yml:32`).
- It runs `npm run lint --if-present`, so lint is optional/no-op when no lint
  script exists (`.github/workflows/deploy.yml:34`, `.github/workflows/deploy.yml:35`).
- It runs frontend `npm run test:ci`, then production build
  (`.github/workflows/deploy.yml:37`, `.github/workflows/deploy.yml:38`,
  `.github/workflows/deploy.yml:40`, `.github/workflows/deploy.yml:41`).
- FTP deploy uses `SamKirkland/FTP-Deploy-Action@v4.3.5` and the three existing
  Hostinger FTP secrets (`.github/workflows/deploy.yml:43`,
  `.github/workflows/deploy.yml:44`, `.github/workflows/deploy.yml:46`,
  `.github/workflows/deploy.yml:47`, `.github/workflows/deploy.yml:48`).

Implication: the workflow must either remove the frontend-wide default working
directory and use per-step `working-directory`, or split into separate jobs for
backend/frontend/e2e/deploy. Otherwise backend install/tests and root-level checks
will be awkward.

### Available Test Commands

- Backend has a real test script: `node --test test/*.test.js`
  (`wedding-planner/backend/package.json:7`, `wedding-planner/backend/package.json:10`).
- Backend declares Node `>=22`, matching the workflow's Node 22 setup
  (`wedding-planner/backend/package.json:12`).
- Frontend has `test`, `test:ci`, and `e2e` scripts
  (`wedding-planner/frontend/package.json:10`,
  `wedding-planner/frontend/package.json:11`,
  `wedding-planner/frontend/package.json:13`).
- Frontend unit tests are Angular's unit-test builder with Vitest
  (`wedding-planner/frontend/angular.json:104`,
  `wedding-planner/frontend/angular.json:108`), with Vitest globals in
  `tsconfig.spec.json` (`wedding-planner/frontend/tsconfig.spec.json:7`,
  `wedding-planner/frontend/tsconfig.spec.json:8`).
- Playwright is installed as a frontend devDependency
  (`wedding-planner/frontend/package.json:44`).
- Playwright config boots both servers: backend at `http://localhost:3000/api/health`
  and frontend at `http://localhost:4200`
  (`wedding-planner/frontend/playwright.config.ts:20`,
  `wedding-planner/frontend/playwright.config.ts:22`,
  `wedding-planner/frontend/playwright.config.ts:24`,
  `wedding-planner/frontend/playwright.config.ts:36`,
  `wedding-planner/frontend/playwright.config.ts:37`).
- E2E backend runs hermetically with `NODE_ENV=test`, `DB_TEST_MODE=1`,
  `AUTH_TEST_MODE=1`, and `AUTH_TEST_SECRET`
  (`wedding-planner/frontend/playwright.config.ts:28`,
  `wedding-planner/frontend/playwright.config.ts:30`,
  `wedding-planner/frontend/playwright.config.ts:31`,
  `wedding-planner/frontend/playwright.config.ts:32`).
- E2E README confirms the suite needs no Supabase or live SSO access and is
  self-contained (`wedding-planner/frontend/e2e/README.md:33`,
  `wedding-planner/frontend/e2e/README.md:34`).

Implication: backend, frontend unit, build/typecheck, and e2e are safe to run
on every CI invocation once dependencies and Playwright browser binaries are
available.

### Lint And Typecheck Gap

- No ESLint config files were found by `rg --files -g 'eslint.config.*'
  -g '.eslintrc*'`.
- No package currently exposes a `lint` script. The workflow's current lint step
  therefore does not enforce a gate (`.github/workflows/deploy.yml:35`).
- Frontend type checking is effectively covered by Angular build and unit-test
  compilation: app build uses the Angular application builder
  (`wedding-planner/frontend/angular.json:43`), while unit tests use the unit-test
  builder (`wedding-planner/frontend/angular.json:104`).
- Backend is plain CommonJS JavaScript. There is no typecheck layer unless the
  plan adds ESLint and/or a JS typecheck mode.

Planning recommendation: add explicit package scripts instead of keeping
`--if-present`. A minimal first pass can use ESLint flat config. The plan must
decide whether lint is package-local (`backend/package.json`, `frontend/package.json`)
or rooted in a new workspace-level config. The current repo has no root
`package.json`, so package-local scripts are the smallest change.

### Migration Drift Guard

- The human convention today is manual: compare MCP `list_migrations` against
  local `wedding-planner/backend/supabase/migrations/` (`CLAUDE.md:113`).
- `CLAUDE.md:115` says new migrations are created and pushed from
  `wedding-planner/backend/` via Supabase CLI, and warns not to use MCP
  `apply_migration` for iterative work.
- The deploy plan says production schema is applied with `npx supabase db push`
  (`context/deployment/deploy-plan.md:53`, `context/deployment/deploy-plan.md:79`).
- There are currently 16 migration files on disk, including
  `20260609185950_vendor_status_rework.sql` (observed via `rg --files
  wedding-planner/backend/supabase/migrations`). Roadmap baseline still says 15
  migrations (`context/foundation/roadmap.md:67`), which is slightly stale after
  the vendor-status rework.
- Test-plan warns that a bad drift gate must not merely count files
  (`context/foundation/test-plan.md:72`).

Planning recommendation: implement a CI script that extracts local migration
versions from filenames and compares them to applied remote migration versions.
Prefer a Supabase CLI-backed check if available in the chosen CI environment;
otherwise use a small Node script with Supabase/Postgres credentials to query
the migration history table. This gate is inherently networked and should be
skipped for forked PRs without secrets, or run only on trusted branches/dispatch.

Open decision: which secret set should CI use for this check? Likely a
read-capable database URL or Supabase access token/project ref, not the local
`.env` file. Do not copy local secrets into source.

### Health Smoke Target

- The backend health route calls `isReachable()` and returns HTTP 200 when DB is
  reachable or 503 when degraded (`wedding-planner/backend/src/routes/health.js:2`,
  `wedding-planner/backend/src/routes/health.js:7`,
  `wedding-planner/backend/src/routes/health.js:8`).
- In real DB mode, `isReachable()` checks the `weddings` table through Supabase
  (`wedding-planner/backend/src/config/database.js:54`,
  `wedding-planner/backend/src/config/database.js:56`).
- The deployment plan says the backend is at
  `https://deeppink-mole-431102.hostingersite.com`
  (`context/deployment/deploy-plan.md:29`) and instructs smoke via
  `curl https://deeppink-mole-431102.hostingersite.com/api/health`
  (`context/deployment/deploy-plan.md:224`).
- The same deploy plan says frontend and backend are cross-origin, with frontend
  calls using the absolute backend URL (`context/deployment/deploy-plan.md:33`,
  `context/deployment/deploy-plan.md:175`).
- Roadmap F-02 says curl `/api/health` on
  `https://wedding-planner-kubitk.pl/api/health` (`context/foundation/roadmap.md:99`).
  That conflicts with the current cross-origin deployment doc unless a proxy or
  API subdomain is added.

Planning recommendation: use the backend Hostinger URL for the smoke check unless
the plan deliberately adds/provisions `api.wedding-planner-kubitk.pl` or a proxy
under the frontend domain. Assert both status code and JSON content, not just curl
exit success.

### Deployment Topology Caveat

- Operational deployment docs say backend is Hostinger Git auto-pull on `main`;
  GitHub Actions does not touch backend (`context/deployment/deploy-plan.md:23`,
  `context/deployment/deploy-plan.md:44`).
- They also say Hostinger installs backend dependencies and restarts the Node app
  after each push (`context/deployment/deploy-plan.md:209`).
- The old deployment doc still contains an SSH backend deploy workflow
  (`wedding-planner-deployment.md:213`, `wedding-planner-deployment.md:220`), but
  the operational deploy plan marks that as superseded by auto-pull
  (`context/deployment/deploy-plan.md:124`, `context/deployment/deploy-plan.md:126`).
- The roadmap acknowledges the current decision: run backend tests/lint/e2e in
  workflow, keep Hostinger auto-pull, and use CI as an OK/FAIL signal
  (`context/foundation/roadmap.md:108`).

Implication: under current topology, CI cannot strictly block backend auto-pull
after a bad push to `main`. It can block frontend FTP deploy and signal failure.
If the project needs a hard backend gate, the plan must change deployment topology
(for example disable auto-pull and trigger backend pull/restart only after CI
passes). That is larger than "wrap existing pipeline".

## Code References

- `.github/workflows/deploy.yml:19` - Workflow currently defaults all run steps
  to `wedding-planner/frontend`.
- `.github/workflows/deploy.yml:35` - Lint is optional via `--if-present`.
- `.github/workflows/deploy.yml:38` - Current test gate is frontend `test:ci`.
- `.github/workflows/deploy.yml:41` - Production Angular build runs before FTP.
- `.github/workflows/deploy.yml:43` - Frontend deploy starts after build.
- `wedding-planner/backend/package.json:10` - Backend test command.
- `wedding-planner/frontend/package.json:11` - Frontend CI unit test command.
- `wedding-planner/frontend/package.json:13` - Playwright e2e command.
- `wedding-planner/frontend/playwright.config.ts:20` - Playwright uses webServer
  to boot both backend and frontend.
- `wedding-planner/frontend/playwright.config.ts:28` - E2E backend uses
  `NODE_ENV=test`.
- `wedding-planner/frontend/playwright.config.ts:30` - E2E backend uses
  `DB_TEST_MODE=1`.
- `wedding-planner/frontend/playwright.config.ts:31` - E2E backend uses
  `AUTH_TEST_MODE=1`.
- `wedding-planner/backend/src/routes/health.js:8` - Health route returns 200 or
  503 based on Supabase reachability.
- `wedding-planner/backend/src/config/database.js:56` - Reachability checks the
  `weddings` table.
- `CLAUDE.md:113` - Current manual migration drift check.
- `context/deployment/deploy-plan.md:23` - Backend deploy is Hostinger auto-pull,
  not GitHub Actions.
- `context/deployment/deploy-plan.md:224` - Current operational health curl target.

## Architecture Insights

- The repo is not an npm workspace. Backend and frontend are separate packages.
  CI should either use separate jobs with separate caches or explicit
  `working-directory` per step.
- E2E is now a package-local frontend concern, but it boots backend too. Running
  it in CI requires installing both backend and frontend dependencies plus
  Playwright Chromium.
- The e2e suite is intentionally networkless. It should run before networked
  migration drift and production smoke, so failures are easier to diagnose.
- Migration drift is a release/infrastructure gate, not an application unit test.
  It should be designed around secrets availability and trusted CI contexts.
- The production smoke target is not the same as the Playwright webServer health
  URL. Playwright uses local `localhost:3000/api/health`; production smoke should
  hit the deployed backend URL.

## Historical Context

- F-01 explicitly left CI wiring out of scope:
  `context/archive/2026-06-08-e2e-golden-flow-test/plan.md:107`.
- F-01 chose the hermetic e2e auth approach: frontend `addInitScript` plus backend
  `AUTH_TEST_MODE`, documented in the plan brief at
  `context/archive/2026-06-08-e2e-golden-flow-test/plan-brief.md:37`,
  `context/archive/2026-06-08-e2e-golden-flow-test/plan-brief.md:39`.
- F-01 progress confirms Playwright bootstrap and golden-flow e2e are already
  complete (`context/archive/2026-06-08-e2e-golden-flow-test/plan.md:531`,
  `context/archive/2026-06-08-e2e-golden-flow-test/plan.md:545`).
- The same archived plan says the e2e cookbook was backported to the test plan
  (`context/archive/2026-06-08-e2e-golden-flow-test/plan.md:554`).

## Related Research

- `context/archive/2026-06-08-e2e-golden-flow-test/research.md` - Phase 1
  research that grounded the e2e/auth seams and isolation-gate coverage.
- `context/archive/2026-06-08-e2e-golden-flow-test/plan.md` - Implemented plan for
  the current Playwright and test-auth setup.
- `context/foundation/test-plan.md` - Frozen rollout strategy and quality-gate
  source of truth.

## Open Questions

1. Should F-02 keep backend Hostinger auto-pull and accept CI as a signal only,
   or should it change backend deploy to be CI-triggered after all gates pass?
2. Which production smoke URL is canonical: current backend Hostinger subdomain,
   a future `api.wedding-planner-kubitk.pl`, or frontend-domain `/api/health`
   behind a proxy?
3. Which Supabase credential shape should CI use for migration drift: Supabase
   CLI project/access-token secrets, a direct Postgres connection string, or a
   service-role based Node script?
4. Should lint be package-local first, or should this change introduce a root
   workspace/package to own shared scripts?
