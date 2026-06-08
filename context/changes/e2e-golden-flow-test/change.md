---
change_id: e2e-golden-flow-test
title: E2E golden flow + isolation gate
status: new
created: 2026-06-08
updated: 2026-06-08
archived_at: null
---

## Notes

Rollout Phase 1 of `context/foundation/test-plan.md`: "E2E golden flow + isolation gate".

Risks covered:
- **#1 — per-wedding isolation breach**: a foreign SSO / cross-wedding identity hitting a wedding resource must get **403**, not `[]` or 404, on **read AND write** paths.
- **#2 — cross-account stale read**: after refresh, partner B must see partner A's exact committed write.

Test types planned: **e2e** (new layer — no e2e framework exists today; Playwright is the proposed driver per roadmap F-01).

Risk response intent:
- **#1**: prove a foreign SSO identity gets 403 on both read and write paths; challenge "logged-in implies authorized" (authentication is not membership).
- **#2**: prove that after partner B re-fetches, B's view contains partner A's exact committed change; challenge "same DB implies both accounts see it" (ignores caching, wedding-scoping, signal refresh).

Also assert Polish validation messages and `DD.MM.YYYY` date format inline (PRD US-01 acceptance criteria).
