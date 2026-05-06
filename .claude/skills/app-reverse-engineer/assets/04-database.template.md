# Database — {{APP_NAME}}

> **TL;DR**: {{One paragraph. RDBMS choice, table count, key relationships, anything unusual.}}

**Engine**: PostgreSQL (Supabase recommended)
**Conventions**: UUID PKs, `snake_case` columns, `created_at` / `updated_at` on every table.

Each table and column is labeled with a confidence level:
- **Observed** — appears verbatim in API responses
- **Inferred** — logically required but not directly visible (e.g. `password_hash`)
- **Recommended** — best practice, optional (e.g. timestamps, indexes)

---

## Entity-relationship overview

```
{{Replace this with a Mermaid ER diagram, e.g.:

erDiagram
  users ||--o{ projects : owns
  projects ||--o{ tasks : contains
  users ||--o{ tasks : assigned_to
}}
```

---

## Tables

### `users`

| Column          | Type                       | Null | Default                | Confidence | Notes                                        |
| --------------- | -------------------------- | ---- | ---------------------- | ---------- | -------------------------------------------- |
| id              | uuid PK                    | NO   | `gen_random_uuid()`    | Observed   | Returned by `/api/me` as `id`                |
| email           | citext UNIQUE              | NO   |                        | Observed   |                                              |
| password_hash   | text                       | NO   |                        | Inferred   | Never returned; required for login           |
| name            | text                       | YES  |                        | Observed   |                                              |
| avatar_url      | text                       | YES  |                        | Observed   |                                              |
| email_verified  | boolean                    | NO   | `false`                | Inferred   | Verification flow observed at `/verify`      |
| created_at      | timestamptz                | NO   | `now()`                | Recommended|                                              |
| updated_at      | timestamptz                | NO   | `now()`                | Recommended|                                              |

Indexes: `email` (unique, automatic), `created_at` for sorting.

### `projects`

| Column       | Type                            | Null | Default              | Confidence | Notes                              |
| ------------ | ------------------------------- | ---- | -------------------- | ---------- | ---------------------------------- |
| id           | uuid PK                         | NO   | `gen_random_uuid()`  | Observed   |                                    |
| owner_id     | uuid FK → users(id) ON DELETE CASCADE | NO |              | Observed   | Inferred from `ownerId` in response|
| title        | text                            | NO   |                      | Observed   |                                    |
| description  | text                            | YES  |                      | Observed   |                                    |
| created_at   | timestamptz                     | NO   | `now()`              | Observed   |                                    |
| updated_at   | timestamptz                     | NO   | `now()`              | Recommended|                                    |

Indexes: `owner_id`, `created_at`.

### `tasks`

{{...}}

### `project_members` (join table)

| Column      | Type                                          | Null | Default | Confidence |
| ----------- | --------------------------------------------- | ---- | ------- | ---------- |
| project_id  | uuid FK → projects(id) ON DELETE CASCADE      | NO   |         | Observed   |
| user_id     | uuid FK → users(id) ON DELETE CASCADE         | NO   |         | Observed   |
| role        | text CHECK (role IN ('owner','admin','member'))| NO  |         | Observed   |
| joined_at   | timestamptz                                   | NO   | `now()` | Recommended|

Primary key: `(project_id, user_id)`.

---

## Full DDL

```sql
-- Run in this order to satisfy FK dependencies.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           citext NOT NULL UNIQUE,
  password_hash   text NOT NULL,
  name            text,
  avatar_url      text,
  email_verified  boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_projects_owner_id ON projects(owner_id);

-- ... etc.
```

---

## Row-Level Security (Supabase)

Recommended policies for the multi-tenant shape. Adjust if not using Supabase.

```sql
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_select_own ON projects
  FOR SELECT USING (owner_id = auth.uid()
    OR id IN (SELECT project_id FROM project_members WHERE user_id = auth.uid()));

CREATE POLICY projects_insert_own ON projects
  FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY projects_update_own ON projects
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY projects_delete_own ON projects
  FOR DELETE USING (owner_id = auth.uid());
```

## Inferred but unverified

{{Tables/columns the implementer should validate. E.g.: "the `notifications` table is inferred from the bell icon showing a count — never saw the response body."}}

## Open questions

{{Things the recon couldn't answer that affect schema choices. E.g.: "Hard-delete vs soft-delete for tasks? UI shows no archive view, leaning hard-delete."}}
