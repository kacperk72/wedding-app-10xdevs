# Implementation Plan — {{APP_NAME}}

> **TL;DR**: Step-by-step plan to rebuild {{APP_NAME}} in the user's preferred stack (Angular 20+ standalone + NestJS/Express + Postgres). Sequenced so each milestone produces a working slice.

This plan assumes you've read `01-overview.md`, `02-frontend.md`, `03-backend.md`, and `04-database.md`. It deliberately *doesn't* repeat those — it just sequences the work.

---

## Project setup (M0)

Goal: an empty project that builds and runs.

- [ ] Initialize repo (`pnpm init` or `npm init`); set up monorepo if endpoint count > ~10 or pages > ~5
- [ ] Scaffold backend
  - [ ] `nest new apps/backend` (or `express-generator` for small surfaces)
  - [ ] Configure `ValidationPipe` globally; install `class-validator`, `class-transformer`
  - [ ] Set up `@nestjs/config` with `.env` loading; commit `.env.example`
- [ ] Scaffold frontend
  - [ ] `ng new apps/frontend --standalone --style=scss --routing`
  - [ ] Set OnPush as default; configure `provideRouter`, `provideHttpClient`
- [ ] Set up shared types package (if using monorepo)
- [ ] Configure linter + Prettier (100-char width, single quotes — matches repo convention)
- [ ] Set up Postgres locally (Docker compose) or point to a Supabase project
- [ ] CI (optional but recommended): lint + typecheck + test on push

**Done when**: `npm run dev` starts both apps; frontend at :4200 calls a `/api/health` endpoint on the backend.

---

## Database (M1)

Goal: schema applied, seed data loaded, RLS in place if Supabase.

- [ ] Translate `04-database.md` DDL into a migration tool (Supabase migrations / Prisma / Knex / TypeORM — pick one, stick with it)
- [ ] Apply schema to local DB
- [ ] Apply RLS policies if using Supabase
- [ ] Write a seed script with at least: 2 users, 2 projects per user, ~10 tasks per project
- [ ] Verify with a SQL query that all FKs and CHECK constraints are in place

**Done when**: a fresh checkout can run one command to get a working populated DB.

---

## Auth (M2)

Goal: a user can register, log in, refresh, log out — and protected endpoints reject unauthenticated requests.

Backend:
- [ ] `POST /api/auth/register` — hash password (`argon2` or `bcrypt`), insert user, return tokens
- [ ] `POST /api/auth/login` — verify, return access + refresh tokens
- [ ] `POST /api/auth/refresh` — rotate refresh, issue new access
- [ ] `POST /api/auth/logout` — invalidate refresh token
- [ ] `JwtAuthGuard` (or Express middleware) gating protected routes
- [ ] `@CurrentUser()` decorator (Nest) or `req.user` middleware (Express)

Frontend:
- [ ] `AuthService` — `signal<User|null>`, `login()`, `logout()`, `refresh()`
- [ ] HTTP interceptor: attaches `Authorization` header; on 401, attempts a single refresh, retries
- [ ] `LoginPage` + `RegisterPage` (or modal — match the original)
- [ ] Route guards: redirect unauthenticated users to `/login`

**Done when**: signing in stores the user and unlocks `/dashboard`; refreshing the page keeps the session; logout clears it.

---

## Core resources (M3..)

One milestone per major resource. Each milestone produces a working backend + frontend slice for that resource. Order resources by dependency — entities others depend on first (`projects` before `tasks` before `comments`).

For *each* resource, the standard checklist:

### Backend
- [ ] DTOs for create/update with `class-validator` decorators (or express-validator chains)
- [ ] Service: list (with pagination/sort/filter), get, create, update, delete — enforcing tenant ownership
- [ ] Controller: maps DTOs → service; returns shape matching `03-backend.md`
- [ ] Tests: at least one happy-path test per endpoint

### Frontend
- [ ] API client function per endpoint (typed via shared types)
- [ ] Page components for list and detail views
- [ ] Form component(s) for create/edit, wired to the API
- [ ] State: signals on the page; cross-page state via a service signal
- [ ] Empty / loading / error states for each list and detail

### Resource roadmap

Replace this placeholder with the actual resources from `04-database.md`, sequenced.

- [ ] M3 — `projects`
- [ ] M4 — `tasks`
- [ ] M5 — `project_members` + invites
- [ ] {{...}}

---

## Cross-cutting concerns (M{{N}})

Tackle once the core resources work end-to-end. Splitting them out keeps M3/M4 small.

- [ ] Toasts / notifications service on frontend
- [ ] Error handling: backend `HttpException` filter; frontend interceptor mapping errors to toasts
- [ ] Loading skeletons / spinners for slow lists
- [ ] Empty-state illustrations for first-run UX
- [ ] Accessibility pass: keyboard nav, focus traps in modals, ARIA labels on icon-only buttons
- [ ] Responsive QA: desktop / tablet / mobile breakpoints from `02-frontend.md`

---

## Polish & ship (M{{N+1}})

- [ ] Performance: lazy-load all routes; inspect bundle with source-map-explorer
- [ ] Security: helmet (Express) / equivalent NestJS config; CORS allowlist; rate-limit auth endpoints
- [ ] Observability: structured logging on the backend; basic Sentry or equivalent
- [ ] Deployment: containerize backend; deploy frontend (Vercel / Netlify / static); apply DB migrations on deploy
- [ ] Smoke test in production: run the primary user flows from `01-overview.md` against the deployed app

---

## Known gaps from reverse-engineering

Carry the unknowns from the other docs forward as work items. Don't pretend you have answers you don't.

- [ ] **{{Gap 1}}** — investigate before implementing {{milestone}}. Suggested approach: {{...}}
- [ ] **{{Gap 2}}** — {{...}}

---

## Notes for the implementing agent

- Use `04-database.md` as the source of truth for column names. If reality forces a deviation (e.g. a reserved word), update that file first, then the code.
- Don't build features that aren't in `01-overview.md`. The reverse-engineering captured a specific surface — additions are scope creep.
- When the original UI has a quirk that seems wrong (weird button placement, odd spacing), preserve it unless the user explicitly says otherwise. The `02-frontend.md` screenshots are the visual contract.
- If you discover a contradiction between the docs and the running site (the user can re-run the original at {{TARGET_URL}}), flag it instead of silently picking one.
