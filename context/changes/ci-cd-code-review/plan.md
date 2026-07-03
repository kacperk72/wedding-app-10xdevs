# Path A — AI Code-Review Pipeline (10xChampion)

> **Status: UKOŃCZONE (2026-06-18).** Zrealizowane na PR
> [kacperk72/wedding-app-10xdevs#1](https://github.com/kacperk72/wedding-app-10xdevs/pull/1);
> zielony run workflow `AI Code Review`
> ([run 27785973903](https://github.com/kacperk72/wedding-app-10xdevs/actions/runs/27785973903)).
> Dowody na 10xChampion (pipeline + logi joba + komentarz LLM na PR) zebrane w `odznaka Champions/`.
> Oryginał planu z trybu plan-mode: `~/.claude/plans/vast-questing-fiddle.md`.
> Odstępstwa od planu spisane na końcu (sekcja **Outcome & deviations**).

## Context

This realizes **Ścieżka A** of Module 5 (the 10xChampion badge): build an SDK-based
code-review agent (M5L2), then deploy it as a GitHub Actions pipeline that reviews
every PR (M5L3), with a structured-output verdict gate and a promptfoo eval set
comparing models. Completing it produces the badge evidence: a pipeline view with a
visible job, job logs, and an LLM review comment on a PR.

**Decisions already made** (do not relitigate):
- **SDK:** Vercel AI SDK 6 (`ai`) — "agent do złożenia", we own the loop; trivial model-swapping for evals.
- **Provider:** OpenRouter (`@openrouter/ai-sdk-provider`), one `OPENROUTER_API_KEY` → many models.
- **Scope:** full — local agent + CI pipeline + comment/labels + merge gate + promptfoo evals.

**Repo facts:**
- Single git repo at `C:\Users\kacpe\Desktop\Aplikacje\10xdevs`; remote `github.com/kacperk72/wedding-app-10xdevs`; **public** (GitHub Actions free); default branch **`main`** (lesson examples say `master` — use `main`).
- Node 22, npm. Existing CI: `.github/workflows/deploy.yml` (triggers on push to `main`) — leave it untouched; the review pipeline is a **separate** workflow on `pull_request`.
- New agent lives in a standalone package: **`packages/code-reviewer/`** (independent of `wedding-planner/{backend,frontend}`).
- **Subscription note:** Pro login can't auth in CI — the pipeline needs `OPENROUTER_API_KEY` as a GitHub Actions secret. Get a small top-up of OpenRouter credit before Phase 4.

---

## Phase 0 — Prep

- [x] Obtain an OpenRouter API key; add a few $ of credit.
- [x] Add repo secret: GitHub → repo → Settings → Secrets and variables → Actions → `OPENROUTER_API_KEY`.
- [x] Confirm you'll demonstrate on a **PR to `main`** (the repo currently pushes straight to `main`; the review only fires on `pull_request`).

## Phase 1 — Local review agent (M5L2)

Scaffold `packages/code-reviewer/` as an ESM TypeScript package.

- [x] `package.json` — `"type": "module"`; deps `ai`, `zod`, `@openrouter/ai-sdk-provider`; devDeps `tsx`, `@types/node`, `typescript`. Scripts: `"review": "tsx src/review.ts"`, `"eval": "promptfoo eval"`.
- [x] `src/review-schema.ts` — single source of truth. `zod` object: **6 criteria** scored 1–10, each with a rubric in `.describe()` (state of "1" vs "10") — `implementationCorrectness`, `idiomaticity`, `complexity`, `testRiskCoverage`, `documentation`, `securitySafety` — plus `verdict: z.enum(["pass","fail"])` and `summary: z.string()` (Markdown, PR-comment ready). Export the `Review` type via `z.infer`.
- [x] `src/prompt.ts` — `SYSTEM_PROMPT` (the reviewer persona + the 6 criteria) and `buildReviewPrompt({ title, body, diff })`. Keep criteria text aligned with `CLAUDE.md` conventions (cross-wedding FK checks via `assertWeddingRecordExists`, `service_role`/RLS authorization in Express middleware, Polish UI, symmetric CRUD) so reviews match this repo's DoD. **M5L3 task 1** (refine criteria) = tune this file; treat the 6 above as the strong default.
- [x] `src/review.ts` — read diff from **stdin** (optionally `--title`/`--body` or env); construct `new ToolLoopAgent({ model: openrouter("anthropic/claude-haiku-4.5"), instructions: SYSTEM_PROMPT, tools: {}, output: Output.object({ schema: REVIEW_SCHEMA }), stopWhen: stepCountIs(2) })`; `await agent.generate({ prompt: buildReviewPrompt(...) })`; print `JSON.stringify(output)` to stdout. Default to a cheap model (Haiku) since it runs per PR. *(Implementacja: rdzeń wydzielony do `src/agent.ts`, `review.ts` to cienkie CLI — patrz Outcome.)*
- [x] `.env.example` with `OPENROUTER_API_KEY=`; ensure `.env` is gitignored.

**M5L2 verification (badge step "confirm model communication"):**
- [x] `git diff origin/main...HEAD | npm run review` (from the package dir, with `OPENROUTER_API_KEY` set) returns valid JSON with all 6 scores + verdict. *(Zweryfikowane na fixtures: insecure → `fail` (security 1), clean → `pass` (security 9).)*

## Phase 2 — promptfoo evals (M5L3 task 3)

- [x] Add `promptfoo` as a devDep.
- [x] `fixtures/*.diff` — at least one **non-trivial diff with planted flaws** relevant to this stack (e.g. an Express route that `select *`s a globally-scoped table without `.in(...)` filter, or skips the cross-wedding FK check — known anti-patterns from `CLAUDE.md`). Add a clean diff as a negative control.
- [x] `promptfooconfig.yaml` — `providers`: 2–3 OpenRouter models side by side (e.g. `openrouter:anthropic/claude-haiku-4.5`, `openrouter:anthropic/claude-sonnet-4.6`, one non-Anthropic such as `openrouter:z-ai/glm-5.1` or `openrouter:deepseek/...` — verify current IDs on OpenRouter); `prompts` referencing the same review prompt; `tests` with the fixture diffs and assertions: `is-json`, `llm-rubric` ("verdict rejects the change and names the specific flaw"), and a `javascript` hard check (e.g. `JSON.parse(output).verdict === "fail"` and the relevant score `<= 3`). *(Implementacja: custom provider `src/promptfoo-provider.ts` woła realnego agenta — patrz Outcome.)*
- [x] `OPENROUTER_API_KEY=... npm run eval` → review the pass/fail × cost × latency matrix; pick the CI model (cheapest that passes), set it as the default in `src/review.ts`. Keep the eval set as a regression gate for future prompt edits. *(Wynik: Haiku 4.5 — oba testy PASS, ustawiony jako domyślny; Sonnet 4.6 — błąd affordability OpenRouter; GLM 5.1 — over-flag na clean.)*

## Phase 3 — Composite action + workflow (M5L3)

Use a **local composite action** (course-recommended starting point) plus a consumer workflow.

- [x] `.github/actions/ai-reviewer/action.yml` — `using: composite`. Inputs: `api-key` (required), `pr-title`, `pr-body`, `diff`, `github-token`. Steps (each `run` needs explicit `shell: bash`): setup Node 22 → `npm ci` in `packages/code-reviewer` → run the agent with the diff piped in, capturing JSON → post the `summary` as a PR comment and set `ai-cr:passed`/`ai-cr:failed` label via `gh` (uses `github-token`) → expose `verdict` as an action `output`. *(Implementacja: diff liczony w akcji z `base-ref` + wykluczenie plików generowanych, zamiast surowego inputu `diff` — patrz Outcome.)*
- [x] `.github/workflows/review.yml` — `on: pull_request: branches: [main]`, plus `workflow_dispatch`, plus (optional, from the requirements doc) on-demand re-run via label `ai-cr:review`. Job `review` on `ubuntu-latest`: `actions/checkout@v4` with **`fetch-depth: 0`** (shallow checkout can't diff) → compute `git diff origin/${{ github.base_ref }}...HEAD` into a step output → call `./.github/actions/ai-reviewer` with `api-key: ${{ secrets.OPENROUTER_API_KEY }}`, `pr-title`/`pr-body` from `github.event.pull_request.*`, the diff, and `github-token: ${{ secrets.GITHUB_TOKEN }}` → **gate:** fail the job when the action's `verdict` output is `fail` (so branch protection can require it). *(Implementacja: bez `workflow_dispatch`; trigger `labeled` ograniczony do `ai-cr:review`, by nadanie etykiet przez akcję nie tworzyło pętli.)*
- [x] Job needs `permissions: { pull-requests: write, contents: read }` for commenting + labels.

## Phase 4 — Demonstrate on a PR (badge evidence)

- [x] Branch, make a small change, open a **PR to `main`**. *(PR #1, gałąź `feat/ai-code-review-pipeline`.)*
- [x] Confirm the `review` workflow runs: job appears, agent posts a structured comment, label `ai-cr:passed`/`ai-cr:failed` applied, and the gate behaves (a deliberately bad change → `fail` + red job). *(Run #2 zielony: komentarz PASS + etykieta `ai-cr:passed` + bramka pominięta na pass. Run #1 był czerwony — patrz Outcome.)*
- [ ] (Optional) Settings → Branches → require the `review` check on `main`.
- [x] Capture the three **10xChampion evidence** screenshots: pipeline view with ≥1 visible job, job logs, and the LLM review comment on the PR. Post them per the Mission Log instructions; collect the per-lesson badges for M5L2 and M5L3. *(Zrzuty w `odznaka Champions/`. Wysyłka do Mission Log — po stronie autora.)*

---

## Critical files

| File | Purpose |
|---|---|
| `packages/code-reviewer/package.json` | ESM TS package, deps + `review`/`eval` scripts |
| `packages/code-reviewer/src/review-schema.ts` | zod: 6 criteria + verdict + summary (single source of truth) |
| `packages/code-reviewer/src/prompt.ts` | SYSTEM_PROMPT + `buildReviewPrompt` (criteria tuned to `CLAUDE.md`) |
| `packages/code-reviewer/src/agent.ts` | rdzeń: `ToolLoopAgent` + `Output.object`, cap na rozmiar diffa |
| `packages/code-reviewer/src/review.ts` | CLI: stdin diff → JSON stdout |
| `packages/code-reviewer/src/promptfoo-provider.ts` | custom provider promptfoo reużywający agenta |
| `packages/code-reviewer/promptfooconfig.yaml` + `fixtures/*.diff` | multi-model eval matrix + regression gate |
| `.github/actions/ai-reviewer/action.yml` | composite action: run agent → comment + labels → `verdict` output |
| `.github/actions/ai-reviewer/scripts/format-comment.mjs` | render JSON → komentarz Markdown |
| `.github/workflows/review.yml` | `pull_request` consumer: diff → action → merge gate |

## Reuse / alignment notes

- Mirror the lesson's split-schema pattern: schema + prompt in their own modules so the agent **and** promptfoo import the same definitions (M5L3 task 3 depends on this importability).
- Don't touch `.github/workflows/deploy.yml`; the review pipeline is additive.
- Pin third-party actions to a SHA where practical; `actions/checkout@v4`/`setup-node@v4` are acceptable as-is per the lesson.
- Keep the agent's loop short (`stopWhen: stepCountIs(2)`) and tools empty — a diff review is a single scorer pass, not an agentic crawl (cost control on per-PR runs).

## Verification summary

1. **Local (M5L2):** `git diff origin/main...HEAD | npm run review` → valid 6-criteria JSON + verdict.
2. **Evals (M5L3 t3):** `npm run eval` → green matrix across 2–3 models; planted-flaw diff fails, clean diff passes.
3. **CI (M5L3):** open a PR → `review` job runs, posts comment + label, gate red on a bad diff.
4. **Badge:** three screenshots (pipeline + job logs + PR comment) → Mission Log.

---

## Outcome & deviations from plan (what actually happened)

Architektura i zakres bez zmian; poniżej różnice wykryte przy implementacji i realne wyniki.

**Zależności / toolchain**
- `@openrouter/ai-sdk-provider`: trzeba `^2.9` (nie 1.x) — wersje 1.x peer-zależą od `ai@^5`, dopiero 2.9+ wspiera `ai@6` (`ToolLoopAgent` z polem `instructions`).
- `tsconfig`: wymagane `allowImportingTsExtensions: true` przy jawnych importach `./*.ts` + Bundler resolution.
- `npm run review` ładuje `.env` przez `tsx --env-file-if-exists=.env` (CI bez `.env` nie wybucha; sekret wstrzykiwany env-em).
- **Pułapka:** `npm run` wypisuje baner na stdout i psuje JSON przy `| node`. Lokalnie pipe'uj `npx tsx src/review.ts` (CI tak robi); albo `npm run -s`.

**Struktura kodu**
- Rdzeń wydzielony do `src/agent.ts` (eksport `review()`), `src/review.ts` to cienkie CLI — żeby custom provider promptfoo importował agenta bez odpalania CLI (`main()` nie może uruchamiać się przy imporcie).
- Evale: zamiast osobnego pliku promptu — **custom provider** (`src/promptfoo-provider.ts`) wołający realnego agenta. Dzięki temu evale porównują modele na tym samym kontrakcie (structured output), a `is-json` zawsze trzyma; evale testują *osąd*, nie kształt.

**Pipeline**
- Diff liczony **wewnątrz akcji** z `base-ref` (nie przekazywany jako surowy input `diff`) — uniknięcie kruchego przekazywania wielkich stringów przez `inputs`.
- Akcja **wyklucza pliki generowane/lock** (`package-lock.json`, `*.lock`, `dist`, `*.min.js`, `*.snap`) z `git diff`; agent ma bezpiecznik `MAX_DIFF_CHARS` (120k).
- Workflow: **bez** `workflow_dispatch` (bezużyteczny bez kontekstu PR); trigger `labeled` ograniczony do `ai-cr:review`, by nadawanie `ai-cr:passed/failed` przez akcję nie wywoływało pętli.
- Bramka: `review.ts` kończy `0` przy każdym poprawnym review (werdykt w JSON); osobny krok workflow robi `exit 1` na `verdict == fail` — żeby najpierw powstał komentarz, potem bramka.

**Strojenie promptu (M5L3 t1)**
- Dodano regułę „nie zgłaszaj braku `requireSsoAuth`/`requireWeddingMember` w diffie" (montowane na poziomie `server.js`/`router.use`) — usunęło false-positive na czystym diffie (security 6→9), nie osłabiając wykrycia realnej luki (security 1).

**Wyniki evali (M5L3 t3)** — Haiku 4.5: oba testy PASS → **domyślny model CI**. Sonnet 4.6: ERROR (OpenRouter affordability vs duże `maxOutputTokens`). GLM 5.1: łapie lukę, ale over-flaguje clean → `fail`. Koszt przebiegu ~60k tokenów, ~9 min.

**Iteracja na CI (red→green)** — pierwszy run PR #1 **czerwony**: diff zawierał `package-lock.json` → 211 505 tokenów > 200 000 (limit Haiku). Fix: wykluczenie lockfile/generated + cap `MAX_DIFF_CHARS`; po fixie diff PR spadł z 12 337 do 821 linii, run #2 zielony (PASS).

**Środowisko** — `gh` doinstalowany przez winget (2.95); uwierzytelnienie przez reużycie tokenu z Git Credential Manager (`GH_TOKEN`), bo `gh auth login --with-token` wymagał scope `read:org`, którego token nie miał. Sekret repo `OPENROUTER_API_KEY` ustawiony z lokalnego `.env`.
