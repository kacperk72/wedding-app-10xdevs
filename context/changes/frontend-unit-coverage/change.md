---
change_id: frontend-unit-coverage
title: Frontend unit coverage (high-churn services)
status: complete
created: 2026-06-17
updated: 2026-06-17
archived_at: null
---

## Notes

Test-plan §3 **Phase 5** — addresses **Risk #8** (per-resource frontend service
mis-scopes `weddingId`, mis-derives an aggregate/filter/sort, or leaves a stale
signal cache after a mutation, with no test catching it).

**Tier-1 deep batch** (user-approved scope). Frontend unit: 15 → 33 tests.

Added:
- `tasks.service.spec.ts` — overdue/this-week/future/completed date buckets on a
  **frozen clock** (`vi.setSystemTime`); boundary cases (day 0, +7 inclusive, +8);
  `loadTasks` two-GET wedding-scoped fetch + create/update/remove cache mutation.
- `wedding.service.spec.ts` — `daysUntilWedding` (frozen clock), `coupleLabel`/
  `coupleInitials` (+ empty defaults), `loadCurrent` weddingId scoping via an
  `AuthService` stub, and the no-wedding branch (no HTTP, signal cleared).
- `guests.service.spec.ts` (extended) — create/update/remove signal-cache
  mutation + the server→client aggregates fallback reset on mutation.

Discipline: oracle-safe (expected values hand-computed from fixtures, never from
the unit under test); frozen clock on every date assertion (no time-bombs);
`HttpTestingController` + `httpMock.verify()` to catch stray/unscoped requests.

Correction: the refresh brief flagged `guests.service.spec.ts` as 5 red
("httpMock undefined"). Verified **green** this session — `provideHttpClientTesting()`
was already wired; the baseline never regressed.

**Deferred (not in this change):** broad CRUD scoping sweep across the simpler
services (vendors/contracts/tables/meal-options/budget/meetings); brief's Phase 6
e2e primary user flows.
