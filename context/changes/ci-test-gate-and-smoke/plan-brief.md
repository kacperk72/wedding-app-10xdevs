# CI test gate and smoke - Plan Brief

> Full plan: `context/changes/ci-test-gate-and-smoke/plan.md`
> Research: `context/changes/ci-test-gate-and-smoke/research.md`

## What & Why

This plan turns F-02 into a concrete release gate: backend tests, frontend tests,
Playwright E2E, migration drift detection, and production health smoke all become
part of the deployment workflow. It exists because S-05 production cutover should
not happen while `main` can ship through a frontend-only CI path.

## Starting Point

The current GitHub Actions workflow installs only the frontend package, runs
optional lint, runs frontend unit tests, builds Angular, and deploys by FTP.
Backend deploy remains Hostinger Git auto-pull, and the backend health endpoint
lives at `https://deeppink-mole-431102.hostingersite.com/api/health`.

## Desired End State

Every push/manual deployment runs deterministic backend/frontend gates and
Playwright E2E before FTP deploy. Trusted CI also checks Supabase migration drift,
then a post-deploy smoke verifies the real backend health endpoint. The test plan
records the new quality-gate cookbook and marks Phase 2 complete.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Backend deploy topology | Keep Hostinger auto-pull | Smallest change and matches F-02; CI is a signal, not a hard backend blocker | User + Research |
| Smoke URL | `https://deeppink-mole-431102.hostingersite.com/api/health` | Backend stays on Hostinger subdomain; `wedding-planner-kubitk.pl` is frontend-only | User |
| Drift gate | Supabase CLI with `SUPABASE_ACCESS_TOKEN` and project ref | Matches current migration workflow and keeps secrets in GitHub | User + Research |
| Lint | Package-local configs/scripts | Repo has separate backend/frontend packages and no root workspace | User + Research |

## Scope

**In scope:**
- Backend and frontend lint scripts/configs.
- Backend, frontend, build, and Playwright gates in GitHub Actions.
- Supabase migration drift check using CI secrets.
- Backend Hostinger health smoke after deploy.
- Test-plan cookbook/status update.

**Out of scope:**
- Replacing Hostinger backend auto-pull with CI-triggered backend deploy.
- Root npm workspace setup.
- API proxy/subdomain changes.
- Sentry/UptimeRobot/observability.
- New product-domain tests for later test-plan phases.

## Architecture / Approach

Keep package-local ownership: backend commands run in `wedding-planner/backend`,
frontend and E2E commands run in `wedding-planner/frontend`. GitHub Actions
installs both packages, runs deterministic gates first, runs networked Supabase
drift only with secrets, deploys the frontend by FTP, then curls the real backend
health endpoint.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Package-local quality scripts | Real lint scripts/configs plus local command verification | Lint noise or accidental secret exposure |
| 2. Deterministic CI gates | Backend, frontend, build, and E2E before FTP deploy | Workflow ordering/caching mistakes |
| 3. Supabase drift gate | Remote migration comparison in trusted CI | Secrets/CLI access and false confidence from count-only checks |
| 4. Smoke + backport | Backend health smoke and test-plan Phase 2 completion | Wrong URL or documenting a stronger backend gate than exists |

**Prerequisites:** GitHub repository access to add `SUPABASE_ACCESS_TOKEN` and
`SUPABASE_PROJECT_REF` secrets before Phase 3 manual verification.

**Estimated effort:** 3-4 implementation sessions across 4 phases.

## Open Risks & Assumptions

- CI does not hard-block backend auto-pull under the current Hostinger topology.
- Supabase drift check depends on secrets being available in trusted CI.
- E2E stays narrow; a larger browser suite would slow deployment.

## Success Criteria Summary

- GitHub Actions runs backend, frontend, build, E2E, drift, deploy, and smoke in
  the intended order.
- Production smoke hits `https://deeppink-mole-431102.hostingersite.com/api/health`
  and verifies healthy JSON.
- `context/foundation/test-plan.md` Phase 2 and section 6.5 reflect the shipped
  quality-gate pattern.
