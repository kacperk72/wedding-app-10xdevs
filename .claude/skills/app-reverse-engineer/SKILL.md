---
name: app-reverse-engineer
description: Reverse-engineers a live web application from its URL into a complete technical specification ready for re-implementation. Use this skill whenever the user wants to recreate, clone, or rebuild an existing web app, asks to "analyze a site and document it", "reverse engineer this URL", "make docs for implementing this app", "build something like X", or hands you a URL and asks for an implementation plan — even if they don't use the words "reverse engineer". Drives Playwright MCP to crawl the site, capture screenshots, sniff network traffic, infer the data model, and emit five markdown specs (overview, frontend, backend, database, implementation plan) plus screenshots into the project's docs folder.
---

# App Reverse-Engineer

You are reverse-engineering a live web application. Your output is a documentation bundle complete enough that another agent could rebuild the app from scratch — frontend, backend, and database — without ever opening the original site.

## What you produce

For a target URL `https://example.com`, you write:

```
docs/<domain-slug>/
├── 01-overview.md            # purpose, user flows, main features
├── 02-frontend.md            # pages, components, routing, state, styling
├── 03-backend.md             # REST endpoints, payloads, auth
├── 04-database.md            # tables, columns, relations, indexes
├── 05-implementation-plan.md # ordered build plan in the user's stack
└── screenshots/
    ├── desktop/<page-slug>.png
    └── mobile/<page-slug>.png
```

Use templates in `assets/` as starting points — copy them, then fill in.

## Required tools

- **Playwright MCP** (`mcp__plugin_playwright_playwright__*`) — for navigation, screenshots, DOM snapshots, network capture
- **Write / Edit / Read** — for emitting the docs

If Playwright MCP is not available, stop and tell the user it must be enabled.

## The target stack

Generated implementation plans target the user's preferred stack from `CLAUDE.md`:

- **Frontend**: Angular 20+ standalone components, signals for state, native control flow, SCSS, OnPush
- **Backend**: NestJS (preferred) or Node.js/Express; class-validator DTOs
- **Database**: PostgreSQL (Supabase) or MySQL/Sequelize
- **Auth**: JWT with refresh tokens

See `references/stack-template.md` for code patterns to reference in the implementation plan. Don't recommend a different stack unless the target site uses something the user's stack genuinely cannot do.

---

## Workflow

### Phase 1 — Intake

1. Confirm with the user:
   - Target URL (must be reachable)
   - Login credentials, if any (the test app has them hardcoded — read the HTML or ask the user)
   - Optional: explicit URL list to crawl, otherwise auto-discover
2. Derive `<domain-slug>` from the URL (e.g. `https://app.foo.com/x` → `app-foo-com`).
3. Create `docs/<domain-slug>/` and `docs/<domain-slug>/screenshots/desktop/` and `screenshots/mobile/` if not present.
4. Read `references/inference-heuristics.md` and `references/playwright-recipes.md` before driving the browser. They tell you *what to look for*, which makes the recon pass much higher-signal.

### Phase 2 — Recon (drive the browser)

The goal of this phase is to capture **raw evidence**, not to write conclusions. Save evidence as you go to a scratch file `docs/<domain-slug>/.recon.md` so you don't lose it if the session is interrupted.

For each page visited, capture:
- **Screenshot** at desktop viewport (1440×900) → `screenshots/desktop/<slug>.png`
- **Screenshot** at mobile viewport (375×812) → `screenshots/mobile/<slug>.png`
- **DOM snapshot** (`browser_snapshot`) — note structure, semantic regions, repeated patterns
- **Network requests** (`browser_network_requests`) — every XHR/fetch with method, URL, request body, response shape, status
- **Console messages** (`browser_console_messages`) — framework hints often appear here

**Crawl strategy** (default if user didn't supply a URL list):
1. Visit the homepage. Catalog every link in primary nav and footer.
2. If a login page is present, sign in (use credentials the user gave or ones embedded in the page).
3. Visit each primary-nav destination, capturing as above.
4. From each of those pages, follow links one level deeper — but only same-origin and only if the URL pattern looks distinct (skip `?page=2` style duplicates).
5. **Exercise interactivity**: open at least one of each kind of interactive element you find — submit a form (with dummy data), open a modal, expand a dropdown, trigger a search. Each interaction often reveals a new API endpoint that wouldn't fire on a passive load.
6. Stop crawling once you've covered the main nav + 1 level. Bigger crawls cost time without proportional documentation gain.

**Tactical notes:**
- Resize the viewport between desktop and mobile screenshots (`browser_resize`) — don't rely on CSS scaling.
- Use `browser_evaluate` to inspect framework globals (`window.ng`, `window.__NEXT_DATA__`, `window.__NUXT__`, `window.Vue`, etc.) when DOM hints are ambiguous.
- If the same endpoint fires on many pages (e.g. `/api/me`), record it once and note where it appears.
- Don't try to brute-force every interactive element — pick representative ones. The point is to map the *shape* of the API, not to fuzz it.

### Phase 3 — Analysis (offline, no browser)

Now read your recon notes and produce findings. Work through each section of the heuristics file (`references/inference-heuristics.md`) systematically. Key deductions:

- **Frontend framework**: which one, which version if detectable, what build tool
- **Routing**: SPA vs MPA; route patterns; protected vs public routes
- **State**: forms (component-local), shared data (likely a store), real-time (websockets?)
- **Component inventory**: list every distinct UI block — header, card variants, table, modal types, form types — with one-line descriptions
- **API surface**: every endpoint observed → method, path, request shape, response shape, what UI consumes it
- **Auth**: token type, storage location (cookie? localStorage?), refresh mechanism if visible
- **Data model**: the database tables you must have for the observed responses and UI to make sense — this is inference, be explicit about confidence

The data-model inference is where most beginner reverse-engineering goes wrong. Read `references/inference-heuristics.md` § "Inferring the database" carefully. The rule of thumb: every list view is a `SELECT * FROM …`, every detail view is a `SELECT … WHERE id = ?`, every form submit is an `INSERT` or `UPDATE`. Trace each of these back to a table.

### Phase 4 — Write the docs

Use the templates in `assets/` as the skeleton. Copy each template into `docs/<domain-slug>/` and fill it in. Templates intentionally include placeholders and section headers — keep the headers, replace the placeholders.

Order matters: write `01-overview.md` first (it's the easiest and grounds the rest), then `02-frontend.md`, `03-backend.md`, `04-database.md`. Write `05-implementation-plan.md` *last*, because it depends on everything above it.

Quality bar:
- Every claim should be traceable to evidence (a screenshot, a captured request, an inspected DOM node). When you're inferring, say so: *"likely a `users` table — inferred from `/api/me` response shape"*.
- Embed screenshots inline with relative paths: `![Login page](screenshots/desktop/login.png)`.
- Use tables for endpoint listings and column listings — they're scannable.
- Code blocks for request/response examples, SQL DDL, route paths.

For `05-implementation-plan.md`, target the user's stack (Angular + NestJS/Express + Postgres). Sequence: schema → backend endpoints (auth first, then resources) → frontend scaffolding → page-by-page implementation → polish. Don't ship a plan with all tasks at the same level — group by milestone, and within a milestone keep tasks small enough to be one-PR-sized.

### Phase 5 — Hand off

When done:
1. Delete `.recon.md` (it was scratch).
2. Tell the user the absolute path to `docs/<domain-slug>/` and list the files generated.
3. Surface anything you couldn't determine — pages behind auth you couldn't access, unclear endpoint contracts, framework guesses you're not confident in. The implementation plan should explicitly call these out as TODOs.

---

## Output guarantees

Each generated doc must:
- Be valid Markdown that renders cleanly
- Have a top-level title matching its purpose
- Open with a one-paragraph TL;DR before any deep section
- Cite evidence (screenshot path or endpoint name) for non-obvious claims

If you can't produce one of the docs because the recon didn't yield enough evidence, write the file anyway with a "Not enough information" stub explaining what's missing and how the user could provide it (e.g. "needs admin login to access").

---

## Common failure modes — read these

1. **Treating the visible UI as the whole app.** Many features only appear after interaction. Open modals. Submit forms. Search. Filter. The network tab is where the real spec lives.

2. **Ignoring the mobile breakpoint.** Mobile layout often reveals navigation patterns and component variants not present on desktop.

3. **Inventing endpoints that weren't observed.** If you didn't see a request, don't write it down as fact. Mark it inferred and explain the inference.

4. **Schema by autocomplete.** The temptation is to write a generic `users(id, email, password_hash, created_at)` table. Resist. Look at the actual fields the API returns. If `/api/users/me` returns a `subscription_tier`, that's a column. If it doesn't, don't add it.

5. **Skipping the implementation plan because "the docs are enough".** They aren't. The plan is what makes this skill useful — without it the user has a pile of docs and no path forward.
