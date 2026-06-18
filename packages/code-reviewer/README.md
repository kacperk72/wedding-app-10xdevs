# code-reviewer

Agent do code review na **Vercel AI SDK 6** + **OpenRouter**. Dostaje na wejściu
`git diff`, zwraca ustrukturyzowaną ocenę JSON (6 kryteriów 1-10 + werdykt pass/fail
+ podsumowanie po polsku). Używany lokalnie oraz jako krok pipeline'u CI (review na PR).

Ścieżka A modułu 5 (10xChampion): M5L2 (ten agent) + M5L3 (`.github/workflows/review.yml`).

## Setup

```bash
cd packages/code-reviewer
npm install
cp .env.example .env   # wpisz OPENROUTER_API_KEY
```

## Uruchomienie lokalne

```bash
# z katalogu repo, na bieżącej gałęzi:
git diff origin/main...HEAD | (cd packages/code-reviewer && npm run review)

# albo dowolny diff:
git diff HEAD~1 | npm run review
```

Diff idzie na **stdin**, JSON wynikowy na **stdout**, telemetria (model, tokeny) na stderr.
Tytuł/opis PR-a (opcjonalnie) przez zmienne `PR_TITLE` / `PR_BODY`.
Model nadpisujesz przez `REVIEW_MODEL` (domyślnie `anthropic/claude-haiku-4.5`).

## Evale (porównanie modeli)

```bash
OPENROUTER_API_KEY=... npm run eval     # promptfoo: macierz modeli x fixtures
```

## Pliki

| Plik | Rola |
|---|---|
| `src/review-schema.ts` | zod: 6 kryteriów + verdict + summary (jedyne źródło prawdy) |
| `src/prompt.ts` | prompt systemowy + builder; tu stroisz kryteria (DoD z CLAUDE.md) |
| `src/review.ts` | `ToolLoopAgent` + `Output.object`, stdin -> JSON |
| `promptfooconfig.yaml` + `fixtures/` | evale i bramka regresji |

Exit code: `0` = review się wykonało (werdykt w JSON-ie), `2` = błąd (np. brak klucza,
pusty diff). Bramkowanie merge'a robi pipeline na podstawie pola `verdict`, nie exit code.
