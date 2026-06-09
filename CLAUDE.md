# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

**Implementation started.** The repo now contains `wedding-planner/frontend` and `wedding-planner/backend`. The backend is Express + Supabase Postgres and verifies the external SSO JWT through JWKS; authentication credentials and passwords stay in the separate SSO/MySQL app.

Concrete artifacts present:
- `docs/demo-app/01..05-*.md` — full spec (overview, frontend, backend, database, milestones M0–M10).
- `docs/menu/*.pdf` — real catering offer (Pałac Polanka 2026) used as the model for the universal catering schema.
- `wedding-planner-koncepcja.md` — validation against course requirements.
- `wedding-planner-deployment.md` — deployment and SSO integration plan (authoritative for hosting and environment variables).
- `prompt-prototyp-ui.md` — original Lovable prompt used to generate the visual prototype.
- `.claude/skills/app-reverse-engineer/` — the custom skill used to reverse-engineer the Lovable prototype into the `docs/demo-app/` spec.

Note: specs live in `docs/demo-app/`; screenshots are under `docs/demo-app/screenshots/`.

## Current stack — read before referencing any doc

`docs/demo-app/` was originally written around NestJS + Supabase auth. The current target keeps the Supabase/Postgres database, but auth is externalized to the existing SSO service:

| Layer | Choice |
|---|---|
| Frontend | Angular 20+ standalone + signals + SCSS (unchanged) |
| Backend | **Node.js + Express** on Hostinger Node.js app |
| Database | **Supabase Postgres** for all wedding-planner domain data |
| Auth | **External SSO at `kubitksso.pl`** — backend never sees passwords, only verifies RS256 JWT via JWKS (cached 1h). Sibling repo `SSO/` owns auth and uses MySQL internally. |
| Hosting | Hostinger Business: SPA via FTP to `wedding-planner-kubitk.pl`, backend as Node.js app on same host, database in Supabase |
| CI/CD | GitHub Actions (FTP-Deploy for FE, SSH for BE) |

**Implication for the docs:** UI/data-model/feature scope in `docs/demo-app/` is authoritative. Anything about NestJS modules or local password auth is stale — translate to Express routes/services plus JWKS-verified SSO identity. PostgreSQL DDL, triggers, and Supabase migrations are valid for the wedding-planner database. **RLS is enabled deny-all on every public table** (migration `20260524090000_rls_lockdown`); the backend talks to Postgres as `service_role` which bypasses RLS by default, so authorization is enforced in Express middleware (membership checks against `wedding_members`). `anon`/`authenticated` exist only as a safety net — no policies means every Data API call through those roles is denied. SECURITY DEFINER functions (`bootstrap_wedding`, `create_wedding_with_bootstrap`) have `EXECUTE` revoked from `PUBLIC` (migration `20260524093000_revoke_security_definer_from_public`); only `service_role` can call them.

## Sources of truth (priority order, when conflicts arise)

1. **`wedding-planner-deployment.md`** — deployment, auth, hosting decisions.
2. **`docs/demo-app/04-database.md`** — data model. Per `05-implementation-plan.md`: if implementation forces a schema change, update this doc *first*, then the migration, then the code. Don't leave drift.
3. **`docs/demo-app/01-overview.md`** — feature scope. **Anything not on the page/flow list there is scope creep** — open a question at the end of that file instead of guessing.
4. **`docs/demo-app/02-frontend.md`** and **`03-backend.md`** — component inventory, endpoint shapes. Stale on framework choice (see Stack pivot) but accurate on UI structure and resource semantics.
5. The live Lovable prototype at `https://love-nest-co.lovable.app/` — fallback when docs are ambiguous. Report discrepancies, don't silently guess.

## Project-specific conventions

- **Polski UI is not optional.** Labels, statuses, mock data, dates (`DD.MM.YYYY`), currency (`32 000 zł` with space as thousands separator) must be Polish from the first commit. Easier to write in Polish than to migrate enums later.
- **Visual tokens (locked):** bottle green accent `~#3F5C3A`, cream background `~#FAF7EE`, serif headings (Cormorant/Playfair), sans body (Inter/DM Sans), `rounded-2xl`, subtle shadows. Put into `wedding-planner/frontend/src/styles/_tokens.scss` and never hardcode.
- **One wedding, two accounts, symmetric CRUD.** Wedding is a first-class entity with two members via `wedding_members`. Both partners have identical permissions *except* hard-delete of the wedding itself, which is gated by `weddings.created_by_user_id` (the "founder"). Do not introduce asymmetric permissions for anything else.
- **Catering configurator is universal.** Couples enter their own venue's offer (CRUD) — no global marketplace. The PDF in `docs/menu/` is the *modeling reference*, not a hardcoded fixture. Schema must accept any package-based catering offer.
- **Tasks są w pełni manualne.** ⚠️ Wcześniejszy auto-task timeline (generowanie wstecz od `weddings.wedding_date` przez `task_templates`) został **usunięty** migracją `20260526150000_strip_task_auto` (zniknęły: trigger `tg_weddings_shift_auto_tasks` + funkcja `shift_auto_tasks_on_wedding_date_change`, tabela `task_templates`, kolumny `tasks.is_auto` i `tasks.template_id`). Decyzja produktowa z 2026-05-26 odwrócona — nie przywracaj auto-tasków bez zgody PO. `04-database.md` w części o auto-taskach jest w tym punkcie nieaktualny.
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

The current scaffold lives under `wedding-planner/`. Backend commands run in `wedding-planner/backend`; frontend commands run in `wedding-planner/frontend`.

When asked to start implementation:
1. Continue from `docs/demo-app/05-implementation-plan.md`, adapted to the existing folders: `wedding-planner/frontend` and `wedding-planner/backend`.
2. Backend implementation uses Express routes/services, Supabase JS service-role client, and JWKS auth middleware. Do not add Sequelize/MySQL to wedding-planner; MySQL belongs to SSO only.
3. The data model in `04-database.md` (24 tables including the catering subsystem — the original 25 minus `task_templates`, dropped by `strip_task_auto`) is the contract. Schema changes must round-trip into the Supabase migration and that doc.

**Implementation state:**
- M0/M1: complete (scaffold, schema, RLS lockdown, seed)
- M2: complete (SSO mapping via `services/users.js`, wedding bootstrap, invite/accept-invite flow as atomic PG RPCs, membership guard `middleware/wedding-member.js`)
- M3: complete end-to-end — backend (guests / meal-options / tables CRUD + `guest_aggregates` RPC) and frontend (login → SSO redirect → wedding-setup → guests page wired to `GuestsService`, settings page with meal-options + tables CRUD, dashboard with countdown + KPI bar from aggregates)
- M4: complete end-to-end — backend (vendors / contracts / payments routes with `syncContractStatus` business logic, `/upcoming-payments` and `vendors/missing` aggregate endpoints) and frontend (`VendorsService`, `ContractsService`, `PaymentsService`, vendors and contracts pages wired)
- M5: complete end-to-end — budżet (`routes/budget.js` + `routes/expenses.js`, `budget.service.ts`, `pages/budget`; planowany vs rzeczywisty z `budget_total` na `weddings`), `budget-crud.test.js`
- M6: complete end-to-end — catering (oferty/pakiety/dania/dodatki/wybór: `routes/catering-{offers,packages,dishes,addons,selection}.js`, `pages/catering` + 7 komponentów, `freeze-contract-dialog`), `catering-{offers,dishes,selection}-crud.test.js`
- M7: complete end-to-end — zadania (manualne — patrz uwaga o tasks wyżej) + spotkania (`routes/tasks.js`, `routes/meetings.js`, `pages/tasks`; spotkania renderowane na dashboardzie jako „upcoming"), `tasks-crud.test.js`, `meetings-crud.test.js`
- M8: complete end-to-end — seating + konflikty + wizualne przypisanie miejsc (`routes/seating.js`, `routes/seating-conflicts.js`, `pages/seating/{round-table,conflicts-panel}`, migracja `guest_seat_number`), `seating-crud.test.js`
- M9: complete — eksport JSON (pełny dump minus sekrety) i hard-delete wesela, `wedding-export.test.js`, `wedding-delete.test.js`
- M10 (polish / deployment): **częściowo** — front wdrożony (commity „deploy front fix"); brak końcowego audytu deploymentu/SSO end-to-end
- **Single source of truth o POSTĘPIE: `STATUS.md` w korzeniu repo.** Ten plik (`CLAUDE.md`) trzyma konwencje; bieżący stan modułów żyje w `STATUS.md`. Przy zmianie stanu aktualizuj `STATUS.md`, nie rozsiewaj statusu po docs.
- Test suite: **100 tests across 23 suites** (validation helpers, mappers with injected clock, error handler, invite flow, resource CRUD across guests/meal-options/tables/vendors/contracts/payments/budget/catering/tasks/meetings/seating with cross-wedding rejection + payment status sync, dashboard aggregate, wedding export/delete). Mock-Supabase + HTTP test harness in `test/helpers/`. **Uwaga na time-bomb testy:** dashboard/meetings seedują daty względem `now` (`isoDaysFromNow`/`dateDaysFromNow`) — nie wpisuj dat na sztywno, bo okno „upcoming" się przeterminuje i testy pójdą na czerwono (zdarzyło się 2026-05-31).

**Frontend wiring conventions:**
- `WeddingService` is the canonical source for `weddingId` — pages call `wedding.wedding()?.id` to scope subsequent API calls. `WeddingService.loadCurrent()` is idempotent and pulls from `GET /api/weddings/:id` after `AuthService.me()` resolves the membership.
- Per-resource services follow `GuestsService` shape: signal of cached list, `list/create/update/remove` returning Observable that updates the signal via `tap()`. Aggregates (`GuestsService.loadAggregates`) call dedicated backend endpoint and fall back to client-side derivation only until the server response arrives.
- Cross-resource FK checks on the BE (e.g. `contracts.vendor_id`) are enforced via `assertWeddingRecordExists` helper. **Always filter cross-table joins by IDs (`.in("vendor_id", ids)`) — never `select *` without filter on a globally-scoped table**, even with `service_role`. Two perf bugs of this shape existed in M4 first iteration and were fixed; pattern is now consistent.

**Convention for new resources** (replicate this pattern when adding vendors / contracts / payments etc.):
1. New file `wedding-planner/backend/src/routes/<resource>.js` with `express.Router({ mergeParams: true })` and `router.use(requireWeddingMember())` at the top.
2. Mount in `server.js` under `/api/weddings/:weddingId/<resource>` with `requireSsoAuth` at mount level.
3. Add `map<Resource>` to `src/utils/mappers.js`.
4. Use `assertWeddingRecordExists(table, id, weddingId, label)` for any FK that crosses tables (prevents cross-wedding contamination).
5. Seed entries in `test/helpers/mock-supabase.js`'s `db` defaults if needed by tests; add HTTP tests to `test/resource-crud.test.js`.

**Migrations** (`wedding-planner/backend/supabase/migrations/`):
- `20260523233000_m1_schema_and_seed.sql` — full schema (25 tables, indexes, triggers, `bootstrap_wedding` / initial `create_wedding_with_bootstrap` RPCs, `task_templates` seed)
- `20260524090000_rls_lockdown.sql` — RLS enabled on all 25 public tables (deny-all for `anon`/`authenticated`), `search_path` pinned on all 8 custom functions
- `20260524093000_revoke_security_definer_from_public.sql` — `EXECUTE` revoked from `PUBLIC` on both initial SECURITY DEFINER RPCs
- `20260524120000_accept_partner_invite_rpc.sql` — atomic invite-acceptance RPC (`SELECT ... FOR UPDATE` on `partner_invitations`, `unique_violation` handler), returns jsonb `{status, error}` or success payload
- `20260524123000_create_wedding_with_bootstrap_json_errors.sql` — rewrites `create_wedding_with_bootstrap` to return the same jsonb `{status, error}` shape on failure instead of raising — Express handler keys off `data.error` consistently across both RPCs
- `20260524190000_guest_aggregates_rpc.sql` — `guest_aggregates(p_wedding_id)` RPC with `count(*) filter (where ...)` for KPI bar; consumed by `GET /api/weddings/:id/guests/aggregates` and `GuestsService.loadAggregates` on the dashboard
- `20260524193000_revoke_rpc_execute_from_client_roles.sql` — security hardening: `revoke execute ... from anon, authenticated` on all 4 SECURITY DEFINER RPCs. Required because Supabase auto-grants `EXECUTE` to `anon`/`authenticated` on every newly created function in `public` (for PostgREST `/rest/v1/rpc/*`); `revoke from public` alone doesn't undo those explicit role grants — without this migration, anyone with a publishable key could call sensitive RPCs directly
- `20260526120000_vendor_categories_rework.sql` — przebudowa kategorii kontrahentów (vendors)
- `20260526120500_payments_method.sql` — kolumna metody płatności na `payments`
- `20260526150000_strip_task_auto.sql` — **usuwa cały podsystem auto-tasków** (trigger, `task_templates`, kolumny `tasks.is_auto`/`template_id`) i przepisuje `bootstrap_wedding` bez seedowania tasków; tasks są odtąd manualne
- `20260526160000_wedding_budget_total.sql` — `budget_total` na `weddings` (planowany budżet całkowity dla M5)
- `20260526160500_drop_budget_planned_amount.sql` — usuwa nadmiarowe `planned_amount` (budżet planowany skonsolidowany w `weddings.budget_total`)
- `20260529120000_guest_seat_number.sql` — `seat_number` na `guests` dla wizualnego przypisania miejsc przy stołach (M8)

**Drift check (do this every session):** `mcp list_migrations` vs `ls wedding-planner/backend/supabase/migrations/`. Writing a migration without `npx supabase db push` is the most common mistake in this repo (currently **13 migrations** on disk). If counts disagree, the missing migration(s) need to be pushed before any code that depends on them is exercised.

To add a new migration: `npx supabase migration new <name>` from `wedding-planner/backend/`, write SQL, then `npx supabase db push`. The Supabase MCP plugin lets agents iterate via `execute_sql` and verify with `get_advisors` before committing to a migration file. **Do not use `apply_migration` MCP tool for iterative work — it writes history on every call and conflicts with `db pull`.**

## Parent repo context

This directory is a git submodule-like sibling inside `C:\Users\kacpe\Desktop\Aplikacje\` (a multi-project apps workspace with its own `CLAUDE.md`). That parent `CLAUDE.md` describes other apps in the workspace (Budget App, Car App, Grave App, the older Fit Seats wedding-seating planner, etc.) and a generic Angular convention set. This wedding-planner project is **independent** of those — same author, but its own git remote (`wedding-app-10xdevs`) and its own product. Don't import code or patterns from sibling projects unless explicitly asked.

<!-- BEGIN @przeprogramowani/10x-cli -->

## 10xDevs AI Toolkit - Module 3, Lesson 3

Lesson 3 is about **hooks** — turning the quality gates from Lesson 1 and the tests from Lesson 2 into automatic, deterministic checks that fire while the agent works. A hook runs outside the model, so it survives context compression, instruction changes, and the model "forgetting". The payoff for agentic hooks specifically: a `PostToolUse` check can feed its result back into the agent's context, so the agent fixes trivial errors (formatting, a missing import, a wrong type) on its own in the next iteration instead of you discovering them minutes later.

```
context/foundation/test-plan.md  (§4 Quality Gates: which check, required when)
        │
        ▼  (assign each gate to the cheapest layer that still gives signal)
   per-edit (agent hooks)  →  pre-commit (git hooks)  →  pre-push  →  CI
        │ lint, format, scoped tests          │ staged       │ heavier    │ integration
        ▼
   exit code + stdout  →  additionalContext  →  agent reacts next turn
```

### Task Router — Which layer for this check

| You want to | Do this |
| --- | --- |
| React the instant the agent edits a file | A per-edit hook (`PostToolUse` matcher `Write\|Edit` in Claude Code). Right for fast checks: lint/format, and scoped tests on risk-area files. This is the **only** layer that can hand feedback to the agent mid-session. |
| Run only the tests that depend on the edited file | Parse the path from the hook's stdin (`jq -r .tool_input.file_path`) and run your runner's related-tests mode (`vitest related "$FILE" --run`, `jest --findRelatedTests $FILE`). Gate it on whether the file is a risk area in `test-plan.md`; don't run tests on every helper or config edit. |
| Catch changes that bypassed the agent (manual edits, a teammate's commit) | A pre-commit git hook (Lefthook or Husky+lint-staged) over staged files: lint + typecheck, and tests on staged risk files. |
| Run heavier checks before code leaves the machine | Pre-push: full typecheck or a broader test set. Anything too slow for per-edit moves here. |
| Decide where a given gate belongs | Ask: is it fast enough (a few seconds) for per-edit, or should it wait for commit/push/CI? Slow checks block the agent loop on every edit — push them up a layer. |
| Use the same hook across tools | The trigger → matcher → handler → signal pattern is the same in Cursor, Codex, Windsurf, and Copilot; only the config file and event names change. See the cross-tool table below. |

### Hook lifecycle — the universal pattern

Every tool's hooks follow four steps:

1. **Trigger** — an event in the tool (e.g. the agent just saved a file: `PostToolUse`).
2. **Matcher** — a filter deciding whether this hook runs (tool name like `Write`/`Edit`, file type, or a name pattern).
3. **Handler** — the action that runs, usually a shell command.
4. **Signal** — the result returns to the tool. The exit code says pass/fail; stdout can flow into the agent's context as feedback.

### Exit codes and the feedback loop

- **0** — success; the hook passed, continue.
- **2** — blocking error; the agent sees the feedback and should react.
- **anything else** — non-blocking error; logged, but does not interrupt work.

On a blocking failure, stdout flows into the agent's context (in Claude Code via `additionalContext`, capped at 10,000 characters; other tools have similar mechanisms with their own limits). That is why the agent can self-correct: it sees the concrete message — missing type, unimported module, badly formatted line — not just "something failed".

The boundary: the agent reliably fixes **trivial** corrections on its own. When a test fails because of wrong business logic, the hook surfaces it but the agent may not diagnose the real cause — it says "something is off" and tries a trivial fix. If that does not resolve in one or two tries, the signal comes back to you, and the problem may deserve its own change-id with the full `/10x-new → /10x-research → /10x-plan → /10x-implement` workflow.

### Three local layers (plus CI)

| Layer | Catches | Timing |
| --- | --- | --- |
| Per-edit (agent hooks) | Formatting, simple type errors, failing unit tests on risk files. Only layer that feeds the agent mid-work. | ms–s |
| Pre-commit (git hooks) | What slipped past per-edit: manual edits, files changed outside the hook, checks too slow for per-edit. Operates on staged files. | s |
| Pre-push | Heavier checks before pushing to remote (full typecheck, broader test set). | s–min |
| CI | Integration problems, cross-module dependencies, checks needing infra unavailable locally. | min |

Local layers do **not** replace CI — CI stays the key verification for shared repo state and environments you don't control. But each local layer that catches an error is one fewer CI round-trip. You don't need all layers from day one: start with one per-edit hook (lint) and one commit gate, add layers as you see what escapes. The quality gates in `test-plan.md §4` decide which checks are worth automating and when; a plan may legitimately defer per-edit hooks if the cost/signal ratio isn't there yet.

### Key rules

- Keep per-edit hooks fast. If a check takes more than a few seconds, move it to commit, push, or CI — a slow per-edit hook blocks the agent loop on every edit. Lint/format are ideal per-edit; full typecheck is often a commit gate in larger projects.
- Run scoped tests, not the whole suite, per edit — only tests related to the edited file, and only when that file is a risk area in `test-plan.md`.
- `related` is a subcommand, not a flag (`vitest related`, not `--related`). Use `--run` so the hook terminates instead of entering watch mode.
- `PostToolUse` fires once per tool use; three edits in one turn fire it three times independently — there is no built-in aggregation.
- The git hook tool (Lefthook vs Husky+lint-staged) is an implementation detail; the rule is the same — run checks on staged files before commit. If Husky already works, don't migrate.
- **Context injection is not universal.** Claude Code, Cursor, Codex, and Copilot (in VS Code) can pass a hook's result to the agent; Windsurf cannot — it can block (exit 2) but can't tell the agent what went wrong.

### The same pattern in every tool

| Tool | Events | Handlers | Context injection | Config |
| --- | --- | --- | --- | --- |
| Claude Code | ~30 | command, http, mcp_tool, prompt, agent | yes | `.claude/settings.json` |
| Cursor | ~18 | command, prompt | yes | `.cursor/hooks.json` |
| Codex | 10 | command | yes | `.codex/hooks.json` |
| Windsurf | 12 | command | **no** | `.windsurf/hooks.json` |
| Copilot | ~13 | command, http, prompt | yes (VS Code) | `.github/hooks/*.json` |

### Lesson boundaries

- This lesson configures hooks and local quality layers only. The hook JSON, `lefthook.yml`, and the per-edit/commit/push layering are the scope.
- Do not write E2E tests, configure Playwright/MCP, or run browser scenarios. That is Lesson 4.
- Do not run the bug-to-fix-to-regression-test debugging workflow. That is Lesson 5.
- Do not change the risk strategy or quality-gate definitions. That is Lesson 1 (`/10x-test-plan`); read current state with `/10x-test-plan --status`.
- Do not write unit/integration test code from scratch here. That is Lesson 2 — hooks only *run* the tests those lessons produced.
- Do not author CI/CD pipelines. That is Module 1 Lesson 5 / Module 2 Lesson 5; hooks are the local layers in front of CI.

### Paths used by this lesson

- `.claude/settings.json` — hook configuration (`~/.claude/settings.json` global, `.claude/settings.json` project, `.claude/settings.local.json` local overrides). Other tools use their own config file (see the table).
- `lefthook.yml` — pre-commit git hook config (lint + typecheck + tests on `{staged_files}`).
- `context/foundation/test-plan.md` — §4 quality gates decide which checks to automate and at which layer; risk areas decide which edits warrant scoped tests.

<!-- END @przeprogramowani/10x-cli -->
