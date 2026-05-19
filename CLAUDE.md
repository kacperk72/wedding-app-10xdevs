# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

**Pre-implementation.** This repo currently contains specification only — no `apps/`, no `packages/`, no `package.json`. Any "commands" (`pnpm dev`, `ng serve`, migrations) described in docs do not work yet; they describe the target after M0 scaffolding.

Concrete artifacts present:
- `docs/demo-app/01..05-*.md` — full spec (overview, frontend, backend, database, milestones M0–M10).
- `docs/menu/*.pdf` — real catering offer (Pałac Polanka 2026) used as the model for the universal catering schema.
- `wedding-planner-koncepcja.md` — validation against course requirements.
- `wedding-planner-deployment.md` — deployment and SSO integration plan (authoritative — supersedes Supabase mentions elsewhere; see Stack pivot below).
- `prompt-prototyp-ui.md` — original Lovable prompt used to generate the visual prototype.
- `.claude/skills/app-reverse-engineer/` — the custom skill used to reverse-engineer the Lovable prototype into the `docs/demo-app/` spec.

Note: `README.md` still references `docs/love-nest-co-lovable-app/` — that folder was renamed to `docs/demo-app/`. Trust the filesystem, not the README link paths.

## Stack pivot — read before referencing any doc

`docs/demo-app/` (especially `03-backend.md`, `04-database.md`, `05-implementation-plan.md`) was written assuming **NestJS + PostgreSQL + Supabase + JWT**. That stack was abandoned. The current target, set by `wedding-planner-deployment.md` (latest commit: "update(docs) - adapting the strategy to SSO"), is:

| Layer | Choice |
|---|---|
| Frontend | Angular 20+ standalone + signals + SCSS (unchanged) |
| Backend | **Node.js + Express + Sequelize** (not NestJS) on Hostinger Node.js app |
| Database | **MySQL** on Hostinger (not PostgreSQL/Supabase) |
| Auth | **External SSO at `kubitksso.pl`** — backend never sees passwords, only verifies RS256 JWT via JWKS (cached 1h). Sibling repo `SSO/` owns auth entirely. |
| Hosting | Hostinger Business: SPA via FTP to `wedding-planner-kubitk.pl`, backend as Node.js app on same host |
| CI/CD | GitHub Actions (FTP-Deploy for FE, SSH for BE) |

**Implication for the docs:** UI/data-model/feature scope in `docs/demo-app/` is still authoritative. Anything about NestJS modules, Supabase RLS, PostgreSQL triggers, or `pnpm` workspaces is **stale** — translate to Express controllers + Sequelize models + MySQL + plain npm. If the data model relies on Postgres-only features (RLS, triggers, enum types, `gen_random_uuid()`), reimplement that logic in Sequelize hooks / app-layer guards / lookup tables when porting.

## Sources of truth (priority order, when conflicts arise)

1. **`wedding-planner-deployment.md`** — deployment, auth, hosting decisions.
2. **`docs/demo-app/04-database.md`** — data model. Per `05-implementation-plan.md`: if implementation forces a schema change, update this doc *first*, then the migration, then the code. Don't leave drift.
3. **`docs/demo-app/01-overview.md`** — feature scope. **Anything not on the page/flow list there is scope creep** — open a question at the end of that file instead of guessing.
4. **`docs/demo-app/02-frontend.md`** and **`03-backend.md`** — component inventory, endpoint shapes. Stale on framework choice (see Stack pivot) but accurate on UI structure and resource semantics.
5. The live Lovable prototype at `https://love-nest-co.lovable.app/` — fallback when docs are ambiguous. Report discrepancies, don't silently guess.

## Project-specific conventions

- **Polski UI is not optional.** Labels, statuses, mock data, dates (`DD.MM.YYYY`), currency (`32 000 zł` with space as thousands separator) must be Polish from the first commit. Easier to write in Polish than to migrate enums later.
- **Visual tokens (locked):** bottle green accent `~#3F5C3A`, cream background `~#FAF7EE`, serif headings (Cormorant/Playfair), sans body (Inter/DM Sans), `rounded-2xl`, subtle shadows. Put into `apps/frontend/src/styles/_tokens.scss` and never hardcode.
- **One wedding, two accounts, symmetric CRUD.** Wedding is a first-class entity with two members via `wedding_members`. Both partners have identical permissions *except* hard-delete of the wedding itself, which is gated by `weddings.created_by_user_id` (the "founder"). Do not introduce asymmetric permissions for anything else.
- **Catering configurator is universal.** Couples enter their own venue's offer (CRUD) — no global marketplace. The PDF in `docs/menu/` is the *modeling reference*, not a hardcoded fixture. Schema must accept any package-based catering offer.
- **Auto-task timeline.** Tasks tagged `auto` are generated backward from `weddings.wedding_date` using `task_templates`. The original Postgres-trigger approach (`tg_weddings_shift_auto_tasks`) is no longer available on MySQL — reimplement as a Sequelize hook on `weddings.update` (or an explicit `POST /tasks/regenerate-auto` endpoint called from the date-change confirm dialog). Never touch completed tasks or manually-created tasks during regeneration; the operation must be idempotent.
- **Drag-and-drop needs a keyboard fallback.** Seating page uses `@angular/cdk/drag-drop`; an accessible alternative is a hard requirement, not a polish item.
- **Each milestone ships an end-to-end vertical slice.** M3 means "user sees the added guest in the UI", not "POST returns 201". Don't merge backend-only or frontend-only milestone completions.

## Resolved product decisions (don't relitigate)

From `05-implementation-plan.md` § Resolved decisions — already settled, don't propose alternatives unless the PO asks:
- Meal options live in a per-wedding `meal_options` table, edited in Settings, consumed as a dropdown in the guest editor.
- Symmetric partner CRUD; only `created_by_user_id` can hard-delete the wedding.
- JSON export is a full dump minus secrets (`password_hash`, invitation `token`).
- `diet` enum has 5 values: `pending` (default), `standard`, `vege`, `vegan`, `gluten_free`.
- Seating conflict reasons are free text.
- Meetings and tasks are independent entities — don't merge them in MVP.
- Hard-delete everywhere (no soft-delete in MVP).

## Working in this repo right now

Until the M0 scaffold lands, expected work is **documentation editing** and **planning**. There is no build, no test, no lint. Don't run install/build commands speculatively — they will fail.

When asked to start implementation:
1. Begin with M0 from `docs/demo-app/05-implementation-plan.md` — but adapt to the SSO/Express/MySQL stack (no NestJS, no Supabase migrations, no pnpm workspaces unless you're keeping pnpm only for the monorepo layout).
2. Before scaffolding, confirm with the user whether the monorepo structure (`apps/frontend`, `apps/backend`, `packages/shared-types`) still applies, since the deployment doc treats them as two independent Hostinger deploys.
3. The data model in `04-database.md` (23 tables including the catering subsystem) is the contract — port it to MySQL/Sequelize faithfully; any name/type adjustments must round-trip back into that doc.

## Parent repo context

This directory is a git submodule-like sibling inside `C:\Users\kacpe\Desktop\Aplikacje\` (a multi-project apps workspace with its own `CLAUDE.md`). That parent `CLAUDE.md` describes other apps in the workspace (Budget App, Car App, Grave App, the older Fit Seats wedding-seating planner, etc.) and a generic Angular convention set. This wedding-planner project is **independent** of those — same author, but its own git remote (`wedding-app-10xdevs`) and its own product. Don't import code or patterns from sibling projects unless explicitly asked.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit — Module 1, Lesson 3

Scaffold the project for the stack you picked in Lesson 2, with the **bootstrap chain**:

```
(/10x-init  →  /10x-shape  →  /10x-prd)  →  /10x-tech-stack-selector  →  /10x-bootstrapper
```

The PRD chain ships from Lesson 1 and the tech-stack-selector ships from Lesson 2 — both re-included in this lesson so you can fix the PRD or swap the stack mid-flight. `/10x-bootstrapper` is the lesson's main topic. The chain ends here in v1; a future Lesson 4 will set up agent context (`CLAUDE.md`, `AGENTS.md`).

### Task Router — Where to start

| Skill | Use it when |
| --- | --- |
| **Bootstrap (lesson focus)** | |
| `/10x-bootstrapper` | You have a hand-off at `context/foundation/tech-stack.md` (written by `/10x-tech-stack-selector`) and you are ready to scaffold the project into the current directory. The skill reads the hand-off, looks up the chosen card in the starter registry, runs its CLI through one of three cwd strategies (scaffold into a temp directory then move files up; scaffold directly into the current directory; clone a starter repo without keeping its git history), preserves `context/` always, sidelines other clashes as `.scaffold` siblings, runs a light pre-scaffold recency check and a deeper post-scaffold audit, and writes a verification log to `context/changes/bootstrap-verification/verification.md`. Use AFTER `/10x-tech-stack-selector`. |
| **Re-run upstream if needed** | |
| `/10x-init` / `/10x-shape` / `/10x-prd` / `/10x-tech-stack-selector` | Bundled so you can fix the PRD or swap the stack mid-flight. If `/10x-bootstrapper` surfaces a registry-drift refusal or you change your mind on the starter, re-run `/10x-tech-stack-selector` to regenerate `tech-stack.md` and re-invoke. |

### How the chain hands off

- `/10x-tech-stack-selector` (Lesson 2) writes `context/foundation/tech-stack.md` with a 4-key frontmatter (`starter_id`, `package_manager`, `project_name`, `hints`) plus a one-paragraph `## Why this stack` body.
- `/10x-bootstrapper` reads that file FULLY (no fallback to conversation history). If it is absent, the skill refuses with a one-sentence redirect to `/10x-tech-stack-selector` and stops — no inline mini-handoff, no standalone-mode in v1.
- The chosen `starter_id` is looked up in `packages/ai-artifacts/skills/10x-tech-stack-selector/references/starter-registry.yaml`. The skill consumes that registry; it does not own it. A CI validator (`scripts/validate-starter-registry-sync.mjs`) prevents bootstrapper from referencing a `starter_id` absent from the registry.
- The skill writes `context/changes/bootstrap-verification/verification.md` as the audit-trail log for the run. Schema in `packages/ai-artifacts/skills/10x-bootstrapper/references/verification-log-schema.md`.

### What bootstrapper captures (and what it does NOT)

- **Captured (v1)**: scaffold via the chosen card's `cmd_template` (CLI delegation, not inline file generation), three cwd strategies dispatched from `bootstrapper-config.yaml` (`subdir-then-move`, `native-cwd`, `git-clone`), strict conflict policy producing `.scaffold` siblings + always preserving `context/`, two verification slots (light pre-scaffold recency check + deep post-scaffold language-aware audit), severity-tiered audit summary, full verification log on disk.
- **NOT captured in v1 (deliberate)**: `AGENTS.md` / `CLAUDE.md` generation (deferred to a future Lesson 4 — "Memory Architecture"); per-starter cert-element placement overlays (live with the future agent-context skill, not here); CI workflow files; AI-as-bridge fallback for stacks outside the registry (deferred to v2 — in v1 chain-mode tech-stack-selector already gates on the registry, so the case cannot arise); standalone-mode where the user names a stack inline without a hand-off (deferred to v2); compensation actions for `bootstrapper_confidence: best-effort` or `quality_override: true` (surfaced in conversation but no automated follow-up — that, too, is the future memory-architecture skill's job).

### The conflict policy

When the skill moves files from a temp scaffold directory up into your current working directory, it applies a strict matrix:

- **`context/**`** — anything the scaffold tried to write under `context/` is **dropped**. Your `context/` is the source of truth for the bootstrap chain (PRD, tech-stack hand-off, plans, frames) and is never overwritten.
- **`.gitignore`** — append-merged: your existing lines stay in order, then the scaffold's lines are de-duped against your set and appended with a separator comment. Git's ignore semantics are additive, so combining is safe.
- **`package.json`, `README.md`, `CLAUDE.md`, `AGENTS.md`, root-level `*.md`** — your existing file wins; the scaffold's copy lands as `<filename>.scaffold` sibling. You can `diff README.md README.md.scaffold` to see what the starter shipped vs what you had.
- **Anything else** — moves silently if no conflict, sidelined as `<filename>.scaffold` if there is one. The matrix never deletes user files.

For the `git-clone` strategy (10x-astro-starter and similar): the cloned `.git/` is deleted before move-up, so the upstream starter's history does not leak into your repo. You initialise your own history afterwards (`git init`).

### Verification log

Every run writes `context/changes/bootstrap-verification/verification.md`. Sections:

- **`## Hand-off`** — verbatim copy of the tech-stack.md frontmatter and `## Why this stack` body.
- **`## Pre-scaffold verification`** — recency findings table (npm package version + `time.modified` for JS starters; GitHub `pushed_at` for any starter with a GitHub `docs_url`).
- **`## Scaffold log`** — the resolved CLI invocation, exit code, files moved, conflicts surfaced as `.scaffold` siblings, `.gitignore` handling.
- **`## Post-scaffold audit`** — full per-language audit output (`npm audit --json` for JS, `pip-audit` for Python, `cargo audit` for Rust, etc.). Severity-tiered: CRITICAL and HIGH surfaced inline in chat, MODERATE and LOW log-only. Direct-vs-transitive split where the tool supports it.
- **`## Hints recorded but not acted on`** — every hint from the hand-off bootstrapper read but did not act on in v1. Audit-trail completeness for the future memory-architecture skill.
- **`## Next steps`** — pointer text. v1 names "your project is scaffolded and verified — happy hacking" and flags the future Lesson 4 skill as the next chain link.

The folder (`context/changes/bootstrap-verification/`) deliberately has no `change.md`. Bootstrap runs are one-shot artifacts, not tracked workflow changes — the folder hosts the log and nothing else. Re-runs apply a warn-and-confirm guard before overwriting; the escape hatch is `verification-v2.md` (and so on).

### Foundation paths used by this lesson

- `context/foundation/tech-stack.md` — input (from Lesson 2)
- `context/changes/bootstrap-verification/verification.md` — output (the audit-trail log)
- `context/foundation/lessons.md` — recurring rules & pitfalls
- `docs/reference/contract-surfaces.md` — load-bearing names registry

### Universal language

The shipped skill carries no 10xDevs / cohort / certification references. The post-scaffold audit dispatches by `language_family` against a small lookup table; cohorts whose stack lands in `java`, `php`, `dart`, or a multi-language combination see a "no built-in audit tool for this ecosystem" log line and a recommended external tool, not a fake "0 findings" record.

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
