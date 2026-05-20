---
project: Wedding Planner
researched_at: 2026-05-20
recommended_platform: Hostinger Business (shared + Node.js app)
runner_up: n/a — decision locked outside this research
context_type: mvp
tech_stack:
  language: TypeScript (frontend) + JavaScript/TypeScript (backend)
  framework: Angular 20+ standalone (frontend) + Express + Sequelize (backend)
  runtime: Node.js 22 LTS on Hostinger Node.js application slot; MySQL on the same plan
research_mode: skipped — platform decided pre-research
research_source: wedding-planner-deployment.md (commit "update(docs) - adapting the strategy to SSO")
---

## Recommendation

**Deploy on Hostinger Business** — Angular SPA via FTP to `/public_html/` of `wedding-planner-kubitk.pl`, Express + Sequelize backend as a Hostinger Node.js application on the same plan, MySQL co-located. **GitHub Actions** drives CI/CD: FTP-Deploy-Action for the SPA, `appleboy/ssh-action` for the backend (`git pull` + `touch tmp/restart.txt`).

This research was **explicitly skipped** at the developer's request: the platform was already chosen and documented in `wedding-planner-deployment.md` before this skill was invoked, the sibling SSO at `kubitksso.pl` already runs on the same Hostinger account, and the 3-week MVP timeline against a hard wedding-date deadline (2026-07-25) makes platform-switching a non-starter. The file you are reading records that locked decision in the schema this chain expects — it is not the output of an open candidate comparison.

## Platform Comparison

Not performed for this MVP — the deployment doc treats Hostinger as `decyzje już podjęte … przy starcie projektu można brać 1:1`, and the sibling SSO has been live on the same hosting plan since before the wedding-planner repo existed. Hard switching costs make any comparison theatrical for this project.

For future revisits (post-MVP, post-wedding, or after a Hostinger incident), the modern PaaS candidates that would compete on agent-friendliness are Railway, Fly.io, and Render — all of which clear all five criteria in `references/agent-friendly-criteria.md` more cleanly than shared hosting does. None of them clear the "external SSO already deployed on the same host" tiebreaker today.

### Shortlisted Platform

#### 1. Hostinger Business (Recommended)

**Why it won (by constraint, not by score):**
- **SSO already deployed there.** `kubitksso.pl` lives on the same plan; running the wedding-planner backend on the same host keeps cookie/origin behaviour for SSO redirects simple and removes a class of cross-origin debugging from the MVP path.
- **Zero added cost.** Plan is already paid for. Modern PaaS would add ~5–20 USD/month each for FE + BE + MySQL on a comparable tier.
- **Familiarity.** Developer has already configured `.htaccess`, FTP, and Node.js application slot for a sibling app — no platform learning curve.
- **Sufficient capacity for two users.** 30 Entry Processes (concurrent requests) and 50 GB NVMe are roughly 10× the actual load.
- **Daily backups by default.** Adequate DR for an MVP serving two known users.

**Where it scores poorly against the standard criteria:** no preview deploys per PR (a real DX gap vs Vercel/Netlify), no MCP server or first-class agent integration, deployment is "FTP push then `git pull` over SSH" rather than a single declarative deploy command, and logs are tailed via SSH rather than a structured viewer. These costs are absorbed because the SSO co-location and the timeline win on every other axis.

## Anti-Bias Cross-Check: Hostinger Business

Full bias lenses (devil's advocate, pre-mortem, unknown unknowns) were not run as separate research steps because the user opted to skip the open comparison. The risks below were extracted from the deployment doc itself and from what is foreseeably wrong with shared hosting in this specific MVP context — they populate the risk register rather than a standalone cross-check section.

## Operational Story

How the chosen platform actually operates day to day for this project.

- **Preview deploys**: not available on Hostinger shared. Branches other than `main` are not auto-deployed. Validation happens locally (`ng serve` on `:4200`, backend via `node src/server.js` or `nodemon` on `:3000`) before merge to `main`. Acceptable for an MVP with two stakeholders who can validate in-person.
- **Secrets**: GitHub repository secrets — `HOSTINGER_FTP_HOST/USER/PASS`, `HOSTINGER_SSH_HOST/USER/KEY` for CI/CD. Application secrets (MySQL credentials, JWKS URL, app slug) live in the Hostinger Node.js app's environment-variables panel — set once, never in the repo. Rotation: regenerate FTP password in Hostinger panel → update GitHub Secret; regenerate SSH keypair → push new public key into Hostinger panel, replace `HOSTINGER_SSH_KEY` secret. Use a **dedicated FTP account scoped to `/public_html/` of this domain**, never the master account.
- **Rollback**: revert the offending merge on `main` and re-push — GitHub Actions re-deploys both layers. Typical time-to-revert ~3 minutes (CI runtime). Caveat: **Sequelize migrations are not auto-reversible** — a destructive migration must be unwound by hand (write the down-migration, run it on the prod DB via Hostinger phpMyAdmin or SSH). Plan migrations as additive when possible.
- **Approval**: a push to `main` deploys to production immediately. The only human-in-the-loop gates are (a) merging the PR and (b) anything touching `kubitksso.pl` directly (SSO admin actions: registering the app, creating accounts, rotating the signing keypair). The agent must never push to `main` unattended and must never log into the SSO admin panel.
- **Logs**: Hostinger panel exposes Node.js app stdout/stderr in the Node.js Application section. For deeper inspection use `ssh u<plan-id>@<host>` and `tail -f ~/wedding-planner-backend/logs/*.log` (path depends on the backend's logging setup; if logs are unstructured, route them through a file via `morgan`/`pino` in `server.js`). Read-only for the agent. **There is no centralized log shipper in MVP** — incidents are inspected manually.

## Risk Register

For each risk: source, likelihood, impact, mitigation. Sources tagged from what surfaced during the deployment doc read and shared-hosting domain knowledge.

| Risk | Source | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| FTP-Deploy state file (`.ftp-deploy-sync-state.json`) on server is deleted by hand → next deploy uploads all files instead of diffs | Research finding | L | M | Document the file in `wedding-planner-deployment.md` § FTP-Deploy; never delete via FTP client; if lost, the recovery is one slow full upload — not a real outage |
| `tmp/restart.txt` does not exist or is in the wrong path → backend doesn't pick up new code after SSH deploy | Research finding | M | M | Verify path on first deploy via SSH; if Hostinger's Node.js app expects a different signal (panel button), update `deploy.yml` to call it instead. Bake the verification into the M0 smoke test. |
| FTP master credentials leaked from GitHub Secrets give attacker access to **both** `wedding-planner-kubitk.pl` and `kubitksso.pl` on the same plan | Devil's-advocate-style | L | H | Already mitigated in the deployment doc: use a dedicated FTP account scoped to `/public_html/` of one domain. Verify scope on first credential issuance — the trap is reusing the master account "just for testing". |
| 30 Entry Processes cap is hit during a load test or an accidental loop in code | Research finding | L | M | MVP load is ~2 concurrent users so the cap is 15× overhead. Add `express-rate-limit` per IP early so a bug can't exhaust the slot. Hostinger's panel shows current process count under "Status". |
| Sequelize migration run on prod that does `DROP COLUMN` or `ALTER COLUMN` with data loss → unrecoverable except from daily backup (up to 24h data loss) | Pre-mortem-style | M | H | Migration rule: additive only on prod (`ADD COLUMN`, `ADD INDEX`, `CREATE TABLE`). Destructive migrations require a manual run in a maintenance window with a pre-run `mysqldump` snapshot. Document in CLAUDE.md when M1 lands. |
| SSL cert auto-renew (Let's Encrypt) silently fails → cookies stop carrying because `SameSite=None` requires HTTPS → SSO login breaks site-wide | Unknown-unknowns-style | L | H | Hostinger sends an email if renewal fails. Add a manual calendar check 7 days before the wedding (2026-07-18) to verify the cert chain. Also set up uptime monitoring against `https://wedding-planner-kubitk.pl/api/health` (free tier on UptimeRobot is fine). |
| SSO app registration's `Domain` field does not exactly match `https://wedding-planner-kubitk.pl` (trailing slash, http vs https) → SSO rejects the redirect after login with a generic error | Research finding (deployment doc § Rejestracja apki w SSO) | M | M | Verify the registered Domain string character-for-character before the M2 milestone (auth + wedding bootstrap). Capture the exact string in `04-database.md` or `wedding-planner-deployment.md`. |
| GitHub Actions auto-deploys to prod on every merge to `main` — a fat-fingered merge ships broken code to a single-environment hosting setup | Pre-mortem-style | M | M | (a) Require PRs (no direct push to `main`); (b) keep the lint+test step gating the deploy in `deploy.yml`; (c) feature-flag risky changes behind a `WEDDING_FEATURE_*` env var read from the Hostinger Node.js app panel so a bad merge can be killed without re-deploying. |
| No staging environment → first-time integration bugs only surface in prod | Unknown-unknowns-style | H | L | Accept the cost for MVP: two users, low traffic, can break briefly. If a staging slot becomes painful, the cheapest fix is a second Hostinger subdomain (e.g. `staging.wedding-planner-kubitk.pl`) with its own MySQL database and a separate workflow trigger on a `staging` branch. |
| Hostinger plan renewal lapses or the account is suspended for a TOS issue → both `kubitksso.pl` and the planner go dark together | Pre-mortem-style | L | H | Single-point-of-failure for two paired apps. Manual mitigation: set the Hostinger plan to auto-renew with a backup payment method, and keep a recent local copy of the MySQL dump (e.g. `mysqldump` weekly via cron until the wedding). |

## Getting Started

Concrete first steps to ship the wedding-planner to Hostinger. Sequenced so each step unblocks the next.

1. **Generate a dedicated FTP account** in Hostinger panel scoped to `/public_html/` of `wedding-planner-kubitk.pl`. Capture host, username, password into a local password manager. Do **not** reuse the master account.
2. **Create the Node.js application** in Hostinger panel pointing at the backend directory (e.g. `~/wedding-planner-backend/src/server.js`, Node 22). Note the application's environment-variables panel — that is where the production MySQL DSN, the SSO JWKS URL (`https://kubitksso.pl/.well-known/jwks.json`), and the app slug (`wedding-planner`) live. Empty for now.
3. **Create the MySQL database** for wedding-planner — separate from the SSO database, same server. Note the DB name and the user/password it requires. Add the DSN to the Node.js app's environment-variables panel from step 2.
4. **Generate a deploy-only SSH keypair** locally with `ssh-keygen -t ed25519 -C "wedding-planner-deploy"`, paste the public key into the Hostinger SSH access panel, paste the private key into GitHub repository secrets as `HOSTINGER_SSH_KEY`. Add the four other secrets (`HOSTINGER_FTP_HOST/USER/PASS`, `HOSTINGER_SSH_HOST/USER`) from the FTP and SSH panels.
5. **Register the wedding-planner app in the SSO admin panel** at `https://kubitksso.pl/apps` with slug `wedding-planner`, display name `Wedding Planner`, and Domain `https://wedding-planner-kubitk.pl` (exact match — no trailing slash). Create the two user accounts (the couple's emails) in `https://kubitksso.pl/users` and assign them to this app.
6. **Land the `.github/workflows/deploy.yml`** copied from `wedding-planner-deployment.md` § GitHub Actions workflow. First push to `main` triggers a full FTP upload and a backend SSH bootstrap — expect the first run to be slow (~3–5 min). Confirm the Angular SPA serves at `https://wedding-planner-kubitk.pl` and `/api/health` returns 200 from the backend before opening the next PR.

## Out of Scope

The following are deliberately out of scope for this research:

- **Docker image configuration** — Hostinger Node.js application slot does not run user-provided containers; deployment is direct Node process + `tmp/restart.txt` signalling.
- **CI/CD pipeline expansion beyond the existing workflow** — the deploy.yml template in `wedding-planner-deployment.md` is the v1 pipeline. Optimization (caching `node_modules`, splitting test/build/deploy jobs, adding a `staging` workflow) is deferred until after the wedding.
- **Production-scale architecture** — multi-region, HA, DR beyond Hostinger's daily backups, dedicated read replicas, traffic shaping. The MVP serves two users; none of these are warranted.
- **Cost projections beyond MVP** — the project lives on a paid-for shared plan with effective marginal cost of zero. A future move to PaaS would change this, but is a v2 concern.
