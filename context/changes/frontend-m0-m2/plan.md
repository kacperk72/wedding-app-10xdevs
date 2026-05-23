I have full understanding now. Let me deliver the plan as my final message.

---

# Frontend M0-M2 Implementation Plan â€” Wedding Planner

> **Note on output:** The user asked me to save this to `context/changes/frontend-m0-m2/plan.md`, but the task brief explicitly placed me in READ-ONLY mode with no file-creation tools. I therefore deliver the plan inline. The parent agent can persist it verbatim.

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Foundation tasks (T1-T13) are **strictly sequential**. Leaf tasks (T14-T16) are parallelizable once foundation is complete.

**Goal:** Land the Angular 21 frontend foundation (design tokens, HTTP layer, services, app shell, primitives, routing) plus the three M0-M2 pages â€” Login `/`, Dashboard `/app`, GoĹ›cie `/app/goscie` â€” wired against a real `HttpClient` pointing at `/api`. Backend will 404/500; that is acceptable. Polish UI from first commit. Tokens locked. No Tailwind.

**Architecture:**
- Standalone components everywhere, signals + `computed()` for derived state, `inject()` for DI, native control flow (`@if`/`@for`/`@switch`), `input()`/`output()` functions, `ChangeDetectionStrategy.OnPush`, host bindings in `host: {}`, component-scoped SCSS that consumes global tokens.
- Three layers under `src/app/`: `core/` (services, interceptors, models, guards, env), `shared/` (layout shells, primitives), `pages/` (lazy-loaded routes). Per-page files live next to the page; cross-page primitives live in `shared/`.
- HTTP is real (`provideHttpClient(withInterceptors([authInterceptor]))`) so the swap to a working backend is configuration-only.

**Tech Stack:** Angular 21.1, RxJS 7.8, TypeScript 5.9, SCSS, Reactive Forms, RouterModule with lazy routes. No Tailwind. No NgRx. No external UI library.

---

## Spec sources of truth (read these before each task)

- `docs/demo-app/02-frontend.md` â€” primary UI authority (lines 26-44 App shell, 46-60 Routes, 62-182 Components, 184-213 State, 216-267 Forms, 269-289 Responsive/A11y).
- `docs/demo-app/04-database.md` lines 63-145, 314-330 â€” entity definitions for `users`, `weddings`, `wedding_members`, `guests`, `meal_options`, plus the 5-value `diet` enum and 6-value `relation` enum.
- `docs/demo-app/01-overview.md` lines 27-71 â€” user flows for Login (Flow 1) and Add Guest (Flow 2); confirms aggregates and grouping.
- `docs/demo-app/05-implementation-plan.md` lines 9-82 â€” M0/M1/M2 milestone gates (translate away from NestJS/Supabase per repo CLAUDE.md "Stack pivot").
- Repo `CLAUDE.md` lines 19-32 (stack pivot), 42-49 (project conventions, including locked design tokens).

---

## File structure (decomposition lock)

```
wedding-planner/frontend/
â”śâ”€â”€ src/
â”‚   â”śâ”€â”€ index.html                            # MODIFY: add Google Fonts link
â”‚   â”śâ”€â”€ styles.scss                           # MODIFY: import tokens + reset + typography
â”‚   â”śâ”€â”€ styles/                               # CREATE
â”‚   â”‚   â”śâ”€â”€ _tokens.scss                      # colors, spacing, radii, shadows, fonts (CSS custom props inside :root)
â”‚   â”‚   â”śâ”€â”€ _reset.scss                       # box-sizing, margin/padding reset, body baseline
â”‚   â”‚   â”śâ”€â”€ _typography.scss                  # h1-h6 serif, body sans, .body-lg/.body-sm utilities
â”‚   â”‚   â””â”€â”€ _mixins.scss                      # breakpoint mixins (mobile/tablet/desktop)
â”‚   â”śâ”€â”€ environments/                         # CREATE (no env build configs yet â€” Angular 21 scaffold doesn't generate them)
â”‚   â”‚   â”śâ”€â”€ environment.ts                    # { apiBaseUrl: '/api', production: false }
â”‚   â”‚   â””â”€â”€ environment.prod.ts               # { apiBaseUrl: '/api', production: true }
â”‚   â””â”€â”€ app/
â”‚       â”śâ”€â”€ app.ts                            # MODIFY: strip Angular hello template, render <router-outlet>
â”‚       â”śâ”€â”€ app.html                          # MODIFY: single line <router-outlet />
â”‚       â”śâ”€â”€ app.scss                          # MODIFY: empty (global styles take over)
â”‚       â”śâ”€â”€ app.config.ts                     # MODIFY: add provideHttpClient(withInterceptors([authInterceptor])), provideAnimations
â”‚       â”śâ”€â”€ app.routes.ts                     # MODIFY: define lazy routes
â”‚       â”‚
â”‚       â”śâ”€â”€ core/
â”‚       â”‚   â”śâ”€â”€ env/
â”‚       â”‚   â”‚   â””â”€â”€ app-env.ts                # re-exports environment.ts (single import surface for app code)
â”‚       â”‚   â”śâ”€â”€ models/
â”‚       â”‚   â”‚   â”śâ”€â”€ user.model.ts             # User, AuthSession, LoginRequest, LoginResponse
â”‚       â”‚   â”‚   â”śâ”€â”€ wedding.model.ts          # Wedding, WeddingMemberRole
â”‚       â”‚   â”‚   â”śâ”€â”€ guest.model.ts            # Guest, RsvpStatus, Diet, Relation, GuestAggregates, CreateGuestDto, UpdateGuestDto
â”‚       â”‚   â”‚   â”śâ”€â”€ meal-option.model.ts      # MealOption
â”‚       â”‚   â”‚   â””â”€â”€ index.ts                  # barrel
â”‚       â”‚   â”śâ”€â”€ http/
â”‚       â”‚   â”‚   â”śâ”€â”€ auth.interceptor.ts       # adds Bearer token, retries 1x on 401 via refresh stub
â”‚       â”‚   â”‚   â””â”€â”€ api-url.ts                # buildUrl(path) -> `${env.apiBaseUrl}${path}` helper
â”‚       â”‚   â”śâ”€â”€ services/
â”‚       â”‚   â”‚   â”śâ”€â”€ auth.service.ts           # signal user, signal token, login(), logout(), me(), refresh()
â”‚       â”‚   â”‚   â”śâ”€â”€ wedding.service.ts        # signal wedding, computed daysUntilWedding, loadCurrent()
â”‚       â”‚   â”‚   â”śâ”€â”€ guests.service.ts         # signal guests, computed aggregates+filteredGuests, list(), create(), update(), remove(), setFilters()
â”‚       â”‚   â”‚   â”śâ”€â”€ meal-options.service.ts   # signal mealOptions, list()
â”‚       â”‚   â”‚   â””â”€â”€ toast.service.ts          # signal toasts, show({kind,message}), dismiss(id)
â”‚       â”‚   â”śâ”€â”€ guards/
â”‚       â”‚   â”‚   â””â”€â”€ auth.guard.ts             # placeholder, returns true with TODO comment
â”‚       â”‚   â””â”€â”€ format/
â”‚       â”‚       â”śâ”€â”€ date.format.ts            # formatDDMMYYYY(date|string), daysBetween(a,b)
â”‚       â”‚       â””â”€â”€ currency.format.ts        # formatPLN(number) -> "32 000 zĹ‚"
â”‚       â”‚
â”‚       â”śâ”€â”€ shared/
â”‚       â”‚   â”śâ”€â”€ layout/
â”‚       â”‚   â”‚   â”śâ”€â”€ app-shell/                # sidebar + header + <router-outlet>
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ app-shell.ts
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ app-shell.html
â”‚       â”‚   â”‚   â”‚   â””â”€â”€ app-shell.scss
â”‚       â”‚   â”‚   â”śâ”€â”€ marketing-shell/          # split-screen for /
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ marketing-shell.ts
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ marketing-shell.html
â”‚       â”‚   â”‚   â”‚   â””â”€â”€ marketing-shell.scss
â”‚       â”‚   â”‚   â”śâ”€â”€ app-sidebar/              # navigation, 9 links (only 3 active for M0-M2; rest disabled w/ tooltip)
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ app-sidebar.ts
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ app-sidebar.html
â”‚       â”‚   â”‚   â”‚   â””â”€â”€ app-sidebar.scss
â”‚       â”‚   â”‚   â”śâ”€â”€ mobile-bottom-nav/        # <768px variant
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ mobile-bottom-nav.ts
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ mobile-bottom-nav.html
â”‚       â”‚   â”‚   â”‚   â””â”€â”€ mobile-bottom-nav.scss
â”‚       â”‚   â”‚   â”śâ”€â”€ app-header/               # banner: logo, names, days counter, avatars
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ app-header.ts
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ app-header.html
â”‚       â”‚   â”‚   â”‚   â””â”€â”€ app-header.scss
â”‚       â”‚   â”‚   â””â”€â”€ couple-avatar-pair/
â”‚       â”‚   â”‚       â”śâ”€â”€ couple-avatar-pair.ts
â”‚       â”‚   â”‚       â”śâ”€â”€ couple-avatar-pair.html
â”‚       â”‚   â”‚       â””â”€â”€ couple-avatar-pair.scss
â”‚       â”‚   â”śâ”€â”€ ui/
â”‚       â”‚   â”‚   â”śâ”€â”€ button/
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ button.ts             # input() variant, size, type, disabled; native <button> projection
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ button.html
â”‚       â”‚   â”‚   â”‚   â””â”€â”€ button.scss
â”‚       â”‚   â”‚   â”śâ”€â”€ badge/
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ badge.ts              # input() tone: 'success'|'warning'|'danger'|'neutral'|'info'
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ badge.html
â”‚       â”‚   â”‚   â”‚   â””â”€â”€ badge.scss
â”‚       â”‚   â”‚   â”śâ”€â”€ dialog/
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ dialog.ts             # input() open signal, output() closed; uses CDK-free overlay (manual fixed + backdrop)
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ dialog.html
â”‚       â”‚   â”‚   â”‚   â””â”€â”€ dialog.scss
â”‚       â”‚   â”‚   â”śâ”€â”€ combobox/
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ combobox.ts           # native <select> styled; ControlValueAccessor
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ combobox.html
â”‚       â”‚   â”‚   â”‚   â””â”€â”€ combobox.scss
â”‚       â”‚   â”‚   â”śâ”€â”€ progress-bar/
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ progress-bar.ts       # input() value 0..100, tone derived from threshold
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ progress-bar.html
â”‚       â”‚   â”‚   â”‚   â””â”€â”€ progress-bar.scss
â”‚       â”‚   â”‚   â”śâ”€â”€ input-text/
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ input-text.ts
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ input-text.html
â”‚       â”‚   â”‚   â”‚   â””â”€â”€ input-text.scss
â”‚       â”‚   â”‚   â”śâ”€â”€ input-date/
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ input-date.ts         # <input type="date"> wrapper
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ input-date.html
â”‚       â”‚   â”‚   â”‚   â””â”€â”€ input-date.scss
â”‚       â”‚   â”‚   â”śâ”€â”€ input-password/
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ input-password.ts     # <input type="password"> with show/hide toggle
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ input-password.html
â”‚       â”‚   â”‚   â”‚   â””â”€â”€ input-password.scss
â”‚       â”‚   â”‚   â”śâ”€â”€ page-header/
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ page-header.ts        # input() title, subtitle; ng-content for actions
â”‚       â”‚   â”‚   â”‚   â”śâ”€â”€ page-header.html
â”‚       â”‚   â”‚   â”‚   â””â”€â”€ page-header.scss
â”‚       â”‚   â”‚   â””â”€â”€ toast-host/
â”‚       â”‚   â”‚       â”śâ”€â”€ toast-host.ts         # reads ToastService.toasts() signal, renders stack bottom-right
â”‚       â”‚   â”‚       â”śâ”€â”€ toast-host.html
â”‚       â”‚   â”‚       â””â”€â”€ toast-host.scss
â”‚       â”‚
â”‚       â”śâ”€â”€ pages/
â”‚       â”‚   â”śâ”€â”€ login/
â”‚       â”‚   â”‚   â”śâ”€â”€ login.page.ts
â”‚       â”‚   â”‚   â”śâ”€â”€ login.page.html
â”‚       â”‚   â”‚   â””â”€â”€ login.page.scss
â”‚       â”‚   â”śâ”€â”€ dashboard/
â”‚       â”‚   â”‚   â”śâ”€â”€ dashboard.page.ts
â”‚       â”‚   â”‚   â”śâ”€â”€ dashboard.page.html
â”‚       â”‚   â”‚   â”śâ”€â”€ dashboard.page.scss
â”‚       â”‚   â”‚   â””â”€â”€ components/
â”‚       â”‚   â”‚       â”śâ”€â”€ hero-counter/
â”‚       â”‚   â”‚       â”‚   â”śâ”€â”€ hero-counter.ts
â”‚       â”‚   â”‚       â”‚   â”śâ”€â”€ hero-counter.html
â”‚       â”‚   â”‚       â”‚   â””â”€â”€ hero-counter.scss
â”‚       â”‚   â”‚       â”śâ”€â”€ kpi-card/             # generic shell â€” Dashboard composes 4 variants from props
â”‚       â”‚   â”‚       â”‚   â”śâ”€â”€ kpi-card.ts
â”‚       â”‚   â”‚       â”‚   â”śâ”€â”€ kpi-card.html
â”‚       â”‚   â”‚       â”‚   â””â”€â”€ kpi-card.scss
â”‚       â”‚   â”‚       â”śâ”€â”€ attention-list/
â”‚       â”‚   â”‚       â”‚   â”śâ”€â”€ attention-list.ts
â”‚       â”‚   â”‚       â”‚   â”śâ”€â”€ attention-list.html
â”‚       â”‚   â”‚       â”‚   â””â”€â”€ attention-list.scss
â”‚       â”‚   â”‚       â””â”€â”€ upcoming-meetings/
â”‚       â”‚   â”‚           â”śâ”€â”€ upcoming-meetings.ts
â”‚       â”‚   â”‚           â”śâ”€â”€ upcoming-meetings.html
â”‚       â”‚   â”‚           â””â”€â”€ upcoming-meetings.scss
â”‚       â”‚   â””â”€â”€ guests/
â”‚       â”‚       â”śâ”€â”€ guests.page.ts
â”‚       â”‚       â”śâ”€â”€ guests.page.html
â”‚       â”‚       â”śâ”€â”€ guests.page.scss
â”‚       â”‚       â””â”€â”€ components/
â”‚       â”‚           â”śâ”€â”€ guests-aggregate-bar/
â”‚       â”‚           â”śâ”€â”€ guest-search/
â”‚       â”‚           â”śâ”€â”€ guest-filters/
â”‚       â”‚           â”śâ”€â”€ guest-group-table/
â”‚       â”‚           â”śâ”€â”€ rsvp-badge/
â”‚       â”‚           â”śâ”€â”€ diet-badge/
â”‚       â”‚           â””â”€â”€ add-guest-dialog/
```

**Out-of-scope folders (do NOT create):** `pages/vendors`, `pages/contracts`, `pages/budget`, `pages/catering`, `pages/tasks`, `pages/seating`, `pages/settings`, and any services for those slices (`VendorsService`, `ContractsService`, `BudgetService`, `CateringService`, `TasksService`, `SeatingService`). These are M3+.

---

## Sequential foundation rule

Foundation tasks T1 through T13 **MUST** run sequentially in a single agent, in order. They modify shared files (`app.config.ts`, `styles.scss`, `app.routes.ts`) and depend on each other (e.g., interceptor needs `AuthService`, which needs models). Do NOT dispatch foundation tasks in parallel â€” the merge conflicts and ordering bugs cost more than the speedup.

Leaf tasks T14, T15, T16 (the three pages) ARE parallelizable after T13 lands, because each one only touches files inside its own `pages/<slug>/` directory.

---

## Foundation Tasks (sequential)

### Task T1: Wire global SCSS pipeline `[foundation]`

**Files:**
- Create: `src/styles/_tokens.scss`
- Create: `src/styles/_reset.scss`
- Create: `src/styles/_typography.scss`
- Create: `src/styles/_mixins.scss`
- Modify: `src/styles.scss` (replace placeholder)
- Modify: `src/index.html` (add Google Fonts `<link>` for Cormorant + Inter)

- [ ] **Step 1:** Create `src/styles/_tokens.scss` with CSS custom properties on `:root`. Required tokens:
  - Colors: `--color-accent: #3F5C3A;` (bottle green), `--color-accent-dark: #2F4A2C;`, `--color-accent-light: #C8D6C2;`, `--color-bg: #FAF7EE;` (cream), `--color-surface: #FFFFFF;`, `--color-text: #1F2A1B;`, `--color-text-muted: #6B7264;`, `--color-border: #E5E1D2;`, `--color-success: #4F8A4A;`, `--color-success-bg: #DCE9D8;`, `--color-warning: #B7892C;`, `--color-warning-bg: #F3E7C9;`, `--color-danger: #B2483F;`, `--color-danger-bg: #F0D5D2;`, `--color-info: #4A6B8A;`, `--color-info-bg: #D5E1EC;`, `--color-pastel-vege: #DCE9D8;`, `--color-pastel-vegan: #C8D6C2;`, `--color-pastel-gf: #EFE3C7;`.
  - Spacing scale: `--space-1: 4px;` through `--space-12: 64px;` (1=4, 2=8, 3=12, 4=16, 5=20, 6=24, 8=32, 10=40, 12=64).
  - Radii: `--radius-sm: 6px;`, `--radius-md: 12px;`, `--radius-lg: 16px;`, `--radius-2xl: 24px;`.
  - Shadows: `--shadow-sm: 0 1px 2px rgba(31,42,27,0.04);`, `--shadow-md: 0 4px 12px rgba(31,42,27,0.06);`, `--shadow-lg: 0 12px 32px rgba(31,42,27,0.08);`.
  - Fonts: `--font-serif: 'Cormorant Garamond', 'Playfair Display', Georgia, serif;`, `--font-sans: 'Inter', 'DM Sans', -apple-system, sans-serif;`.
  - Layout: `--sidebar-width: 220px;`, `--header-height: 72px;`, `--page-max: 1280px;`.
- [ ] **Step 2:** Create `src/styles/_reset.scss` â€” `*, *::before, *::after { box-sizing: border-box; } html,body { margin:0; padding:0; } body { background: var(--color-bg); color: var(--color-text); font-family: var(--font-sans); font-size: 15px; line-height: 1.5; -webkit-font-smoothing: antialiased; }` plus button reset (no native border, inherit font).
- [ ] **Step 3:** Create `src/styles/_typography.scss` â€” `h1 { font-family: var(--font-serif); font-weight: 500; font-size: 2.25rem; letter-spacing: -0.01em; margin: 0; }`, `h2 { ... 1.75rem }`, `h3 { ... 1.375rem }`, plus `.body-lg`, `.body-sm`, `.caption { color: var(--color-text-muted); font-size: 0.8125rem; }`.
- [ ] **Step 4:** Create `src/styles/_mixins.scss`:
  ```scss
  @mixin mobile { @media (max-width: 767px) { @content; } }
  @mixin tablet { @media (min-width: 768px) and (max-width: 1023px) { @content; } }
  @mixin desktop { @media (min-width: 1024px) { @content; } }
  ```
- [ ] **Step 5:** Replace `src/styles.scss` content with:
  ```scss
  @use 'styles/tokens';
  @use 'styles/reset';
  @use 'styles/typography';
  ```
- [ ] **Step 6:** In `src/index.html` `<head>`, before the existing `<link rel="icon">`, add:
  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  ```
- [ ] **Step 7:** Update `<title>` to `Wedding Planner`.
- [ ] **Step 8:** Verify: `npm start` boots without SCSS errors. Tokens not visible yet (no page consumes them); we only confirm compile.
- [ ] **Step 9:** Commit: `chore(frontend): wire SCSS tokens, reset, typography, fonts`.

---

### Task T2: Strip Angular hello template `[foundation]`

**Files:**
- Modify: `src/app/app.ts`
- Modify: `src/app/app.html`
- Modify: `src/app/app.scss`

- [ ] **Step 1:** Replace `src/app/app.html` with a single line: `<router-outlet />` followed by `<app-toast-host />` (we register the import in T11).
- [ ] **Step 2:** In `src/app/app.ts`, change `imports: [RouterOutlet]` to `imports: [RouterOutlet]` (will be expanded in T11). Remove `title = signal(...)`. Add `changeDetection: ChangeDetectionStrategy.OnPush`. The component class can be empty: `export class App {}`.
- [ ] **Step 3:** Empty `src/app/app.scss` (rely on global styles).
- [ ] **Step 4:** Run `npm start`; confirm blank page (no routes wired yet â€” that's OK, follow-up tasks fix it).
- [ ] **Step 5:** Commit: `chore(frontend): strip Angular default template`.

---

### Task T3: Environments + API URL helper `[foundation]`

**Files:**
- Create: `src/environments/environment.ts`
- Create: `src/environments/environment.prod.ts`
- Create: `src/app/core/env/app-env.ts`
- Create: `src/app/core/http/api-url.ts`
- Modify: `angular.json` (add fileReplacements for production config)

- [ ] **Step 1:** Create `src/environments/environment.ts`:
  ```typescript
  export const environment = {
    production: false,
    apiBaseUrl: '/api',
  } as const;
  ```
- [ ] **Step 2:** Create `src/environments/environment.prod.ts` with `production: true` and the same `apiBaseUrl: '/api'`.
- [ ] **Step 3:** Create `src/app/core/env/app-env.ts`:
  ```typescript
  export { environment as appEnv } from '../../../environments/environment';
  ```
- [ ] **Step 4:** Create `src/app/core/http/api-url.ts`:
  ```typescript
  import { appEnv } from '../env/app-env';
  export const apiUrl = (path: string): string => `${appEnv.apiBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  ```
- [ ] **Step 5:** In `angular.json` under `projects.wedding-planner.architect.build.configurations.production`, add:
  ```json
  "fileReplacements": [
    { "replace": "src/environments/environment.ts", "with": "src/environments/environment.prod.ts" }
  ]
  ```
- [ ] **Step 6:** Verify: `npm run build` succeeds.
- [ ] **Step 7:** Commit: `feat(frontend): add environment config + api URL helper`.

---

### Task T4: Domain models / DTOs `[foundation]`

**Files:**
- Create: `src/app/core/models/user.model.ts`
- Create: `src/app/core/models/wedding.model.ts`
- Create: `src/app/core/models/guest.model.ts`
- Create: `src/app/core/models/meal-option.model.ts`
- Create: `src/app/core/models/index.ts`

Spec ref: `docs/demo-app/04-database.md` lines 63-145 and 314-330.

- [ ] **Step 1:** Create `user.model.ts`:
  ```typescript
  export interface User {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    emailVerified: boolean;
  }
  export interface AuthSession {
    token: string;
    user: User;
  }
  export interface LoginRequest {
    email: string;
    password: string;
  }
  ```
- [ ] **Step 2:** Create `wedding.model.ts`:
  ```typescript
  export type WeddingMemberRole = 'partner_a' | 'partner_b';
  export interface Wedding {
    id: string;
    partnerAName: string;
    partnerBName: string;
    weddingDate: string;          // ISO yyyy-mm-dd
    ceremonyLocation: string | null;
    createdByUserId: string;
  }
  ```
- [ ] **Step 3:** Create `meal-option.model.ts`:
  ```typescript
  export interface MealOption {
    id: string;
    weddingId: string;
    label: string;
    sortOrder: number;
  }
  ```
- [ ] **Step 4:** Create `guest.model.ts`:
  ```typescript
  export type RsvpStatus = 'pending' | 'confirmed' | 'declined';
  export type Diet = 'pending' | 'standard' | 'vege' | 'vegan' | 'gluten_free';
  export type Relation =
    | 'rodzina_panny_mlodej'
    | 'rodzina_pana_mlodego'
    | 'przyjaciele_panny_mlodej'
    | 'przyjaciele_pana_mlodego'
    | 'znajomi_z_pracy'
    | 'wspolni_znajomi';
  export interface Guest {
    id: string;
    weddingId: string;
    firstName: string;
    lastName: string;
    relation: Relation;
    rsvpStatus: RsvpStatus;
    diet: Diet;
    hasPlusOne: boolean;
    isChild: boolean;
    mealOptionId: string | null;
    tableId: string | null;
    contactPhone: string | null;
    contactEmail: string | null;
  }
  export interface CreateGuestDto {
    firstName: string;
    lastName: string;
    relation: Relation;
    diet: Diet;
  }
  export type UpdateGuestDto = Partial<Omit<Guest, 'id' | 'weddingId'>>;
  export interface GuestAggregates {
    invited: number;
    confirmed: number;
    pending: number;
    declined: number;
    vegeOrVegan: number;
    children: number;
    noMealPick: number;
  }
  export interface GuestFilters {
    search: string;
    rsvp: RsvpStatus | 'all';
    diet: Diet | 'all';
    relation: Relation | 'all';
  }
  export const RELATION_LABELS: Record<Relation, string> = {
    rodzina_panny_mlodej: 'Rodzina Panny MĹ‚odej',
    rodzina_pana_mlodego: 'Rodzina Pana MĹ‚odego',
    przyjaciele_panny_mlodej: 'Przyjaciele Panny MĹ‚odej',
    przyjaciele_pana_mlodego: 'Przyjaciele Pana MĹ‚odego',
    znajomi_z_pracy: 'Znajomi z pracy',
    wspolni_znajomi: 'WspĂłlni znajomi',
  };
  export const DIET_LABELS: Record<Diet, string> = {
    pending: 'Nie wybrano',
    standard: 'Standard',
    vege: 'WegetariaĹ„ska',
    vegan: 'WegaĹ„ska',
    gluten_free: 'Bezglutenowa',
  };
  export const RSVP_LABELS: Record<RsvpStatus, string> = {
    pending: 'Oczekuje',
    confirmed: 'Potwierdzony',
    declined: 'Odmowa',
  };
  ```
- [ ] **Step 5:** Create `index.ts` barrel exporting all four model files.
- [ ] **Step 6:** Verify: `npm run build` succeeds.
- [ ] **Step 7:** Commit: `feat(frontend): add domain models (User, Wedding, Guest, MealOption)`.

---

### Task T5: Toast service + host `[foundation]`

**Files:**
- Create: `src/app/core/services/toast.service.ts`
- Create: `src/app/shared/ui/toast-host/{toast-host.ts,toast-host.html,toast-host.scss}`

- [ ] **Step 1:** `ToastService` exposes `toasts = signal<Toast[]>([])`, `show({kind:'success'|'error'|'info', message: string, durationMs?: number})`, `dismiss(id: string)`. `show()` generates an id, pushes the toast, and schedules `setTimeout(() => dismiss(id), durationMs ?? 4000)`. Provided in root.
- [ ] **Step 2:** `toast-host.ts` is a standalone component, `OnPush`, selector `app-toast-host`. It `inject(ToastService)` and renders the `toasts()` signal as a fixed bottom-right stack with `@for (t of toasts(); track t.id)`. Each toast: rounded-2xl card, background tinted by kind (`--color-success-bg` / `--color-danger-bg` / `--color-info-bg`), text and a small "Ă—" button calling `service.dismiss(t.id)`.
- [ ] **Step 3:** Add `ToastHost` to `App` component's `imports` (so `<app-toast-host />` in `app.html` resolves).
- [ ] **Step 4:** Verify: `npm start`; no console errors. Open devtools and call `toastService.show({kind: 'success', message: 'Test'})` from the component â€” toast appears (this is a sanity probe; remove the probe code before commit).
- [ ] **Step 5:** Commit: `feat(frontend): add ToastService + global ToastHost`.

---

### Task T6: AuthService + auth interceptor `[foundation]`

**Files:**
- Create: `src/app/core/services/auth.service.ts`
- Create: `src/app/core/http/auth.interceptor.ts`

- [ ] **Step 1:** `AuthService`:
  - Injects `HttpClient` and `Router`.
  - `private readonly _user = signal<User | null>(null)`; `readonly user = this._user.asReadonly()`.
  - `private readonly _token = signal<string | null>(localStorage.getItem('wp.token'))`; `readonly token = this._token.asReadonly()`.
  - `readonly isAuthenticated = computed(() => this._token() !== null)`.
  - `login(req: LoginRequest): Observable<AuthSession>` â†’ `this.http.post<AuthSession>(apiUrl('/auth/login'), req).pipe(tap(s => this.setSession(s)))`.
  - `logout(): void` clears both signals and `localStorage.removeItem('wp.token')`, navigates to `/`.
  - `me(): Observable<User>` â†’ `GET /auth/me`, on success `_user.set(user)`.
  - `refresh(): Observable<AuthSession>` â†’ `POST /auth/refresh` (will 404 for now â€” that's OK; failure path triggers logout).
  - Private `setSession(s)` writes token to localStorage and updates signals.
- [ ] **Step 2:** `auth.interceptor.ts` is a `HttpInterceptorFn`:
  ```typescript
  export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const auth = inject(AuthService);
    const token = auth.token();
    const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
    return next(authed).pipe(
      catchError((err) => {
        if (err.status === 401 && token && !req.url.includes('/auth/refresh')) {
          return auth.refresh().pipe(
            switchMap(s => next(req.clone({ setHeaders: { Authorization: `Bearer ${s.token}` } }))),
            catchError(() => { auth.logout(); return throwError(() => err); })
          );
        }
        return throwError(() => err);
      })
    );
  };
  ```
- [ ] **Step 3:** Verify: `npm run build` succeeds.
- [ ] **Step 4:** Commit: `feat(frontend): add AuthService + bearer interceptor with 1-attempt refresh`.

---

### Task T7: WeddingService + GuestsService + MealOptionsService `[foundation]`

**Files:**
- Create: `src/app/core/services/wedding.service.ts`
- Create: `src/app/core/services/guests.service.ts`
- Create: `src/app/core/services/meal-options.service.ts`

- [ ] **Step 1:** `WeddingService`:
  - `private _wedding = signal<Wedding | null>(null)`; `wedding = this._wedding.asReadonly()`.
  - `loadCurrent(): Observable<Wedding>` â†’ `GET /me/wedding`; on success `_wedding.set(w)`.
  - `daysUntilWedding = computed<number | null>(() => { const w = this._wedding(); if (!w) return null; const today = new Date(); today.setHours(0,0,0,0); const target = new Date(w.weddingDate); target.setHours(0,0,0,0); return Math.ceil((target.getTime() - today.getTime()) / 86_400_000); })`.
  - `coupleLabel = computed(() => { const w = this._wedding(); return w ? `${w.partnerAName} & ${w.partnerBName}` : ''; })`.
  - `coupleInitials = computed(() => { const w = this._wedding(); return w ? { a: w.partnerAName.charAt(0).toUpperCase(), b: w.partnerBName.charAt(0).toUpperCase() } : { a: '', b: '' }; })`.
- [ ] **Step 2:** `GuestsService`:
  - `private _guests = signal<Guest[]>([])`; `guests = this._guests.asReadonly()`.
  - `private _filters = signal<GuestFilters>({ search: '', rsvp: 'all', diet: 'all', relation: 'all' })`; `filters = this._filters.asReadonly()`.
  - `setFilters(patch: Partial<GuestFilters>): void` â†’ `this._filters.update(f => ({ ...f, ...patch }))`.
  - `aggregates = computed<GuestAggregates>(() => { const list = this._guests(); return { invited: list.length, confirmed: list.filter(g => g.rsvpStatus === 'confirmed').length, pending: list.filter(g => g.rsvpStatus === 'pending').length, declined: list.filter(g => g.rsvpStatus === 'declined').length, vegeOrVegan: list.filter(g => g.diet === 'vege' || g.diet === 'vegan').length, children: list.filter(g => g.isChild).length, noMealPick: list.filter(g => g.mealOptionId === null).length }; })`.
  - `filteredGuests = computed(() => { const f = this._filters(); const q = f.search.trim().toLowerCase(); return this._guests().filter(g => (f.rsvp === 'all' || g.rsvpStatus === f.rsvp) && (f.diet === 'all' || g.diet === f.diet) && (f.relation === 'all' || g.relation === f.relation) && (q === '' || `${g.firstName} ${g.lastName}`.toLowerCase().includes(q))); })`.
  - `groupedByRelation = computed(() => { const groups = new Map<Relation, Guest[]>(); for (const g of this.filteredGuests()) { const arr = groups.get(g.relation) ?? []; arr.push(g); groups.set(g.relation, arr); } return Array.from(groups.entries()); })`.
  - HTTP: `list(weddingId: string)` â†’ `GET /weddings/:weddingId/guests`, sets signal on success; `create(weddingId, dto)` â†’ `POST .../guests`; `update(weddingId, id, patch)` â†’ `PATCH .../guests/:id`; `remove(weddingId, id)` â†’ `DELETE .../guests/:id`.
- [ ] **Step 3:** `MealOptionsService`:
  - `private _mealOptions = signal<MealOption[]>([])`; `mealOptions = this._mealOptions.asReadonly()`.
  - `list(weddingId: string): Observable<MealOption[]>` â†’ `GET /weddings/:weddingId/meal-options`.
- [ ] **Step 4:** Verify: `npm run build` succeeds.
- [ ] **Step 5:** Commit: `feat(frontend): add WeddingService, GuestsService, MealOptionsService with signals + computed`.

---

### Task T8: Auth guard placeholder + format helpers `[foundation]`

**Files:**
- Create: `src/app/core/guards/auth.guard.ts`
- Create: `src/app/core/format/date.format.ts`
- Create: `src/app/core/format/currency.format.ts`

- [ ] **Step 1:** `auth.guard.ts`:
  ```typescript
  import { CanActivateFn } from '@angular/router';
  // TODO(M3+): wire real check â€” `inject(AuthService).isAuthenticated()` and redirect to '/' when false.
  // For M0-M2 we let everything through so /app and /app/goscie render even without a backend.
  export const authGuard: CanActivateFn = () => true;
  ```
- [ ] **Step 2:** `date.format.ts`:
  ```typescript
  export const formatDDMMYYYY = (input: string | Date | null | undefined): string => {
    if (!input) return '';
    const d = typeof input === 'string' ? new Date(input) : input;
    if (Number.isNaN(d.getTime())) return '';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}.${d.getFullYear()}`;
  };
  export const formatMonthShortPL = (input: string | Date): string => {
    const d = typeof input === 'string' ? new Date(input) : input;
    const months = ['sty','lut','mar','kwi','maj','cze','lip','sie','wrz','paĹş','lis','gru'];
    return months[d.getMonth()];
  };
  ```
- [ ] **Step 3:** `currency.format.ts`:
  ```typescript
  export const formatPLN = (amount: number | null | undefined): string => {
    if (amount === null || amount === undefined || Number.isNaN(amount)) return 'â€” zĹ‚';
    const rounded = Math.round(amount);
    const withSpaces = rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
    return `${withSpaces} zĹ‚`;
  };
  ```
- [ ] **Step 4:** Verify: `npm run build` succeeds.
- [ ] **Step 5:** Commit: `feat(frontend): add authGuard placeholder + date/currency formatters (Polish)`.

---

### Task T9: Wire `app.config.ts` with HTTP + animations + interceptor `[foundation]`

**Files:**
- Modify: `src/app/app.config.ts`

- [ ] **Step 1:** Replace contents:
  ```typescript
  import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideZonelessChangeDetection } from '@angular/core';
  import { provideRouter, withComponentInputBinding } from '@angular/router';
  import { provideHttpClient, withInterceptors } from '@angular/common/http';
  import { provideAnimations } from '@angular/platform-browser/animations';
  import { routes } from './app.routes';
  import { authInterceptor } from './core/http/auth.interceptor';

  export const appConfig: ApplicationConfig = {
    providers: [
      provideBrowserGlobalErrorListeners(),
      provideRouter(routes, withComponentInputBinding()),
      provideHttpClient(withInterceptors([authInterceptor])),
      provideAnimations(),
    ],
  };
  ```
  (Drop `provideZonelessChangeDetection` if the scaffold isn't already using it â€” Angular 21 zoneless default is opt-in; default `provideZoneChangeDetection` is fine for M0-M2. Pick one and stick with it; do NOT relitigate later.)
- [ ] **Step 2:** Verify: `npm run build` succeeds.
- [ ] **Step 3:** Commit: `feat(frontend): wire HttpClient with auth interceptor + animations`.

---

### Task T10: Shared UI primitives `[foundation]`

**Files (all under `src/app/shared/ui/<name>/`):** button, badge, dialog, combobox, progress-bar, input-text, input-date, input-password, page-header.

Run each primitive as its own small step so each is a clean commit. Pattern for every primitive:
- `OnPush`, standalone, no `NgModule`.
- Inputs via `input<T>()` signal function. Outputs via `output<T>()`.
- Host attributes via `host: { class: 'wp-button', '[attr.data-variant]': 'variant()' }`.
- Component-scoped SCSS that reads `var(--color-*)` tokens â€” NEVER hardcode color values.

- [ ] **Step 1 (Button):** `selector: 'app-button'`. Inputs: `variant = input<'primary'|'secondary'|'ghost'|'danger'>('primary')`, `size = input<'sm'|'md'|'lg'>('md')`, `disabled = input<boolean>(false)`, `type = input<'button'|'submit'|'reset'>('button')`, `fullWidth = input<boolean>(false)`. Template: `<button [type]="type()" [disabled]="disabled()" class="btn btn-{{variant()}} btn-{{size()}}" [class.full]="fullWidth()"><ng-content /></button>`. SCSS: primary uses `--color-accent` bg + white text; secondary `--color-surface` bg with `--color-accent` border + text; ghost transparent bg, `--color-text` text; danger `--color-danger` text. Sizes drive padding + font-size. `border-radius: var(--radius-2xl)`, transition on hover (lighten via `filter: brightness(1.05)`).
- [ ] **Step 2 (Badge):** `selector: 'app-badge'`. `tone = input<'success'|'warning'|'danger'|'neutral'|'info'>('neutral')`, `size = input<'sm'|'md'>('md')`. Template projects content. SCSS sets background from `--color-<tone>-bg`, text from `--color-<tone>`, `border-radius: 999px`, small padding.
- [ ] **Step 3 (Dialog):** `selector: 'app-dialog'`. `open = input<boolean>(false)`, `title = input<string>('')`, `closed = output<void>()`. Template: `@if (open()) { <div class="backdrop" (click)="closed.emit()" role="presentation"><div class="panel" role="dialog" aria-modal="true" [attr.aria-label]="title()" (click)="$event.stopPropagation()"><header><h2>{{ title() }}</h2><button class="close" type="button" (click)="closed.emit()" aria-label="Zamknij">Ă—</button></header><div class="body"><ng-content /></div><footer><ng-content select="[dialog-actions]" /></footer></div></div> }`. SCSS: fixed backdrop with `rgba(31,42,27,0.5)`, panel `var(--color-surface)` with `border-radius: var(--radius-2xl)`, `box-shadow: var(--shadow-lg)`, max-width 480px, padding 24px.
- [ ] **Step 4 (Combobox):** `selector: 'app-combobox'`. Implements `ControlValueAccessor`. `options = input<{value: string; label: string}[]>([])`, `placeholder = input<string>('Wybierz...')`, `label = input<string>('')`, `disabled = input<boolean>(false)`. Internally a native `<select>` styled with custom arrow via SCSS background-image (encoded SVG); label above; full-width within parent.
- [ ] **Step 5 (ProgressBar):** `selector: 'app-progress-bar'`. `value = input<number>(0)` (0..100), `tone = input<'auto'|'success'|'warning'|'danger'>('auto')`. When `auto`, derive: `<70 success, 70-90 warning, >90 danger` via `computed`. SCSS: outer track `--color-border`, inner fill colored, height 8px, rounded-full.
- [ ] **Step 6 (InputText / InputDate / InputPassword):** Each `ControlValueAccessor`, takes `label = input<string>('')`, `placeholder = input<string>('')`, `error = input<string | null>(null)`, `autocomplete = input<string>('off')`. InputPassword adds toggle button (eye icon as inline SVG) flipping `type` between `password` and `text`.
- [ ] **Step 7 (PageHeader):** `selector: 'app-page-header'`. `title = input.required<string>()`, `subtitle = input<string>('')`. Template: `<header class="page-header"><div><h1>{{ title() }}</h1>@if (subtitle()) {<p class="subtitle">{{ subtitle() }}</p>}</div><div class="actions"><ng-content /></div></header>`.
- [ ] **Step 8:** Commit after each primitive: `feat(frontend): add <Name> primitive`.

---

### Task T11: Layout shells â€” AppShell, MarketingShell, AppHeader, AppSidebar, MobileBottomNav, CoupleAvatarPair `[foundation]`

**Files:** under `src/app/shared/layout/`.

- [ ] **Step 1 (CoupleAvatarPair):** Inputs `initialA = input.required<string>()`, `initialB = input.required<string>()`, `label = input<string>('Konto poĹ‚Ä…czone')`. Renders two circular badges with the two initials, slight overlap, label text-muted to the right.
- [ ] **Step 2 (AppSidebar):** Standalone. `OnPush`. Imports `RouterLink`, `RouterLinkActive`. Renders the 9 nav items as a `<nav>` `<ul>`. **Only Dashboard, GoĹ›cie are clickable links during M0-M2; the other 7 are rendered as `<button disabled>` with the same row layout and a tooltip "WkrĂłtce" via `title` attribute.** The 9 items, in order:
  1. Dashboard â†’ `/app` (active)
  2. GoĹ›cie â†’ `/app/goscie` (active)
  3. Kontrahenci (disabled)
  4. Umowy (disabled)
  5. BudĹĽet (disabled)
  6. Oferta sali (disabled)
  7. Zadania (disabled)
  8. Rozsadzenie (disabled)
  9. Ustawienia (disabled)
  Each row: inline SVG icon (16x16) + label. Active row has `--color-accent-dark` background, white text. Sidebar background `--color-accent`, text `--color-bg`. Header section at top: "Wesele 2026" serif, then `{{ wedding.weddingDate | formatted }}` (use `WeddingService.wedding()?.weddingDate` formatted via `formatDDMMYYYY`). Footer: `<p class="tip">ZaproĹş partnera w Ustawieniachâ€¦</p>`. Width 220px sticky. Hidden via `@include mobile { display: none; }`.
- [ ] **Step 3 (MobileBottomNav):** Same link list as sidebar, but rendered as horizontal scroll strip fixed at bottom, only visible `@include mobile`. Each item: icon + 8px label below; active state same dark-green tint.
- [ ] **Step 4 (AppHeader):** Pulls from `WeddingService`. Layout: heart SVG + "Wedding Planner" / `coupleLabel()`; centered: "DO ĹšLUBU" small, then `daysUntilWedding()` large with " dni", then `formatDDMMYYYY(wedding().weddingDate)`. Right: `<app-couple-avatar-pair [initialA]="initials().a" [initialB]="initials().b" />` + a placeholder avatar button "WK". Height `var(--header-height)`, background `--color-surface`, bottom border `--color-border`. On mobile (`@include mobile`), hide the centered counter.
- [ ] **Step 5 (AppShell):** Container for `/app` routes. Template:
  ```html
  <div class="app-shell">
    <app-sidebar />
    <div class="main">
      <app-header />
      <main class="content"><router-outlet /></main>
    </div>
    <app-mobile-bottom-nav />
  </div>
  ```
  SCSS: `.app-shell { display: grid; grid-template-columns: var(--sidebar-width) 1fr; min-height: 100vh; } .main { display: flex; flex-direction: column; } .content { padding: var(--space-8); max-width: var(--page-max); width: 100%; }`. Mobile: `grid-template-columns: 1fr; padding-bottom: 72px;` (room for bottom nav).
- [ ] **Step 6 (MarketingShell):** For `/` only. Split 50/50 desktop. Left: `--color-accent` background, white serif headline "Wedding Planner" + tagline + hero. Right: cream `--color-bg`, `<router-outlet />` for the login content. Mobile: stack, left becomes 30vh banner, right is form full-width.
- [ ] **Step 7:** Commit after each: `feat(frontend): add <Name> layout`.

---

### Task T12: Lazy routes `[foundation]`

**Files:**
- Modify: `src/app/app.routes.ts`

- [ ] **Step 1:** Replace contents:
  ```typescript
  import { Routes } from '@angular/router';
  import { authGuard } from './core/guards/auth.guard';

  export const routes: Routes = [
    {
      path: '',
      loadComponent: () => import('./shared/layout/marketing-shell/marketing-shell').then(m => m.MarketingShell),
      children: [
        {
          path: '',
          loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage),
          pathMatch: 'full',
        },
      ],
    },
    {
      path: 'app',
      loadComponent: () => import('./shared/layout/app-shell/app-shell').then(m => m.AppShell),
      canActivate: [authGuard],
      children: [
        {
          path: '',
          loadComponent: () => import('./pages/dashboard/dashboard.page').then(m => m.DashboardPage),
          pathMatch: 'full',
        },
        {
          path: 'goscie',
          loadComponent: () => import('./pages/guests/guests.page').then(m => m.GuestsPage),
        },
      ],
    },
    { path: '**', redirectTo: '' },
  ];
  ```
- [ ] **Step 2:** Pages don't exist yet â€” these imports will error. That's acceptable temporarily; foundation merges in T13.
- [ ] **Step 3:** Do NOT commit yet â€” wait for T13.

---

### Task T13: Stub the three pages so foundation compiles end-to-end `[foundation]`

**Files:**
- Create: `src/app/pages/login/{login.page.ts,login.page.html,login.page.scss}`
- Create: `src/app/pages/dashboard/{dashboard.page.ts,dashboard.page.html,dashboard.page.scss}`
- Create: `src/app/pages/guests/{guests.page.ts,guests.page.html,guests.page.scss}`

- [ ] **Step 1:** Each is a minimal standalone component that just renders `<app-page-header [title]="'<page name>'" />` and a `<p>WkrĂłtce</p>` placeholder. The leaf tasks T14-T16 replace each one's body.
- [ ] **Step 2:** Verify: `npm start` boots, navigation between `/`, `/app`, `/app/goscie` works. Sidebar shows; bottom nav shows on mobile resize. Header shows "DO ĹšLUBU" with no number (wedding data not loaded).
- [ ] **Step 3:** Commit T12 + T13 together: `feat(frontend): lazy routes + page stubs (Login/Dashboard/GoĹ›cie)`.

**Foundation complete. T14, T15, T16 are now parallelizable.**

---

## Leaf Tasks (parallelizable)

### Task T14: Login page `[leaf:login]`

**Spec ref:** `docs/demo-app/02-frontend.md` lines 218-227 (LoginForm spec); `01-overview.md` lines 29-34 (Flow 1); shell `02-frontend.md` line 40.

**Foundation outputs consumed:**
- Tokens: `src/styles/_tokens.scss`.
- Services: `AuthService` (`login()` method, `user` signal), `ToastService` (`show()`).
- Primitives: `Button`, `InputText`, `InputPassword`, `PageHeader`.
- Layout: rendered inside `MarketingShell` (split-screen).

**HTTP calls issued (expect 404/500 â€” DO NOT try to "fix" the network):**
- `POST /api/auth/login` body `{ email, password }` â€” backend not implemented; expected to fail. Catch the error and surface a toast.

**Files:**
- Modify: `src/app/pages/login/login.page.ts` (replace stub)
- Modify: `src/app/pages/login/login.page.html`
- Modify: `src/app/pages/login/login.page.scss`

- [ ] **Step 1:** Standalone component, `OnPush`, imports `ReactiveFormsModule`, `Button`, `InputText`, `InputPassword`, `RouterLink`. `inject(AuthService)`, `inject(ToastService)`, `inject(Router)`, `inject(FormBuilder)`.
- [ ] **Step 2:** Build reactive form:
  ```typescript
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });
  readonly submitting = signal(false);
  readonly emailError = computed(() => {
    const c = this.form.controls.email;
    if (!c.touched || c.valid) return null;
    if (c.errors?.['required']) return 'Podaj e-mail';
    if (c.errors?.['email']) return 'Niepoprawny format e-mail';
    return null;
  });
  readonly passwordError = computed(...);
  ```
  Note: form control errors are observed via `valueChanges`/`statusChanges` if we want fully signal-driven. For M0-M2 a simple `(blur)` + `form.controls.email.touched` check inside a getter or pipe is acceptable; pick one approach and stick to it.
- [ ] **Step 3:** Template:
  ```html
  <section class="login">
    <header>
      <h1>Witaj ponownie</h1>
      <p class="subtitle">Zaloguj siÄ™, by kontynuowaÄ‡ planowanie wesela.</p>
    </header>
    <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
      <app-input-text label="E-mail" formControlName="email" autocomplete="email" [error]="emailError()" />
      <app-input-password label="HasĹ‚o" formControlName="password" autocomplete="current-password" [error]="passwordError()" />
      <app-button type="submit" variant="primary" size="lg" [fullWidth]="true" [disabled]="form.invalid || submitting()">
        @if (submitting()) { Logowanieâ€¦ } @else { Zaloguj siÄ™ }
      </app-button>
    </form>
    <p class="footer-link">Nie masz konta? <a routerLink="/">Skontaktuj siÄ™ z partnerem</a></p>
  </section>
  ```
- [ ] **Step 4:** `onSubmit()`:
  ```typescript
  onSubmit() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => this.router.navigateByUrl('/app'),
      error: () => {
        this.submitting.set(false);
        this.toast.show({ kind: 'error', message: 'NieprawidĹ‚owy e-mail lub hasĹ‚o' });
      },
      complete: () => this.submitting.set(false),
    });
  }
  ```
- [ ] **Step 5:** SCSS: card-style container, max-width 380px, padding 32px, serif h1, sans paragraph muted; form gap 16px. Consume only tokens.
- [ ] **Step 6:** Verify manually: `/` renders split-screen; submitting empty form shows validation; submitting valid form shows toast "NieprawidĹ‚owy e-mail lub hasĹ‚o" (because backend 404s).
- [ ] **Step 7:** Commit: `feat(frontend): Login page with reactive form, validation, toast on failure`.

**Acceptance criteria:**
- Form validates: email format + min 8 password; invalid shows inline errors.
- Submit calls `AuthService.login()`.
- Network failure surfaces toast `'NieprawidĹ‚owy e-mail lub hasĹ‚o'`.
- Submit button shows `Logowanieâ€¦` while in-flight, returns to `Zaloguj siÄ™` after.
- Page lives under `MarketingShell` (split-screen visible).
- All labels Polish; no English in DOM.

---

### Task T15: Dashboard page `[leaf:dashboard]`

**Spec ref:** `docs/demo-app/02-frontend.md` lines 74-83 (Dashboard components); `01-overview.md` line 17 (4 KPIs + Wymaga uwagi + NadchodzÄ…ce spotkania).

**Foundation outputs consumed:**
- Services: `WeddingService` (`wedding`, `daysUntilWedding`, `coupleLabel`), `GuestsService` (`aggregates`).
- Primitives: `ProgressBar`, `Badge`, `Button`, `PageHeader`.
- Format helpers: `formatDDMMYYYY`, `formatPLN`, `formatMonthShortPL`.
- Layout: rendered inside `AppShell`.

**HTTP calls issued (expect 404/500 â€” services will set empty/null state; UI must render gracefully):**
- `GET /api/me/wedding` (via `WeddingService.loadCurrent()`).
- `GET /api/weddings/:weddingId/guests` (via `GuestsService.list()`). The wedding id is null until the first call succeeds â€” guard with `@if (wedding(); as w) { ... }` and show a "Ĺadowanie..." skeleton otherwise.

For Budget/Payments/Tasks KPIs, **render hardcoded zero/placeholder values** â€” services for those slices are out of scope. Comment with `// TODO(M4+): wire BudgetService` etc.

**Files:**
- Modify: `src/app/pages/dashboard/dashboard.page.{ts,html,scss}`
- Create: `src/app/pages/dashboard/components/hero-counter/{*.ts,*.html,*.scss}`
- Create: `src/app/pages/dashboard/components/kpi-card/{*.ts,*.html,*.scss}`
- Create: `src/app/pages/dashboard/components/attention-list/{*.ts,*.html,*.scss}`
- Create: `src/app/pages/dashboard/components/upcoming-meetings/{*.ts,*.html,*.scss}`

- [ ] **Step 1 (HeroCounter):** Inputs `days = input.required<number | null>()`, `partnerA = input.required<string>()`, `partnerB = input.required<string>()`, `weddingDate = input.required<string>()`. Template: large serif `<h1>Do Ĺ›lubu zostaĹ‚o <strong>{{ days() ?? 'â€”' }} dni</strong></h1>` + subtitle `{{ partnerA() }} & {{ partnerB() }} Â· {{ formatDDMMYYYY(weddingDate()) }}`.
- [ ] **Step 2 (KpiCard):** Generic shell. Inputs: `label = input.required<string>()`, `value = input.required<string>()` (already formatted), `progress = input<number | null>(null)`, `progressTone = input<'auto'|'success'|'warning'|'danger'>('auto')`, `footer = input<string>('')`, `cta = input<{label: string; routerLink: string} | null>(null)`. Template: card with rounded-2xl, padding 24px, label uppercase tracking-wide muted, big value serif, optional `<app-progress-bar>`, optional small footer line, optional `<a [routerLink]>` CTA. Compose, don't hardcode the four variants.
- [ ] **Step 3 (AttentionList):** Inputs `items = input<AttentionItem[]>([])` where `AttentionItem = { icon: string; title: string; due: string; overdue: boolean; ctaRouterLink: string }`. Renders empty state "Brak pilnych spraw" when array is empty (it will be, since we have no backend). Each item: icon + title + due with `app-badge` tone `danger` if overdue or `warning` otherwise.
- [ ] **Step 4 (UpcomingMeetings):** Inputs `items = input<MeetingItem[]>([])` where `MeetingItem = { date: string; title: string; time: string; location: string }`. Each item: left box with month-short + day-number large; right column title + time + location. Empty state "Brak nadchodzÄ…cych spotkaĹ„".
- [ ] **Step 5 (DashboardPage):** `OnPush`. `inject(WeddingService)`, `inject(GuestsService)`. In constructor: call `weddingService.loadCurrent().subscribe({ error: () => {} })` and chain (or separately) `guestsService.list(weddingId)` once wedding is loaded â€” use `effect()` watching `wedding.wedding()` for the chain.
  Template:
  ```html
  <app-page-header title="Dashboard" subtitle="Stan na dziĹ›" />

  @if (wedding.wedding(); as w) {
    <app-hero-counter [days]="wedding.daysUntilWedding()" [partnerA]="w.partnerAName" [partnerB]="w.partnerBName" [weddingDate]="w.weddingDate" />
  } @else {
    <p class="muted">Ĺadowanieâ€¦</p>
  }

  <section class="kpi-grid">
    <app-kpi-card
      label="GoĹ›cie"
      [value]="guests.aggregates().invited + ' / ' + guests.aggregates().invited"
      [progress]="guestsProgress()"
      [footer]="guests.aggregates().pending + ' oczekuje Â· ' + guests.aggregates().declined + ' odmĂłw'"
      [cta]="{ label: 'Zobacz listÄ™ â†’', routerLink: '/app/goscie' }" />
    <app-kpi-card label="BudĹĽet" value="â€” zĹ‚" [progress]="null" footer="WkrĂłtce" />
    <app-kpi-card label="NajbliĹĽsze pĹ‚atnoĹ›ci" value="â€”" footer="WkrĂłtce" />
    <app-kpi-card label="Zadania" value="â€”" footer="WkrĂłtce" />
  </section>

  <section class="dash-grid">
    <app-attention-list [items]="[]" />
    <app-upcoming-meetings [items]="[]" />
  </section>
  ```
- [ ] **Step 6:** `guestsProgress = computed(() => { const a = this.guests.aggregates(); return a.invited === 0 ? 0 : Math.round((a.confirmed / a.invited) * 100); });`.
- [ ] **Step 7:** SCSS: `.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--space-6); margin: var(--space-8) 0; }` with `@include tablet { grid-template-columns: repeat(2, 1fr); }` and `@include mobile { grid-template-columns: 1fr; }`. `.dash-grid` two columns on desktop, one on mobile.
- [ ] **Step 8:** Verify: `/app` renders; hero counter shows `â€”` days; guests KPI shows `0 / 0`; AttentionList and UpcomingMeetings show empty states; no console errors after the expected `/me/wedding` and `/guests` 404s.
- [ ] **Step 9:** Commit: `feat(frontend): Dashboard page with KPI grid, hero counter, attention list, upcoming meetings`.

**Acceptance criteria:**
- Page renders inside `AppShell` (sidebar + header visible).
- Hero counter binds to `WeddingService.daysUntilWedding()`; falls back to `â€”` when wedding is null.
- Guests KPI is wired to `GuestsService.aggregates()` (live, not hardcoded); other three KPIs are placeholders with `footer="WkrĂłtce"`.
- Backend errors are caught silently (no toasts, no crashes).
- All copy Polish; date in `DD.MM.YYYY` format.

---

### Task T16: GoĹ›cie page `[leaf:guests]`

**Spec ref:** `docs/demo-app/02-frontend.md` lines 85-94 (Guests components); `02-frontend.md` lines 229-238 (AddGuestDialog form); `04-database.md` lines 127-147 (Guest entity); `01-overview.md` Flow 2.

**Foundation outputs consumed:**
- Services: `GuestsService` (`guests`, `aggregates`, `filteredGuests`, `groupedByRelation`, `filters`, `setFilters`, `create`, `list`), `WeddingService` (for `weddingId`), `MealOptionsService` (loaded but not consumed in M0-M2 â€” `AddGuestDialog` is 4-field only per spec), `ToastService`.
- Primitives: `Button`, `Badge`, `Dialog`, `Combobox`, `InputText`, `PageHeader`.
- Format helpers: none (all string).
- Layout: rendered inside `AppShell`.
- Models: `Guest`, `Relation`, `Diet`, `RsvpStatus`, `RELATION_LABELS`, `DIET_LABELS`, `RSVP_LABELS`.

**HTTP calls issued (expect 404/500):**
- `GET /api/weddings/:weddingId/guests` (initial load via `GuestsService.list()`).
- `POST /api/weddings/:weddingId/guests` (on AddGuestDialog submit via `GuestsService.create()`).

Failures must keep UI responsive: toast "Nie udaĹ‚o siÄ™ dodaÄ‡ goĹ›cia. SprĂłbuj ponownie." and keep dialog open with retry possible.

**Files:**
- Modify: `src/app/pages/guests/guests.page.{ts,html,scss}`
- Create: `src/app/pages/guests/components/guests-aggregate-bar/{*.ts,*.html,*.scss}`
- Create: `src/app/pages/guests/components/guest-search/{*.ts,*.html,*.scss}`
- Create: `src/app/pages/guests/components/guest-filters/{*.ts,*.html,*.scss}`
- Create: `src/app/pages/guests/components/guest-group-table/{*.ts,*.html,*.scss}`
- Create: `src/app/pages/guests/components/rsvp-badge/{*.ts,*.html,*.scss}`
- Create: `src/app/pages/guests/components/diet-badge/{*.ts,*.html,*.scss}`
- Create: `src/app/pages/guests/components/add-guest-dialog/{*.ts,*.html,*.scss}`

- [ ] **Step 1 (RsvpBadge):** Wraps `<app-badge>`. Input `status = input.required<RsvpStatus>()`. Maps: `pending`â†’tone `warning` + label `RSVP_LABELS.pending` + emoji `âŹł`; `confirmed`â†’tone `success` + `âś…`; `declined`â†’tone `danger` + `âťŚ`.
- [ ] **Step 2 (DietBadge):** Input `diet = input.required<Diet>()`. Maps: `pending`â†’`neutral`/`â€”`/`nie wybrano`; `standard`â†’`neutral`/`Standard`; `vege`â†’custom bg `--color-pastel-vege`/`đźŚ± Wege`; `vegan`â†’`--color-pastel-vegan`/`đźŚż Wegan`; `gluten_free`â†’`--color-pastel-gf`/`đźŚľ Bezgl.`. (DietBadge uses its own `<span class="diet-badge diet-{{diet()}}">` rather than `<app-badge>` because of the custom pastels; tokens still drive the colors.)
- [ ] **Step 3 (GuestsAggregateBar):** Input `aggregates = input.required<GuestAggregates>()`. Renders 7 stat tiles in a sticky horizontal bar:
  - Zaproszonych: `invited`
  - Potwierdzonych: `confirmed`
  - Oczekuje: `pending`
  - OdmĂłw: `declined`
  - Wege: `vegeOrVegan`
  - Dzieci: `children`
  - Nie wybraĹ‚o dania: `noMealPick` (with warning badge `app-badge` tone `warning` when > 0)
  SCSS: sticky `top: 0`, background `--color-surface`, border-radius 2xl, padding, grid `repeat(7, 1fr)` on desktop, `repeat(2, 1fr)` on mobile (wraps to 4 rows).
- [ ] **Step 4 (GuestSearch):** Wraps `<app-input-text>` with a left-aligned magnifier SVG; output `query = output<string>()` emitted on `input` event. Or simpler: `value = input<string>('')`, `valueChange = output<string>()`. Use 300ms debounce via RxJS `debounceTime` in `effect()` to avoid jankiness.
- [ ] **Step 5 (GuestFilters):** Three `<app-combobox>` instances:
  - Status RSVP: options "Wszystkie", "Potwierdzony", "Oczekuje", "Odmowa" (values `'all' | RsvpStatus`).
  - Dieta: options "Wszystkie" + `DIET_LABELS` entries.
  - Relacja: options "Wszystkie" + `RELATION_LABELS` entries.
  Outputs `change = output<GuestFilters>()` (full snapshot).
- [ ] **Step 6 (GuestGroupTable):** Inputs `relation = input.required<Relation>()`, `guests = input.required<Guest[]>()`. Header: relation label (from `RELATION_LABELS`) + `app-badge` with count. Table 4 columns: ImiÄ™ i nazwisko, RSVP (`<app-rsvp-badge>`), Dieta (`<app-diet-badge>`), StĂłĹ‚. "StĂłĹ‚" displays `'â€”'` (no tables service in scope). Use semantic `<table>`/`<thead>`/`<tbody>`. Horizontal scroll on mobile via `overflow-x: auto`.
- [ ] **Step 7 (AddGuestDialog):** Wraps `<app-dialog>`. Inputs `open = input<boolean>(false)`, outputs `closed = output<void>()`, `submitted = output<CreateGuestDto>()`. Form (Reactive):
  ```typescript
  form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required, Validators.maxLength(60)]],
    lastName:  ['', [Validators.required, Validators.maxLength(80)]],
    relation:  ['rodzina_panny_mlodej' as Relation, Validators.required],
    diet:      ['standard' as Diet, Validators.required],
  });
  ```
  Template inside `<app-dialog [open]="open()" title="Dodaj goĹ›cia" (closed)="onClose()">`:
  - `<app-input-text formControlName="firstName" label="ImiÄ™" />`
  - `<app-input-text formControlName="lastName" label="Nazwisko" />`
  - `<app-combobox formControlName="relation" label="Relacja" [options]="relationOptions" />`
  - `<app-combobox formControlName="diet" label="Dieta" [options]="dietOptions" />`
  - In `[dialog-actions]` slot: `<app-button variant="ghost" (click)="onClose()">Anuluj</app-button>` + `<app-button type="submit" variant="primary" (click)="onSubmit()" [disabled]="form.invalid">Dodaj</app-button>`.
  Reset form on `open()` going falseâ†’true via `effect`.
- [ ] **Step 8 (GuestsPage):** `inject(GuestsService)`, `inject(WeddingService)`, `inject(ToastService)`. `effect` watches `wedding.wedding()`; on first non-null value, call `guestsService.list(w.id).subscribe({ error: () => {} })`. Signal `dialogOpen = signal(false)`.
  Template:
  ```html
  <app-page-header title="GoĹ›cie" subtitle="Lista zaproszonych z RSVP">
    <app-button variant="primary" (click)="dialogOpen.set(true)">+ Dodaj goĹ›cia</app-button>
  </app-page-header>

  <app-guests-aggregate-bar [aggregates]="guests.aggregates()" />

  <div class="toolbar">
    <app-guest-search [value]="guests.filters().search" (valueChange)="guests.setFilters({ search: $event })" />
    <app-guest-filters [value]="guests.filters()" (change)="guests.setFilters($event)" />
  </div>

  @if (guests.groupedByRelation().length === 0) {
    <p class="empty">Brak goĹ›ci speĹ‚niajÄ…cych kryteria.</p>
  } @else {
    @for (group of guests.groupedByRelation(); track group[0]) {
      <app-guest-group-table [relation]="group[0]" [guests]="group[1]" />
    }
  }

  <app-add-guest-dialog
    [open]="dialogOpen()"
    (closed)="dialogOpen.set(false)"
    (submitted)="onAdd($event)" />
  ```
- [ ] **Step 9:** `onAdd(dto)`:
  ```typescript
  onAdd(dto: CreateGuestDto) {
    const w = this.wedding.wedding();
    if (!w) return;
    this.guests.create(w.id, dto).subscribe({
      next: () => {
        this.dialogOpen.set(false);
        this.toast.show({ kind: 'success', message: 'Dodano goĹ›cia.' });
      },
      error: () => this.toast.show({ kind: 'error', message: 'Nie udaĹ‚o siÄ™ dodaÄ‡ goĹ›cia. SprĂłbuj ponownie.' }),
    });
  }
  ```
- [ ] **Step 10:** SCSS: toolbar flex row on desktop, column on mobile; `.empty` muted centered with padding.
- [ ] **Step 11:** Verify manually: `/app/goscie` renders empty state (no guests) with aggregate bar showing all zeros; opening AddGuestDialog shows form; submitting valid form shows error toast (backend 404).
- [ ] **Step 12:** Commit: `feat(frontend): GoĹ›cie page with aggregate bar, filters, grouped table, AddGuestDialog`.

**Acceptance criteria:**
- Aggregate bar binds live to `GuestsService.aggregates()`.
- Search debounces 300ms; filters apply immediately; `filteredGuests` flows into `groupedByRelation`.
- Empty state copy: `'Brak goĹ›ci speĹ‚niajÄ…cych kryteria.'` (Polish).
- AddGuestDialog has exactly the 4 fields per spec: `firstName`, `lastName`, `relation`, `diet`. NOT 5+ fields. (Spec line 92 is explicit.)
- Submit on dialog calls `GuestsService.create()`; failure toast keeps dialog open; success closes dialog + success toast.
- Defaults: relation `rodzina_panny_mlodej`, diet `standard` (spec line 234).
- All Polish UI, no English.

---

## Out-of-scope (do NOT touch in M0-M2)

The following pages, services, and primitives are M3+. Creating files for them is scope creep:

- Pages: `kontrahenci`, `umowy`, `budzet`, `oferta-sali` (catering), `zadania`, `rozsadzenie`, `ustawienia`.
- Services: `VendorsService`, `ContractsService`, `BudgetService`, `CateringService`, `TasksService`, `SeatingService`, `SettingsService`.
- Components: `VendorCard`, `ContractsTable`, `PaymentDots`, `BudgetCategoryRow`, `TaskRow`, `RoundTable`, `OfferEditor`, `PriceSummary`, `FreezeContractDialog`, `CoupleProfileForm`, etc.
- The 7 disabled sidebar links remain disabled `<button>` elements with `title="WkrĂłtce"` â€” they MUST NOT become `<a routerLink>` and MUST NOT create routes.

If a leaf agent feels tempted to "just stub the Vendors service while I'm here" â€” push back. M3 will add it. The plan ends at the GoĹ›cie page.

---

## Risks and assumptions

1. **Assumption (locked):** `WeddingService.daysUntilWedding` is a `computed()` derived from `wedding().weddingDate` minus today. The spec says "computed" but doesn't define the algorithm. I used `Math.ceil((target - today) / 86400000)` with both dates normalized to midnight. Plan codifies this so leaf agents don't reinvent it.
2. **Assumption (locked):** `WeddingMemberRole` ('partner_a' / 'partner_b') is in the domain models but unused by M0-M2 pages. It belongs to `wedding_members` rows the backend would return inside the Wedding payload. We keep the type ready; the field is not yet surfaced in `Wedding`.
3. **Assumption (locked):** `provideZoneChangeDetection` (default, classic zone) is used, not `provideZonelessChangeDetection`. Switching to zoneless is a separate decision worth a dedicated plan; mixing it with first-time scaffolding is too many changes at once.
4. **Risk:** `@angular/cdk` is not yet a dependency. `Dialog` is hand-rolled with a backdrop + ESC handler. If the user wants CDK-based overlay (focus trap, scroll lock) we'd need `npm i @angular/cdk` and refactor â€” out of scope here.
5. **Risk:** Form errors via signals â€” Angular forms still emit through `valueChanges`/`statusChanges` Observables. The plan uses `computed()` over `controls.X.touched + .errors` which Angular DOES change-detect, but is **not** a true signal source. If subagents see lint warnings about signals reading non-signals, accept and move on; converting to `toSignal(form.statusChanges)` is a refinement, not a blocker.
6. **Risk:** The `index.html` already contains an SSO SDK `<script>` from `kubitksso.pl`. The plan does NOT integrate with it during M0-M2. `AuthService.login()` is HTTP-only against `/api/auth/login`. SSO wiring is M3+ and will be its own plan.
7. **Decision (locked):** `Combobox` uses native `<select>`, not a custom listbox. Native works with `ControlValueAccessor`, is accessible by default, and ships zero extra JS. Spec mentions "dropdown with `Wszystkie` as default" â€” native select satisfies this. If product wants searchable combobox later, that's M4+.
8. **Decision (locked):** Mobile breakpoint is `768px`. The spec (lines 271-275) gives `â‰Ą1024 / 768-1023 / <768`. Three breakpoints; the plan supplies all three mixins, but for M0-M2 we only differentiate desktop (`â‰Ą1024`) and mobile (`<768`). Tablet is `desktop` styling for now â€” a polish item, not a blocker.
9. **Decision (locked):** No tests in M0-M2. The TDD culture from `writing-plans` is right in principle, but this milestone is scaffolding three UI pages against a non-existent backend. Unit tests on signal-driven components require an Angular testing harness setup (Karma or Vitest+Angular) that itself is foundation work bigger than the pages. M3 should add the testing harness as its own dedicated foundation task, then write tests retroactively. Subagents implementing T14-T16 should NOT block on missing tests.

---

## Self-review checklist (done)

1. **Spec coverage:** Login form (T14), Dashboard with 4 KPIs + Attention + Meetings (T15), GoĹ›cie with aggregate bar + 3 filters + 4-field AddGuestDialog + grouped table (T16), app shell with sidebar + header + counter + couple avatars (T11), marketing shell split-screen for `/` (T11), all primitives mentioned in `02-frontend.md` lines 175-182 (T10), domain models for `users`/`weddings`/`wedding_members`/`guests`/`meal_options` (T4), `WeddingService`/`AuthService`/`GuestsService`/`MealOptionsService`/`ToastService` (T5-T7), HTTP layer with bearer + 401 refresh stub (T6+T9), tokens locked to spec colors/fonts (T1), Polish UI everywhere (T14-T16), DD.MM.YYYY date and `32 000 zĹ‚` currency (T8), `relation`/`diet`/`rsvp_status` enums verbatim from `04-database.md` (T4), `diet='pending'` default and "nie wybraĹ‚o dania" KPI semantics (T4+T16). The 9-item sidebar with 7 disabled (T11) addresses the navigation spec without leaking M3+ scope.
2. **Placeholder scan:** Every step lists exact files, exact code blocks or exact field lists. No TBDs, no "implement later", no "add appropriate validation" without showing the validators.
3. **Type consistency:** `Wedding.partnerAName` used in `WeddingService.coupleLabel`, `WeddingService.coupleInitials`, `AppHeader`, `HeroCounter` â€” same field everywhere. `Guest.mealOptionId` (camelCase, not snake_case) consistent. `GuestAggregates` fields (`invited`, `confirmed`, `pending`, `declined`, `vegeOrVegan`, `children`, `noMealPick`) match the 7 KPIs in `GuestsAggregateBar`. `GuestFilters` shape matches `setFilters` calls in `GuestsPage`.

---

## Critical Files for Implementation

- C:\Users\kacpe\Desktop\Aplikacje\10xdevs\wedding-planner\frontend\src\styles\_tokens.scss (create) â€” locked design tokens, referenced by every primitive and shell.
- C:\Users\kacpe\Desktop\Aplikacje\10xdevs\wedding-planner\frontend\src\app\app.config.ts (modify) â€” registers HttpClient + auth interceptor + animations; without it, no HTTP works.
- C:\Users\kacpe\Desktop\Aplikacje\10xdevs\wedding-planner\frontend\src\app\app.routes.ts (modify) â€” lazy routes for `/`, `/app`, `/app/goscie`; everything bootstraps through here.
- C:\Users\kacpe\Desktop\Aplikacje\10xdevs\wedding-planner\frontend\src\app\core\services\guests.service.ts (create) â€” single source for guests state + aggregates + filters; consumed by Dashboard KPI and the entire GoĹ›cie page.
- C:\Users\kacpe\Desktop\Aplikacje\10xdevs\wedding-planner\frontend\src\app\shared\layout\app-shell\app-shell.ts (create) â€” the layout every authenticated page lives inside; foundation gate for both Dashboard and GoĹ›cie leaves.
