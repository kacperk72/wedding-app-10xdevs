# E2E tests (Playwright)

Hermetic, networkless e2e for the wedding-planner. Playwright boots **both**
servers (see `../playwright.config.ts`):

- **Backend** with the test seams: `DB_TEST_MODE=1` (in-memory seed from
  `backend/test/helpers/e2e-seed.js`) and `AUTH_TEST_MODE=1` (accepts an HS256
  token signed with `AUTH_TEST_SECRET` instead of live JWKS). Both seams are
  fail-closed — the backend refuses to boot if either is set under
  `NODE_ENV=production`.
- **Frontend** via `ng serve`; `proxy.conf.json` forwards `/api` → `localhost:3000`.

Auth is injected by `support/sso-stub.ts`: a fake `window.SSOAuth` (via
`addInitScript`) returns a locally-signed token, and the real SSO SDK script is
blocked. The token's `userId` maps to a seeded member of `wedding-1`
(`sso-a` → partner A, `sso-b` → partner B).

## Prerequisite (one-time)

Install the Playwright browser binaries:

```bash
npx playwright install chromium
```

## Run

```bash
npm run e2e          # headless
npx playwright test --headed   # watch it drive a real browser
```

No Supabase or `kubitksso.pl` access is required — the suite is fully
self-contained.
