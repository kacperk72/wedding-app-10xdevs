# CI test gate and smoke - Implementation Plan

## Overview

F-02 hardens the release path for the wedding-planner by turning the current
frontend-only GitHub Actions workflow into a real quality gate. The change does
not alter product behavior. It makes the existing test base, the new Playwright
suite, migration drift detection, and production health smoke part of the release
ritual before S-05 production cutover.

The plan keeps the current deployment topology: frontend deploy is handled by
GitHub Actions FTP deploy, while backend deploy remains Hostinger Git auto-pull
on `main`. This means CI becomes a strong release signal and blocks frontend FTP
deploy, but it does not fully prevent Hostinger from auto-pulling backend code
after a bad push to `main`. Changing that topology is out of scope for this F-02
pass.

## Current State Analysis

- `.github/workflows/deploy.yml` runs only from `wedding-planner/frontend`, installs
  only frontend dependencies, runs `npm run lint --if-present`, runs frontend
  `test:ci`, builds the Angular SPA, and deploys by FTP.
- Backend has a real deterministic test command: `npm test` in
  `wedding-planner/backend`.
- Frontend has `npm run test:ci`, `npm run build-prod`, and `npm run e2e`.
- Playwright E2E is already hermetic: it boots backend with `DB_TEST_MODE=1` and
  `AUTH_TEST_MODE=1`, so it does not need Supabase or live SSO.
- There is no ESLint config and no package exposes a `lint` script today, so the
  current lint step is a no-op safety blanket.
- Migration drift is currently a manual convention: compare local migration files
  with applied remote migration state. The automated gate must compare versions,
  not just count files.
- Production smoke must target the backend URL
  `https://deeppink-mole-431102.hostingersite.com/api/health`. The
  `wedding-planner-kubitk.pl` domain is frontend-only and should not be treated as
  an API host.

## Desired End State

- Backend lint and tests run in CI.
- Frontend lint, unit tests, production build/typecheck, and Playwright E2E run
  in CI before FTP deploy.
- Migration drift is checked against the remote Supabase project using GitHub
  Secrets and fails when a local migration has not been applied remotely.
- Production smoke runs after FTP deploy and checks the deployed backend health
  endpoint for HTTP 200 plus healthy JSON.
- `context/foundation/test-plan.md` documents the quality-gate cookbook and marks
  Phase 2 complete when implementation lands.

## Key Decisions

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Backend deploy topology | Keep Hostinger auto-pull; CI is a signal, not a hard backend blocker | Matches roadmap F-02 and avoids reworking deployment credentials now | User + Research |
| Smoke URL | `https://deeppink-mole-431102.hostingersite.com/api/health` | This is the real backend host; `wedding-planner-kubitk.pl` is frontend-only | User + Research |
| Migration drift implementation | Supabase CLI in CI with `SUPABASE_ACCESS_TOKEN` and project ref secrets | Closest to the existing Supabase workflow and avoids source-controlled secrets | User + Research |
| Lint structure | Package-local scripts/configs | Repo has no root npm workspace; this is the smallest enforceable change | User + Research |

## Scope

### In Scope

- Add explicit lint scripts and lint configs for backend and frontend packages.
- Wire backend install, lint, and tests into GitHub Actions.
- Wire frontend lint, unit tests, production build, and Playwright E2E into GitHub
  Actions.
- Install Playwright Chromium in CI before E2E.
- Add a Supabase migration drift check based on remote applied migration state.
- Add production smoke against the deployed backend health endpoint.
- Update test-plan cookbook and Phase 2 status after the gates are implemented.

### Out Of Scope

- Disabling Hostinger backend auto-pull or replacing it with a CI-triggered SSH
  deploy.
- Introducing a root npm workspace/package.
- Moving the backend to `api.wedding-planner-kubitk.pl` or proxying `/api` through
  the frontend domain.
- Adding Sentry, UptimeRobot, or broader observability.
- Expanding product test coverage for risks #4-#7. Those remain later phases in
  `context/foundation/test-plan.md`.

## Phase 1: Package-local quality scripts and lint baseline

### Goal

Create real local gates for lint and make the CI commands explicit. This phase
removes the current `--if-present` ambiguity before the workflow starts enforcing
anything.

### Changes Required

#### 1. Backend lint script and config

**Files**:
- `wedding-planner/backend/package.json`
- `wedding-planner/backend/eslint.config.js` (new)
- `wedding-planner/backend/package-lock.json`

**Intent**: Add a backend `lint` script for CommonJS Node code and install the
minimal ESLint dependencies needed to run it locally and in CI.

**Contract**:
- `npm run lint` in `wedding-planner/backend` must lint `src/**/*.js` and
  `test/**/*.js`.
- The config must understand CommonJS globals and Node test files.
- It must not require a root package or workspace.

#### 2. Frontend lint script and config

**Files**:
- `wedding-planner/frontend/package.json`
- `wedding-planner/frontend/eslint.config.js` (new)
- `wedding-planner/frontend/package-lock.json`

**Intent**: Add a frontend `lint` script for Angular TypeScript and templates.
Use the Angular-compatible ESLint stack rather than generic TypeScript-only lint
that ignores templates.

**Contract**:
- `npm run lint` in `wedding-planner/frontend` must lint application TypeScript
  and Angular templates.
- The config must tolerate existing standalone Angular conventions.
- It must not mutate files; formatting remains separate from lint.

#### 3. Script naming consistency

**Files**:
- `wedding-planner/backend/package.json`
- `wedding-planner/frontend/package.json`

**Intent**: Make the commands that CI will call visible and stable.

**Contract**:
- Keep existing commands: backend `npm test`, frontend `npm run test:ci`,
  frontend `npm run build-prod`, frontend `npm run e2e`.
- Add only scripts needed by CI; avoid inventing a root-level orchestration script
  in this phase.

### Success Criteria

#### Automated Verification

- `npm run lint` passes in `wedding-planner/backend`.
- `npm test` passes in `wedding-planner/backend`.
- `npm run lint` passes in `wedding-planner/frontend`.
- `npm run test:ci` passes in `wedding-planner/frontend`.
- `npm run build-prod` passes in `wedding-planner/frontend`.

#### Manual Verification

- Review lint output/config to confirm it is a gate, not an auto-fixer.
- Confirm no local `.env` values or secrets are copied into package scripts or
  config files.

---

## Phase 2: Deterministic CI gates before frontend deploy

### Goal

Restructure `.github/workflows/deploy.yml` so deterministic checks run before
the FTP deploy step. This phase wires in checks that do not need production
network access or Supabase secrets.

### Changes Required

#### 1. Workflow working-directory structure

**File**: `.github/workflows/deploy.yml`

**Intent**: Stop assuming every command runs from `wedding-planner/frontend`.
Backend, frontend, and E2E setup need their own working directories.

**Contract**:
- Use explicit `working-directory` per `run` step, or split checks into jobs with
  explicit defaults.
- Keep Node 22.
- Cache both package lockfiles or use separate setup/cache blocks for backend and
  frontend.

#### 2. Backend install and deterministic checks

**File**: `.github/workflows/deploy.yml`

**Intent**: Add backend dependencies and tests to the release path.

**Contract**:
- Run `npm ci` in `wedding-planner/backend`.
- Run `npm run lint` in `wedding-planner/backend`.
- Run `npm test` in `wedding-planner/backend`.
- These steps must complete before FTP deploy.

#### 3. Frontend install and deterministic checks

**File**: `.github/workflows/deploy.yml`

**Intent**: Make frontend lint explicit and keep unit/build checks before deploy.

**Contract**:
- Run `npm ci` in `wedding-planner/frontend`.
- Run `npm run lint` in `wedding-planner/frontend`.
- Run `npm run test:ci` in `wedding-planner/frontend`.
- Run `npm run build-prod` in `wedding-planner/frontend`.
- Remove `--if-present` from the lint step.

#### 4. Playwright E2E in CI

**File**: `.github/workflows/deploy.yml`

**Intent**: Run the already-shipped golden-flow E2E suite in CI before deploy.

**Contract**:
- Install Playwright Chromium with the frontend package before `npm run e2e`.
- Run `npm run e2e` in `wedding-planner/frontend`.
- Preserve the hermetic setup from `playwright.config.ts`; do not add Supabase,
  SSO, or production credentials for E2E.
- E2E must run before FTP deploy.

### Success Criteria

#### Automated Verification

- Workflow YAML contains backend install/lint/test before FTP deploy.
- Workflow YAML contains frontend install/lint/test/build before FTP deploy.
- Workflow YAML installs Chromium before running `npm run e2e`.
- Workflow YAML runs `npm run e2e` before FTP deploy.
- Existing local commands from Phase 1 still pass.

#### Manual Verification

- Inspect the workflow ordering and confirm the FTP deploy action cannot run
  before deterministic gates finish.
- Confirm the backend auto-pull limitation remains documented in plan/research
  and is not accidentally presented as a hard backend deploy block.

---

## Phase 3: Supabase migration drift gate

### Goal

Automate Risk #3: fail CI when a migration exists on disk but is not applied to
the remote Supabase project. This is the networked gate and should be isolated
from hermetic tests.

### Changes Required

#### 1. Migration drift script

**Files**:
- `wedding-planner/backend/scripts/check-migration-drift.js` (new)
- `wedding-planner/backend/package.json`

**Intent**: Add a package-local script that compares local migration versions
against the remote applied migration list.

**Contract**:
- Local versions come from filenames in
  `wedding-planner/backend/supabase/migrations/*.sql`.
- Remote versions come from Supabase CLI output for the configured project.
- The script fails if any local version is missing remotely.
- The script must print the missing version(s) and filenames.
- The script must not compare only counts.
- The script must not read `wedding-planner/backend/.env` in CI.

Recommended package script name:

```json
"migration:check": "node scripts/check-migration-drift.js"
```

#### 2. Supabase CLI and CI secrets

**File**: `.github/workflows/deploy.yml`

**Intent**: Provide the script with a trusted remote migration state.

**Contract**:
- Use Supabase CLI in CI with GitHub Secrets.
- Required secrets:
  - `SUPABASE_ACCESS_TOKEN`
  - `SUPABASE_PROJECT_REF`
- The workflow must fail clearly when secrets are missing on trusted runs.
- The check may be limited to `push`/`workflow_dispatch` on this repo if PRs from
  forks cannot access secrets.

#### 3. Drift gate ordering

**File**: `.github/workflows/deploy.yml`

**Intent**: Run drift after deterministic local checks and before FTP deploy.

**Contract**:
- Run `npm run migration:check` in `wedding-planner/backend`.
- It must complete before FTP deploy.
- Keep this gate separate from Playwright E2E so network failures are easy to
  identify.

### Success Criteria

#### Automated Verification

- A fixture or dry-run path verifies the script detects a local version missing
  from a simulated remote list.
- `npm run migration:check` exists in `wedding-planner/backend/package.json`.
- Workflow passes Supabase token/project ref environment to the migration check.
- Workflow runs migration drift before FTP deploy.

#### Manual Verification

- Add the new GitHub Secrets in the repository settings.
- Trigger `workflow_dispatch` and confirm the drift step reaches the remote
  Supabase project and reports no missing migrations.

---

## Phase 4: Production smoke and test-plan backport

### Goal

Add the post-deploy smoke check and record the resulting quality-gate pattern in
`context/foundation/test-plan.md`.

### Changes Required

#### 1. Backend health smoke after FTP deploy

**File**: `.github/workflows/deploy.yml`

**Intent**: Verify the deployed backend is alive and connected to Supabase after
the release workflow completes the frontend deploy.

**Contract**:
- Add a step after FTP deploy that requests:
  `https://deeppink-mole-431102.hostingersite.com/api/health`.
- The step must fail unless HTTP status is 200.
- The step must assert JSON contains healthy backend state:
  - `status` equals `ok`
  - `supabase` equals `reachable`
- Do not use `https://wedding-planner-kubitk.pl/api/health`; that domain is
  frontend-only for this project.

#### 2. Quality-gate cookbook update

**File**: `context/foundation/test-plan.md`

**Intent**: Fill the cookbook section for adding future quality gates and drift
checks.

**Contract**:
- Replace `### 6.5 Adding a quality gate / migration-drift check` TBD with:
  - workflow location,
  - package-local script pattern,
  - required CI secret names,
  - command names,
  - smoke URL rule,
  - warning that Hostinger auto-pull means CI is not a hard backend deploy block.

#### 3. Phase 2 rollout status update

**File**: `context/foundation/test-plan.md`

**Intent**: Mark the Phase 2 test rollout complete once implementation and
verification pass.

**Contract**:
- In `## 3. Phased Rollout`, set Phase 2 status to `complete` and change folder
  to `context/changes/ci-test-gate-and-smoke/`.
- In `## 6.6 Per-rollout-phase notes`, add a Phase 2 note describing the shipped
  gates.
- Update the top `Last updated` line to mention Phase 2 completion.

### Success Criteria

#### Automated Verification

- Workflow contains a post-deploy health smoke step for
  `https://deeppink-mole-431102.hostingersite.com/api/health`.
- The smoke step validates both HTTP success and healthy JSON.
- `context/foundation/test-plan.md` has no TBD under section 6.5.
- `context/foundation/test-plan.md` marks Phase 2 complete.

#### Manual Verification

- Trigger `workflow_dispatch` after GitHub Secrets are configured and confirm all
  gates plus smoke pass.
- Confirm the smoke step hits the backend Hostinger URL, not the frontend domain.
- Confirm latest GitHub Actions run is green before using F-02 as a prerequisite
  for S-05 production cutover.

---

## Testing Strategy

### Unit Tests

- Add parser/fixture coverage for the migration drift script. Use a local fixture
  for remote migration output so the script's comparison logic can be tested
  without a live Supabase project.

### Integration Tests

- Existing backend `npm test` remains the backend integration suite.
- Existing frontend `npm run test:ci` remains the frontend unit/service suite.
- Existing `npm run e2e` remains the browser integration suite.

### CI Verification

1. Run backend `npm ci`, `npm run lint`, and `npm test`.
2. Run frontend `npm ci`, `npm run lint`, `npm run test:ci`, and
   `npm run build-prod`.
3. Install Playwright Chromium and run frontend `npm run e2e`.
4. Run Supabase migration drift on trusted CI with secrets.
5. Deploy frontend by FTP only after gates pass.
6. Run backend health smoke after deploy.

### Manual Testing Steps

1. Add `SUPABASE_ACCESS_TOKEN` and `SUPABASE_PROJECT_REF` in GitHub Actions
   secrets.
2. Trigger the workflow manually.
3. Verify the migration drift step connects to the correct Supabase project.
4. Verify the smoke step calls the backend Hostinger health URL.
5. Confirm all gates pass before treating F-02 as complete.

## Performance Considerations

- Playwright E2E will add CI time because Chromium must be installed and two
  local servers must boot. Keep the E2E suite narrow for now: smoke plus golden
  flow.
- Backend and frontend installs can be cached separately by lockfile. If CI time
  becomes painful, split backend/frontend checks into parallel jobs and keep the
  deploy job dependent on them.
- Migration drift is networked. Run it after deterministic local gates to avoid
  spending remote calls on commits that already fail locally.

## Migration Notes

No application schema migration is required for this change.

The migration-drift script is about release safety. It must never apply
migrations; it only compares local migration versions to remote applied versions
and fails with an actionable message.

## Rollback Plan

- If lint config causes too much noise, temporarily relax rules in the package
  configs rather than removing the `lint` scripts.
- If Playwright flakes in CI, keep backend/frontend deterministic gates and
  investigate E2E separately. Do not move E2E after FTP deploy.
- If migration drift cannot access Supabase because secrets are missing, add the
  missing GitHub Secrets or gate the step to trusted events only.
- If production smoke fails after deploy, treat the run as failed and use the
  existing rollback path from `context/deployment/deploy-plan.md`.

## References

- Research: `context/changes/ci-test-gate-and-smoke/research.md`
- Test plan: `context/foundation/test-plan.md`
- Roadmap F-02: `context/foundation/roadmap.md`
- Workflow: `.github/workflows/deploy.yml`
- Backend test script: `wedding-planner/backend/package.json:10`
- Frontend test/e2e scripts: `wedding-planner/frontend/package.json:11`,
  `wedding-planner/frontend/package.json:13`
- Playwright config: `wedding-planner/frontend/playwright.config.ts`
- Health endpoint: `wedding-planner/backend/src/routes/health.js`
- Deployment source of truth: `context/deployment/deploy-plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` - <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Package-local quality scripts and lint baseline

#### Automated

- [x] 1.1 Backend lint passes - f4a5407
- [x] 1.2 Backend test suite passes - f4a5407
- [x] 1.3 Frontend lint passes - f4a5407
- [x] 1.4 Frontend unit tests pass - f4a5407
- [x] 1.5 Frontend production build passes - f4a5407

#### Manual

- [x] 1.6 Lint is a gate, not an auto-fixer - f4a5407
- [x] 1.7 No secrets are copied into scripts or config - f4a5407

### Phase 2: Deterministic CI gates before frontend deploy

#### Automated

- [x] 2.1 Workflow runs backend install lint and tests before FTP deploy
- [x] 2.2 Workflow runs frontend install lint tests and build before FTP deploy
- [x] 2.3 Workflow installs Chromium and runs Playwright E2E before FTP deploy
- [x] 2.4 Local deterministic commands still pass

#### Manual

- [ ] 2.5 Workflow ordering prevents FTP deploy before deterministic gates
- [ ] 2.6 Backend auto-pull limitation remains explicit

### Phase 3: Supabase migration drift gate

#### Automated

- [x] 3.1 Migration drift comparison has fixture coverage
- [x] 3.2 Backend exposes migration check script
- [x] 3.3 Workflow passes Supabase secrets to drift gate
- [x] 3.4 Workflow runs drift gate before FTP deploy

#### Manual

- [ ] 3.5 GitHub Supabase secrets are configured
- [ ] 3.6 Workflow dispatch confirms no remote migration drift

### Phase 4: Production smoke and test-plan backport

#### Automated

- [x] 4.1 Workflow contains backend Hostinger health smoke
- [x] 4.2 Smoke validates HTTP 200 and healthy JSON
- [x] 4.3 Test-plan cookbook section 6.5 is filled
- [ ] 4.4 Test-plan Phase 2 is marked complete

#### Manual

- [ ] 4.5 Workflow dispatch passes all gates and smoke
- [ ] 4.6 Smoke target is confirmed as backend Hostinger URL
- [ ] 4.7 Latest GitHub Actions run is green before S-05 cutover
