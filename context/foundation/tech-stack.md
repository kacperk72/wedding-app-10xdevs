---
starter_id: angular
package_manager: npm
project_name: wedding-planner
hints:
  language_family: js
  team_size: solo
  deployment_target: self-host
  ci_provider: github-actions
  ci_default_flow: auto-deploy-on-merge
  bootstrapper_confidence: verified
  path_taken: custom
  quality_override: false
  self_check_answers:
    typed: true
    from_official_starter: true
    conventions: true
    docs_current: true
    can_judge_agent: true
  has_auth: true
  has_payments: false
  has_realtime: false
  has_ai: false
  has_background_jobs: true
---

## Why this stack

Solo developer shipping a Polish wedding-planner MVP in 3 weeks of after-hours work with a hard wedding-date deadline. The frontend stack is locked outside this selector via `wedding-planner-deployment.md` — Angular 20+ standalone with signals — matched here to the `angular` card (clears all four agent-friendly gates and bootstrapper-verified, so scaffolding will be smooth). Angular was the recommended-default `10x-astro-starter`'s competitor on the custom path because the project's other apps in the ecosystem (the sign-on admin SPA, the seating module being copied from a sibling app) are also Angular, giving cross-project consistency that overrides the "overkill for solo MVP" caveat in the card. Deployment is self-host on Hostinger Business via FTP for the SPA and SSH for the backend; CI runs on GitHub Actions with auto-deploy on merge. The backend (Express + Sequelize + MySQL, plus single-sign-on integration via the shared service at `kubitksso.pl`) is hand-rolled per the deployment doc, not scaffolded by this hand-off — Express fails `typed` and `convention_based` gates, so the project's instruction files (`CLAUDE.md` / `AGENTS.md`) will carry explicit middleware-order, error-handling, and validation conventions to compensate.
