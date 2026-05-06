# Frontend — {{APP_NAME}}

> **TL;DR**: {{One paragraph. Framework, app shell pattern, routing style, state approach, styling system.}}

## Detected stack

| Concern             | Original                                | Recommended for rebuild       |
| ------------------- | --------------------------------------- | ----------------------------- |
| Framework           | {{e.g. React 18 / Next.js 14}}          | Angular 20+ standalone        |
| Routing             | {{e.g. Next App Router / React Router}} | Angular Router with lazy load |
| State               | {{e.g. Redux Toolkit / Zustand}}        | Angular signals               |
| Styling             | {{e.g. Tailwind / CSS Modules}}         | Component-scoped SCSS         |
| Forms               | {{e.g. react-hook-form}}                | Reactive Forms                |
| HTTP                | {{e.g. fetch via SWR / RTK Query}}      | `HttpClient` + interceptors   |

Evidence for stack detection: {{cite which globals/script-paths/markers gave you this}}.

## App shell

{{Describe the persistent layout. Header? Sidebar? Footer? Which routes show which shell? Mention conditional shell elements (logged-in nav vs marketing nav).}}

![Desktop shell](screenshots/desktop/home.png)
![Mobile shell](screenshots/mobile/home.png)

## Routes

| Path                      | Page component       | Auth | Notes                                  |
| ------------------------- | -------------------- | ---- | -------------------------------------- |
| `/`                       | `HomePage`           | No   | Marketing                              |
| `/login`                  | `LoginPage`          | No   | Form: email + password                 |
| `/dashboard`              | `DashboardPage`      | Yes  |                                        |
| `/projects/:id`           | `ProjectDetailPage`  | Yes  | `:id` is a UUID                        |
| `/projects/:id/tasks/:tid`| `TaskDetailPage`     | Yes  |                                        |

## Components

Group by responsibility. For each, give a one-line purpose + variants. Keep it concrete.

### Layout

- **`AppHeader`** — top nav, user menu, logo. Variants: `marketing` (with sign-up CTA), `app` (with notifications + avatar).
- **`AppSidebar`** — left nav on desktop only; switches to drawer on mobile.
- **`AppFooter`** — only shown on marketing routes.

### Domain — projects

- **`ProjectCard`** — used in dashboard list. Shows title, member count, last activity.
- **`ProjectCreateForm`** — modal-mounted form: title, description, optional team.

### Domain — tasks

- **`TaskList`** — virtualized table of tasks with filters at top.
- **`TaskRow`** — one row in `TaskList`; click opens `TaskDetailPage`.
- **`TaskCreateForm`** — title, due date, assignee dropdown, description.

### Shared / primitive

- **`Button`** — variants: `primary`, `secondary`, `ghost`, `danger`. Sizes: `sm`, `md`, `lg`.
- **`Modal`** — generic dialog wrapper.
- **`Toast`** — bottom-right notifications, auto-dismiss after 4s.
- {{...}}

## State

### Local (component)

{{What is held inside components — form state, hover states, modal open/close.}}

### Shared / global

| State slice         | Location               | Source                                  |
| ------------------- | ---------------------- | --------------------------------------- |
| Current user        | `AuthService` signal   | Hydrated from `GET /api/me` on boot     |
| Toast queue         | `ToastService`         | Pushed by anything that needs to notify |
| Theme               | `ThemeService` signal  | Persisted in `localStorage`             |

### Server cache

{{If you saw evidence of a query cache (React Query / SWR / TanStack Query), document the keys and stale times. Otherwise note "data is fetched on every page load; no client-side cache observed."}}

## Forms

For each form, document fields, validation, submit endpoint, and what success/failure does to the UI.

### `LoginForm`

| Field    | Type    | Validation                       |
| -------- | ------- | -------------------------------- |
| email    | email   | required, RFC-valid              |
| password | password| required, min 8                  |

- Submit: `POST /api/auth/login`
- Success: store token; redirect to `/dashboard`
- Failure: show toast "Invalid credentials"

### `ProjectCreateForm`

{{...}}

## Responsive behavior

| Viewport       | Behavior                                          |
| -------------- | ------------------------------------------------- |
| ≥1024px        | Sidebar visible, full table view                  |
| 768–1023px     | Sidebar collapses to icons; tables scroll-x       |
| <768px         | Hamburger menu; cards instead of tables           |

Screenshots:
- `screenshots/mobile/dashboard.png`
- `screenshots/mobile/project-detail.png`

## Accessibility observations

{{Any a11y patterns worth preserving — keyboard shortcuts, ARIA roles, focus management. Or note "no notable a11y patterns observed."}}

## Inferred but unverified

{{Things you wrote down with limited evidence. Be honest — the implementer needs to know which decisions are guesses.}}
