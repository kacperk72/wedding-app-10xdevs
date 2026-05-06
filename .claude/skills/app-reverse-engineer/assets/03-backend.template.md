# Backend — {{APP_NAME}}

> **TL;DR**: {{One paragraph. API style (REST/GraphQL/RPC), auth model, base URL, recommended rebuild stack.}}

## Detected style

- **API style**: {{REST / GraphQL / RPC / mixed}}
- **Base URL**: {{e.g. `https://example.com/api`}}
- **Auth**: {{JWT in Authorization header / session cookie / OAuth provider}}
- **Versioning**: {{none observed / `/v1/` prefix / `Accept` header}}

## Recommended stack for rebuild

- **Framework**: NestJS (or Express if the surface is small — see thresholds in `05-implementation-plan.md`)
- **Language**: TypeScript
- **Validation**: `class-validator` DTOs (NestJS) or `express-validator` (Express)
- **Database driver**: Supabase client (or TypeORM/Prisma) for Postgres

## Authentication

### Login

`POST /api/auth/login`

Request:
```json
{ "email": "user@example.com", "password": "..." }
```

Response (200):
```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "user": { "id": "...", "email": "...", "name": "..." }
}
```

Failure (401):
```json
{ "message": "Invalid credentials" }
```

### Token usage

- `Authorization: Bearer <accessToken>` on every protected request.
- Refresh: `POST /api/auth/refresh` with the refresh token. Returns new pair.
- Logout: `POST /api/auth/logout` invalidates the refresh token.

### Token storage (rebuild recommendation)

- Access token → memory only
- Refresh token → HttpOnly + Secure + SameSite=Strict cookie

## Endpoints

Group by resource. For each: method + path, auth, request shape, response shape, status codes, where it's called from in the UI.

### Projects

#### `GET /api/projects`
List the current user's projects. Paginated.

Query params: `page` (default 1), `limit` (default 20), `sort` (default `-createdAt`).

Response (200):
```json
{
  "data": [
    { "id": "uuid", "title": "...", "memberCount": 4, "createdAt": "..." }
  ],
  "page": 1,
  "limit": 20,
  "total": 37
}
```

Used by: `DashboardPage`.

#### `POST /api/projects`
Create a project.

Request:
```json
{ "title": "string (1..100)", "description": "string?" }
```

Response (201): the created project.

Used by: `ProjectCreateForm`.

#### `GET /api/projects/:id`
{{...}}

#### `PATCH /api/projects/:id`
{{...}}

#### `DELETE /api/projects/:id`
{{...}}

### Tasks

{{...}}

## Errors

Standard error response shape (observed):

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [{ "field": "email", "message": "must be a valid email" }]
}
```

Error contract for the rebuild: align to NestJS's `HttpException` / `ValidationPipe` defaults — they match the shape above.

## Rate limiting / security headers

{{What you observed in response headers — `X-RateLimit-*`, `Strict-Transport-Security`, `Content-Security-Policy`. If nothing observed, recommend defaults: rate-limit auth endpoints to 5/min/IP, set HSTS, set CSP.}}

## Real-time / async

{{WebSockets? Server-sent events? Polling? If none observed, write "none observed; data is fetched on demand."}}

## Inferred but unverified

{{Endpoints you couldn't trigger. Be explicit about what's missing — admin endpoints, payment webhooks, password reset flow if you didn't test it.}}
