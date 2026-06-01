<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Zakładka „Harmonogram" (ankieta DJ-a)

- **Plan**: context/changes/wedding-timeline-dj/plan.md
- **Scope**: Phase 2 of 4
- **Date**: 2026-06-01
- **Verdict**: APPROVED
- **Findings**: 0 critical 0 warnings 2 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS (npm test: 110/110) |

## Findings

### F1 — must-play limit is check-then-insert (TOCTOU)

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/routes/timeline.js (POST /songs)
- **Detail**: The 50-song cap counts existing must-play rows then inserts; two concurrent POSTs could both pass and yield 51. Benign (two-account app, low write concurrency) and consistent with the codebase's check-then-act style.
- **Fix**: Accept as-is. (If ever needed: partial unique index or counting trigger at DB level.)
- **Decision**: ACCEPTED — łagodne, spójne z repo

### F2 — GET /songs returns must + do_not interleaved by sort_order

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/routes/timeline.js (GET /songs)
- **Detail**: Both kinds share one sort_order space, so the auxiliary GET /songs list mixed must/do_not rows. Primary consumer is GET / (split lists), so frontend unaffected.
- **Fix**: Order `loadSongs` by `kind, sort_order` so the direct GET /songs list groups by kind; GET / payload unchanged.
- **Decision**: FIXED — `loadSongs` now `.order("kind").order("sort_order")`
