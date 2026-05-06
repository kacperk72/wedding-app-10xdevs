# Target Stack Reference

The user's preferred stack, taken from their `CLAUDE.md`. Use these patterns when writing `05-implementation-plan.md` and any code samples in the other docs.

## Frontend — Angular 20+

- **Standalone components only** — no NgModules.
- **Signals for state**: `signal()`, `computed()` for derived state. No NgRx.
- **Dependency injection**: `inject()` function inside the component class, not constructor parameters.
- **Control flow**: `@if`, `@for`, `@switch` in templates. Not `*ngIf`/`*ngFor`.
- **Inputs/outputs**: `input()` and `output()` functions, not `@Input()`/`@Output()` decorators.
- **Change detection**: `OnPush` everywhere.
- **Host bindings**: in the `host` field of the decorator, not `@HostBinding`.
- **Routing**: `provideRouter` with lazy-loaded routes (`loadComponent: () => import(…)`).
- **HTTP**: `HttpClient` with `provideHttpClient(withInterceptors([…]))`.
- **Forms**: Reactive Forms (`FormGroup`, `FormControl`).
- **Styling**: SCSS, component-scoped (`styleUrl` or `styles`).
- **Testing**: Vitest preferred for new apps; Karma/Jasmine acceptable on legacy.

Skeleton component:

```ts
@Component({
  selector: 'app-task-list',
  standalone: true,
  imports: [TaskCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (task of tasks(); track task.id) {
      <app-task-card [task]="task" (delete)="remove($event)" />
    } @empty {
      <p>No tasks yet.</p>
    }
  `,
  styleUrl: './task-list.scss',
})
export class TaskListComponent {
  private readonly api = inject(TaskApi);
  readonly tasks = signal<Task[]>([]);
  // ...
}
```

## Backend — NestJS (preferred) or Node/Express

Default to **NestJS** for non-trivial apps. Use Express only when the spec is tiny (a handful of endpoints, no auth complexity).

### NestJS conventions

- Module-per-feature (`UsersModule`, `ProjectsModule`).
- `Controller` (HTTP) → `Service` (business logic) → `Repository` (data access via TypeORM/Prisma/Supabase client).
- DTOs validated with `class-validator` + `class-transformer`.
- Guards for auth (`JwtAuthGuard`), interceptors for logging.
- Global `ValidationPipe` with `whitelist: true, transform: true`.
- Config via `@nestjs/config`, `.env` for secrets, never committed.

```ts
@Controller('tasks')
@UseGuards(JwtAuthGuard)
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Post()
  create(@Body() dto: CreateTaskDto, @CurrentUser() user: User) {
    return this.tasks.create(dto, user.id);
  }
}
```

### Express conventions (when chosen)

- Routes in `src/routes/`, organized by resource
- Middleware: `helmet`, `cors`, `express.json()`, request-id
- Validation: `express-validator` middleware on each route
- Errors: a central error handler that maps thrown errors to HTTP responses

## Database

- **Postgres** (via Supabase) is the default. Use MySQL+Sequelize only on legacy services that already have it.
- **UUIDs** for primary keys on user-facing entities (`uuid PRIMARY KEY DEFAULT gen_random_uuid()`).
- **`created_at` / `updated_at`** on every row.
- Soft-delete (`deleted_at`) only when the UI requires restore-from-trash.
- All foreign keys explicit, with `ON DELETE` rules chosen deliberately (CASCADE only when truly nested ownership).
- Indexes on every FK and every column used in WHERE/ORDER BY.

DDL style:

```sql
CREATE TABLE tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       text NOT NULL,
  status      text NOT NULL CHECK (status IN ('todo','in_progress','done')),
  due_at      timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);
```

If using Supabase, also include row-level security (RLS) policies in the spec for any tables that store per-user data.

## Auth

- **JWT** access tokens (15-minute lifetime) + refresh tokens (7-day, rotating).
- Access token in `Authorization: Bearer …` header.
- Refresh token in HttpOnly + Secure + SameSite=Strict cookie.
- Refresh endpoint rotates the token and invalidates the old one (track `jti` or last-used).

## Project layout

For a new app generated from these docs:

```
project-name/
├── apps/
│   ├── frontend/            # Angular
│   └── backend/             # NestJS or Express
├── packages/
│   └── shared-types/        # DTOs / API contracts shared between front and back
├── docs/                    # The reverse-engineering output that generated this app
└── README.md
```

This layout isn't mandatory — single-package layouts are fine for small apps — but in the implementation plan, recommend it once a project has more than ~10 endpoints or 5+ pages.
