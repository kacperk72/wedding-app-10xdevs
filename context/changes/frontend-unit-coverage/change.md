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

Tier-1 deep batch + CRUD scoping sweep. Frontend unit: 15 → 61 tests.

Tier-1 (derivations + scoping):
- `tasks.service.spec.ts` — overdue/this-week/future/completed date buckets on a
  **frozen clock** (`vi.setSystemTime`); boundary cases (day 0, +7 inclusive, +8);
  `loadTasks` two-GET wedding-scoped fetch + create/update/remove cache mutation.
- `wedding.service.spec.ts` — `daysUntilWedding` (frozen clock), `coupleLabel`/
  `coupleInitials` (+ empty defaults), `loadCurrent` weddingId scoping via an
  `AuthService` stub, and the no-wedding branch (no HTTP, signal cleared).
- `guests.service.spec.ts` (extended) — create/update/remove signal-cache
  mutation + the server→client aggregates fallback reset on mutation.

CRUD scoping sweep (each: list/create/update/remove hit the wedding-scoped URL +
mutate the signal cache; plus per-service behaviors):
- `vendors.service.spec.ts`, `meal-options.service.spec.ts` — plain CRUD + scoping.
- `tables.service.spec.ts` — CRUD + the `seatsCount` 1–24 guard that throws
  before any HTTP (verified via `httpMock.verify()`).
- `meetings.service.spec.ts` — dual `meetings`/`upcoming` signals; `loadUpcoming`
  separate endpoint; create inserts into the sorted `upcoming`.
- `budget.service.spec.ts` — `listExpenses` `?categoryId` query; newest-first
  prepend; `loadSummary` cascade on create/remove (asserts the extra scoped GET).
- `contracts.service.spec.ts` — dual `contracts`/`upcomingPayments` signals; CRUD.

Discipline: oracle-safe (expected values hand-computed from fixtures, never from
the unit under test); frozen clock on every date assertion (no time-bombs);
`HttpTestingController` + `httpMock.verify()` to catch stray/unscoped requests.

Correction: the refresh brief flagged `guests.service.spec.ts` as 5 red
("httpMock undefined"). Verified **green** this session — `provideHttpClientTesting()`
was already wired; the baseline never regressed.

**Deferred (not in this change):** component-level tests; brief's Phase 6 e2e
primary user flows (guest→group, payments 30d window, catering price→freeze,
seating Flow 4 coordinated with test-plan Phase 4). Catering/seating/timeline
services not swept here — their non-trivial logic is server-side or already
covered by backend integration / e2e.
