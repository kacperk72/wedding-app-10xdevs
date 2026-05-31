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

## 10xDevs AI Toolkit - Module 2, Lesson 3

Review AI-generated code before merge with the **implementation review chain**:

```
/10x-implement -> /10x-impl-review -> triage -> (/10x-lesson | fix | skip | disagree)
```

`/10x-impl-review` is the lesson focus. Review is a quality gate, not an instruction to fix every finding.

### Task Router - Where to start

| Skill | Use it when |
| --- | --- |
| **Code review (lesson focus)** | |
| `/10x-impl-review <change-id>` | You have implemented code and want a structured review before merge. The skill checks plan adherence, scope discipline, safety and quality, architecture, pattern consistency, and success criteria, then presents findings for triage. |
| **Recurring lesson outcome** | |
| `/10x-lesson` | A finding reveals a recurring project rule or agent failure pattern. Record it in `context/foundation/lessons.md` instead of treating it as a one-off note. |

### Triage discipline

- Severity says how bad the finding is. Impact says how much the decision matters now.
- Valid outcomes: fix now, fix differently, skip, accept as risk, record as recurring rule (`/10x-lesson`), disagree.
- Fix critical findings. Do not burn hours on low-impact observations just because the agent found them.
- Conscious skipping of low-impact findings is a valid review outcome, not negligence.
- If you disagree with a finding, record why. Wrong agent reasoning is also signal.

### Review boundaries

- This lesson reviews implemented code. It does not create the plan, execute new phases, or teach CI review.
- Testing strategy and quality gates are introduced in Module 3.
- Do not use `/10x-contract` as a triage outcome in this lesson.

### Paths used by this lesson

- `context/changes/<change-id>/plan.md` - expected implementation contract
- `context/changes/<change-id>/reviews/` - review output
- `context/foundation/lessons.md` - recurring lessons

Skills must not write to `context/archive/`. Archived changes are immutable; if a resolved target path starts with `context/archive/`, abort with: "This change is archived. Open a new change with `/10x-new` instead."

<!-- END @przeprogramowani/10x-cli -->
