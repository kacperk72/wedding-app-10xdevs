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
