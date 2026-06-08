<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Zakładka „Harmonogram" (ankieta DJ-a)

- **Plan**: context/changes/wedding-timeline-dj/plan.md
- **Scope**: Full plan (Phases 1–4, all complete) — focus on Phases 3–4 (frontend, this session)
- **Date**: 2026-06-08
- **Verdict**: APPROVED
- **Findings**: 0 critical, 1 warning, 3 observations

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | WARNING |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Unplanned CI changes bundled into the faze-2 commit

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Scope Discipline
- **Location**: 9beb9f5 — wedding-planner/frontend/package.json, .github/workflows/deploy.yml, wedding-planner-deployment.md
- **Detail**: Commit 9beb9f5 ("faze 2") was meant to be Phase 4 (DJ export view only), but it also adds a `test:ci` npm script and repoints the CI workflow + deployment doc to it. Correct and benign CI hygiene, but not in the Phase 4 plan and folded into a feature commit, so the diff no longer maps cleanly to the plan's "Changes Required".
- **Fix**: No code change needed — the CI edits are valid. Optionally note them as an out-of-plan addendum so the plan stays the source of truth.
- **Decision**: SAVED (no triage)

### F2 — Export view blanks on any single load failure

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality (Reliability)
- **Location**: pages/harmonogram/dj-export/dj-export.ts:113 (bootstrap forkJoin)
- **Detail**: `forkJoin([timeline, aggregates, vendors])` fails as a unit — if vendors or guest-aggregates errors, `loaded` never flips and the page stays blank (only a toast). The route is directly linkable (/harmonogram/dla-dj), so a hard refresh is more exposed than the in-app page. Matches the existing harmonogram.page pattern → consistent, not drift.
- **Fix**: Optional — make timeline the gate and let aggregates/vendors degrade (catchError → empty) so the sheet still prints if a reuse source is briefly unavailable.
- **Decision**: SAVED (no triage)

### F3 — Commit naming drifts from the plan's (pN) convention

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: git history (65f82e3, 9beb9f5)
- **Detail**: "feat(harmonogram) - implementation faze 1/2" — the "faze" numbers don't map to plan phases (faze 1 = Phase 3 frontend, faze 2 = Phase 4 export), and they bundle work rather than using `feat(wedding-timeline-dj): <title> (pN)` as Phases 1–2 did (8a5eb6e p1, d935925 p2). History is consistent; only the labels are misleading. No rewrite recommended on a pushed branch.
- **Fix**: None — adopt `feat(<change-id>): <title> (pN)` for future commits.
- **Decision**: SAVED (no triage)

### F4 — Event reorder uses two non-atomic PATCHes

- **Severity**: 🔭 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture (Reliability)
- **Location**: core/services/timeline.service.ts:151 (swapEvents)
- **Detail**: `swapEvents` issues two independent sortOrder PATCHes via forkJoin. If one succeeds and the other fails, ordering is left inconsistent until reload. Blast radius is tiny (~14-row list, single user) and the plan explicitly chose button-swap over drag-drop for a11y, so acceptable for MVP.
- **Fix**: None for MVP. If reorder ever feels flaky, move the swap to a single backend endpoint updating both rows in one tx.
- **Decision**: SAVED (no triage)

## Success Criteria

- **Automated**: frontend `npm run build` — PASS (dj-export chunk 14.62 kB, harmonogram-page rebuilt, clean; run this session). No backend changes this session → Phase 2 `npm test` unaffected (d935925).
- **Manual**: 3.4–3.7, 4.3–4.5 confirmed by the user; phase SHAs written into the plan's Progress section.
