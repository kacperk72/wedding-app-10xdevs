---
bootstrapped_at: 2026-05-19T00:00:00Z
starter_id: angular
starter_name: Angular
project_name: wedding-planner
language_family: js
package_manager: npm
cwd_strategy: native-cwd-with-target-override
bootstrapper_confidence: verified
phase_3_status: ok
audit_command: npm audit --json
---

## Hand-off

Read verbatim from `context/foundation/tech-stack.md`:

```yaml
starter_id: angular
package_manager: npm
project_name: wedding-planner
hints:
  language_family: js
  team_size: solo
  deployment_target: self-host
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: custom
  quality_override: false
  self_check_answers:
    typed: true
    from_official_starter: true
    conventions: true
    docs_current: true
    can_judge_agent: true
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: true
```

Body paragraph (`## Why this stack`):

> Solo developer shipping a Polish wedding-planner MVP in 3 weeks of after-hours work with a hard wedding-date deadline. The frontend stack is locked outside this selector via `wedding-planner-deployment.md` — Angular 20+ standalone with signals — matched here to the `angular` card (clears all four agent-friendly gates and bootstrapper-verified, so scaffolding will be smooth). Angular was the recommended-default `10x-astro-starter`'s competitor on the custom path because the project's other apps in the ecosystem (the sign-on admin SPA, the seating module being copied from a sibling app) are also Angular, giving cross-project consistency that overrides the "overkill for solo MVP" caveat in the card. Deployment is self-host on Hostinger Business via FTP for the SPA and SSH for the backend; CI runs on GitHub Actions with auto-deploy on merge. The backend (Express + Sequelize + MySQL, plus single-sign-on integration via the shared service at `kubitksso.pl`) is hand-rolled per the deployment doc, not scaffolded by this hand-off — Express fails `typed` and `convention_based` gates, so the project's instruction files (`CLAUDE.md` / `AGENTS.md`) will carry explicit middleware-order, error-handling, and validation conventions to compensate.

## Pre-scaffold verification

| Signal             | Value                                            | Severity | Notes                                                  |
| ------------------ | ------------------------------------------------ | -------- | ------------------------------------------------------ |
| npm package        | @angular/cli v21.2.11, published 2026-05-13      | fresh    | resolved from `npm view @angular/cli` (< 7 days old)   |
| GitHub repo        | not run                                          | n/a      | card.docs_url points to `https://angular.dev` (not github) |
| Local tooling      | Node v22.14.0, npm 11.13.0                       | ok       | both meet Angular 21 requirements                      |

## Scaffold log

**Deviation from default mechanic** — bootstrapper SKILL recipe says "scaffold into cwd" via `subdir-then-move`. User requested target `wedding-planner/frontend/` (a pre-existing empty subdir of cwd), so I overrode the strategy: ran Angular CLI directly with the `--directory` flag to land files in the chosen subdir, no temp dir, no merge step. Decision recorded with user confirmation before exec.

**Resolved invocation**: `npx @angular/cli new wedding-planner --directory wedding-planner/frontend --defaults --routing --style scss --skip-tests --ssr false`

**Strategy**: native-cwd-with-target-override (Angular CLI's `--directory` flag points at `wedding-planner/frontend/`; cwd is `10xdevs/`)

**Exit code**: 0

**Pre-flight files-to-touch**: target subdir was empty; no conflict matrix needed

**Files written by CLI** (21 files at `wedding-planner/frontend/` plus full `node_modules/`):

```
angular.json (2669 bytes)
package.json (915 bytes)
package-lock.json
README.md (1526 bytes)
tsconfig.json (937 bytes)
tsconfig.app.json (444 bytes)
tsconfig.spec.json (456 bytes)
.editorconfig (331 bytes)
.gitignore (666 bytes)
.vscode/extensions.json (134 bytes)
.vscode/launch.json (490 bytes)
.vscode/mcp.json (188 bytes)
.vscode/tasks.json (1020 bytes)
src/main.ts (228 bytes)
src/index.html (313 bytes)
src/styles.scss (81 bytes)
src/app/app.ts (310 bytes)
src/app/app.scss (0 bytes)
src/app/app.html (20446 bytes)
src/app/app.config.ts (324 bytes)
src/app/app.routes.ts (80 bytes)
public/favicon.ico (15086 bytes)
node_modules/ (512 dependencies installed via npm)
```

**Pre-existing files preserved**: cwd root files unchanged — `README.md`, `CLAUDE.md`, `wedding-planner-deployment.md`, `wedding-planner-koncepcja.md`, `prompt-prototyp-ui.md`, `.gitignore`, `docs/`, `context/`, `.claude/`, `.git/` all intact.

**Git init skipped**: Angular CLI detected the cwd is already under version control (`/c/Users/kacpe/Desktop/Aplikacje/10xdevs/.git/`) and skipped its own `git init`. Correct behavior — the wedding-planner project lives inside the existing repo.

## Post-scaffold audit

**Tool**: `npm audit --json` (run from `wedding-planner/frontend/`)

**Summary**: 0 CRITICAL, 0 HIGH, 0 MODERATE, 0 LOW

**Direct vs transitive**: not applicable — zero findings

**Dependency totals**: 512 total (10 prod, 503 dev, 127 optional, 3 peer)

#### CRITICAL findings

none

#### HIGH findings

none

#### MODERATE findings

none

#### LOW / INFO findings

none

## Hints recorded but not acted on

| Hint                       | Value                  |
| -------------------------- | ---------------------- |
| bootstrapper_confidence    | verified               |
| quality_override           | false                  |
| path_taken                 | custom                 |
| self_check_answers         | all five = true        |
| team_size                  | solo                   |
| deployment_target          | self-host              |
| ci_provider                | github-actions         |
| ci_default_flow            | auto-deploy-on-merge   |
| has_auth                   | true                   |
| has_payments               | false                  |
| has_realtime               | false                  |
| has_ai                     | false                  |
| has_background_jobs        | true                   |

These hints surfaced during stack selection are preserved here so a future agent-context skill (e.g., M1L4 memory architecture) can act on them without re-running selection.

## Next steps

Next: a future skill will set up agent context (CLAUDE.md, AGENTS.md). For now, your project is scaffolded and verified — happy hacking.

Useful manual steps in the meantime:

- **Backend scaffold** (not done by this run, intentional): hand-build `wedding-planner/backend/` per `wedding-planner-deployment.md`. Express + Sequelize + MySQL skeleton + the SSO JWKS verification middleware from the deployment doc. Express fails 2/4 agent-friendly gates (typed, convention_based) — once the backend lands, plan to add a `CLAUDE.md` section documenting middleware order, error-handling pattern, and request-validation convention so the agent has a pattern to follow.
- **Update repo's root `CLAUDE.md`** with the actual project structure now that the Angular scaffold lives at `wedding-planner/frontend/` and the backend will land at `wedding-planner/backend/`. The existing `CLAUDE.md` referenced a hypothetical `apps/frontend`/`apps/backend` monorepo layout — that is now stale.
- **Update `README.md` link paths** — the existing root `README.md` referenced `docs/love-nest-co-lovable-app/` which was renamed to `docs/demo-app/` and now should also note the project lives at `wedding-planner/frontend/`.
- **Wire up SSO SDK** in `wedding-planner/frontend/src/index.html` (per `wedding-planner-deployment.md` § Integracja z SSO — frontend), and add the SSO interceptor + guard to the new Angular workspace (~15 lines per `SSO/angular-sdk/README.md`).
- **Smoke test the scaffold**: `cd wedding-planner/frontend && npm start` — should serve a blank Angular app at `http://localhost:4200`.
- **Address `04-database.md` doc drift** flagged in PRD Open Questions: the `wedding_members` n:m table reference needs to be replaced with two columns (`partner_a_user_id`, `partner_b_user_id`) on the `weddings` entity before any backend migration code lands.
