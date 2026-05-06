# Inference Heuristics

How to turn observed UI + network traffic into a complete frontend / backend / database spec. The browser shows you the **what**; this file is about deducing the **why** behind it.

## Inferring frontend architecture

### Routing
- Watch the URL bar as you click links. URL changes without a full page reload → SPA. Reloads → MPA.
- Hash routes (`#/foo`) → older SPA pattern. Clean routes (`/foo`) with no full reload → modern SPA with history API.
- Shared layout (header/footer stay) but content swaps → SPA with nested routing.
- Route params: look for URLs like `/users/123` — `:id` parameter; `/projects/abc-def` likely a slug.

### Component identification
A component is a *visually repeated* or *semantically distinct* unit. Inventory technique:
1. List visible UI blocks: header, nav, sidebar, footer, hero, card, list-item, table-row, modal, toast, breadcrumbs, etc.
2. For each, note variants. (E.g. "card" might split into `ProductCard`, `UserCard`, `EmptyCard`.)
3. Forms are always components — name them by the entity they edit (`LoginForm`, `ProjectCreateForm`).
4. Modals/dialogs are always components — name by purpose (`ConfirmDeleteDialog`).

Don't list every button as its own component. Buttons are usually a single `<Button variant="…">` with props.

### State management
Heuristics:
- Form state → component-local (signals/`FormGroup`)
- Data fetched on page load → likely a service/store, often a query cache
- Data persisting across routes (current user, theme, cart) → global store/signal
- Real-time updates (lists that change without refresh) → WebSocket or polling — check network for `ws://`/`wss://` or repeated GETs

### Styling
Look for class patterns:
- `bg-blue-500 px-4 py-2` → Tailwind
- `[class^="_module"]` or hashed → CSS Modules
- BEM (`block__element--modifier`) → plain SCSS
- Many `<style>` tags inline with framework prefix (`_ngcontent-`, `data-v-`) → component-scoped styles

For our target stack we'll output as SCSS scoped to components — note the *intent* (spacing scale, color palette) more than the original framework.

## Inferring API contracts

For every captured request, record:

| Field          | Example                              |
| -------------- | ------------------------------------ |
| Method         | `POST`                               |
| Path           | `/api/projects/123/tasks`            |
| Auth           | `Authorization: Bearer …` / cookie   |
| Request body   | `{ "title": "x", "dueAt": "..." }`   |
| Response       | `{ "id": 9, "title": "x", ... }`     |
| Status         | `201`                                |
| Triggered by   | "Save button on Task create modal"   |

### REST shape recognition
- `GET /resource` → list (often paginated; look for `?page=`, `?limit=`, or `Link` headers)
- `GET /resource/:id` → fetch one
- `POST /resource` → create
- `PUT/PATCH /resource/:id` → update
- `DELETE /resource/:id` → delete
- Nested paths (`/projects/:id/tasks`) → tasks belong-to project

If the API doesn't follow REST (RPC-style: `/api/createTask`, `/graphql`, etc.), document the actual style, don't force REST onto it. For GraphQL, capture the query/mutation strings and the resulting types.

### Auth detection
Inspect requests after login:
- `Authorization: Bearer <jwt>` in headers → JWT in localStorage/sessionStorage
- `Cookie: session=…` and no Authorization header → session cookie auth
- `X-CSRF-Token` present → server-rendered with anti-CSRF
- 401 response with `WWW-Authenticate` header → check the scheme

Look at the login response for refresh token patterns: a long-lived `refreshToken` returned alongside the access token is a strong hint.

### Pagination, sorting, filtering
Look at list-view request URLs:
- `?page=2&limit=20` → offset pagination
- `?cursor=…` → cursor pagination
- `?sort=createdAt&order=desc` → query-param sorting
- `?status=active&tag=urgent` → filters

These need to be in the backend spec.

## Inferring the database

This is the hardest and most important inference. **Be explicit about confidence.**

### Tables
Every distinct entity in API responses is *probably* a table. Sources of evidence:
1. URL paths: `/projects`, `/tasks`, `/users` → tables `projects`, `tasks`, `users`
2. Response object keys with stable shapes
3. Foreign-key hints: a field named `userId`, `projectId`, `authorId` → relation
4. Embedded objects: `{ task: { id: 1, project: { id: 5, name: "..." } } }` → `tasks.project_id` references `projects.id`

### Columns
- Every leaf field in a response is a column candidate
- `createdAt` / `updatedAt` → timestamp columns (almost certain)
- `id` of UUID format → `uuid` column; numeric → `bigserial`/`int`
- Enum-like strings (`status: "active" | "pending"`) → enum or check-constrained column
- Boolean values → `boolean`
- Currency: usually `decimal(12,2)` or stored in cents as `integer`

### Relations
- Belongs-to: object has a `<thing>Id` field → many-to-one to `<thing>s`
- Has-many: response of `/parents/:id/children` returns array of children → one-to-many
- Many-to-many: a join request like `/projects/:id/members` returning users with role info → a `project_members` join table with extra columns

### What you won't see and must guess
- `password_hash` column on users — never returned by the API but obviously needed
- Indexes — not visible from outside; recommend based on query patterns (filter columns, foreign keys, sort columns)
- Cascade rules — guess based on UX (deleting a project also deletes tasks? probably `ON DELETE CASCADE`)
- Soft-delete (`deleted_at`) — if you see archive/restore UI

### Confidence labels
Every table/column gets one of:
- **Observed** — appears in actual API response
- **Inferred** — not directly visible but logically required (`password_hash`)
- **Recommended** — best practice, not strictly required (`updated_at`, indexes)

Use these labels in `04-database.md`. They tell the implementer where to push back.

## Inferring user flows

Trace the journey of a user accomplishing a goal. For each major feature, write:
1. Entry point (which page, which button)
2. Steps the user takes (forms, clicks)
3. Network calls fired at each step
4. Final state visible to the user

A good user flow is a sequence of (UI action, API call, UI change) triples. This is what makes `01-overview.md` actually useful — without flows it's just a feature list.

## When you can't tell

If evidence is genuinely ambiguous (e.g. you can't tell if a list refresh is a websocket push or a refetch), document **both possibilities** in the spec and recommend one for implementation. Honest uncertainty beats false precision.
