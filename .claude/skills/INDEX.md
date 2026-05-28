# Spis lokalnych skilli

Skille zainstalowane w `~/.claude/skills/` oraz `<projekt>/.claude/skills/`.
Lista nie obejmuje skilli z pluginów (superpowers, figma, supabase, frontend-design itd.).

---

## Łańcuch 10x (Module 1 → Module 2)

Kolejność użycia: **shape → prd → tech-stack-selector → bootstrapper → agents-md → roadmap → (Module 2: /10x-new + implementacja)**.
Dla brownfield: **stack-assess → health-check** zamiast tech-stack/bootstrap.

### /10x-shape
Strukturalna rozmowa dyskoverowa, która zamienia pomysł (greenfield lub brownfield) w `context/foundation/shape-notes.md` — input dla `/10x-prd`.
**Kiedy:** "nowy projekt", "od pomysłu", "shape an idea", "brainstorm", "istniejący projekt + większa zmiana". **Przed:** `/10x-prd`.

### /10x-prd
Generuje `context/foundation/prd.md` z `shape-notes.md` według zablokowanego schematu (10 sekcji greenfield / 11 brownfield, auto-routing).
**Kiedy:** "write the PRD", "stwórz PRD", "turn notes into a PRD". **Po:** `/10x-shape`.

### /10x-tech-stack-selector
Wybiera starter i stack dla greenfield po napisaniu PRD; otwiera Q0 (default vs custom), prowadzi wywiad, zapisuje `context/foundation/tech-stack.md`.
**Kiedy:** "what stack should I use", "pick a stack", "co wybrać do projektu". **Po:** `/10x-prd`, **przed:** `/10x-bootstrapper`.

### /10x-bootstrapper
Scaffolduje projekt w bieżącym katalogu według wybranego startera; trzy strategie cwd (subdir-then-move / native-cwd / git-clone), zachowuje `context/`.
**Kiedy:** "bootstrap the project", "scaffold the app", "let's start the project". **Po:** `/10x-tech-stack-selector`.

### /10x-stack-assess
Ocenia istniejący projekt pod kątem agent-friendliness (4 bramki jakości); pisze `context/foundation/stack-assessment.md` ze score'ami i gotowymi wpisami do CLAUDE.md/AGENTS.md.
**Kiedy:** "assess my stack", "oceń mój stack", "is my stack agent-friendly". **Po:** `/10x-prd` (brownfield), **przed:** `/10x-health-check`.

### /10x-health-check
Health-check istniejącego projektu (zależności, security, testy, CI/CD, brakujące configi); pisze `context/foundation/health-check.md` z priorytetowymi fixami.
**Kiedy:** "health check", "sprawdź projekt", "audyt projektu". **Po:** `/10x-stack-assess`, **przed:** onboardingiem agenta.

### /10x-infra-research
Rekomenduje platformę deploymentu MVP — łączy stack, krótki wywiad i równoległy web research scoring według 5 kryteriów + 3 lensy anty-bias; pisze `context/foundation/infrastructure.md`.
**Kiedy:** "choose a platform", "gdzie deployować", "wybierz platformę". **Po:** `/10x-prd` lub `/10x-tech-stack-selector`.

### /10x-agents-md
Generuje `AGENTS.md` dla agentów AI pracujących w tym repo (manifest, README, scripts, lint/test, layout, commit history); zwięzły, critical-rules-first.
**Kiedy:** "/10x-agents-md", "create AGENTS.md", "write an agent onboarding doc".

### /10x-roadmap
Generuje `context/foundation/roadmap.md` z PRD jako uporządkowany zbiór vertical, end-to-end slice'ów (kamieni milowych user-visible).
**Kiedy:** "write the roadmap", "stwórz roadmapę", "what should I build first". **Po:** `/10x-prd` (+ tech-stack/bootstrap, jeśli greenfield).

### /10x-init
Inicjalizuje `context/` w projekcie — scaffold `context/{changes,archive,foundation}/` plus uniwersalne README.
**Kiedy:** raz na początku, jeśli `context/` jeszcze nie istnieje.

### /10x-lesson
Zapisuje powtarzającą się regułę / pattern do `context/foundation/lessons.md`.
**Kiedy:** spotkałeś klasę buga albo design pitfall warty wyciągnięcia na powierzchnię dla przyszłych review'ów.

### /10x-rule-review
Review pliku z regułami AI (CLAUDE.md, AGENTS.md, .cursor/rules/*.mdc, copilot-instructions.md itd.) — 5-punktowy scorecard + actionable fixy.
**Kiedy:** "/10x-rule-review <ścieżka>", "review AI rules", "audit AGENTS.md", "score my agent instructions".

---

## Setup i obsługa 10x-cli

### /10x-cli-setup
Fetchuje żywe README `@przeprogramowani/10x-cli` (Claude nie zna aktualnych kroków instalacji bez tego).
**Kiedy:** instalacja, update, rekonfiguracja dla innego AI (Cursor/Copilot/Claude Code), permission/npm errors, auth, onboarding po zapisie na 10xDevs.

### /10x-cli-guide
Dziennie używanie 10x-cli — `get`, `list`, `doctor`, `auth --status/--logout`, profile narzędzi, lokalizacje artefaktów, typowe błędy, tipy per-OS.
**Kiedy:** "jak pobrać lekcję", "gdzie ląduje artefakt", "co robi `doctor`", "switch AI tool". **Wyklucza:** pierwszą instalację (użyj `/10x-cli-setup`).

---

## Specjalistyczne

### /app-reverse-engineer
Reverse-engineer'uje żywą web-aplikację z URL-a w pełną specyfikację techniczną gotową do re-implementacji — Playwright MCP, screenshoty, sniffing sieci, inferowanie data modelu; emituje 5 markdownów (overview / frontend / backend / database / implementation plan).
**Kiedy:** "recreate this site", "reverse engineer this URL", "build something like X", dropnąłeś URL i prosisz o plan implementacji.

### /orchestrating-frontend-from-spec
Implementacja wielostronicowego frontendu (3+ stron, wspólny shell, services, design tokens) z pisanej specyfikacji w jednej sesji.
**Kiedy:** "implement these N pages", "build the whole frontend per the spec", świeży scaffold + spec frontendowy w docs/.

---

## Jak invokować

- **Przez `Skill` tool** w Claude Code (tak działa wewnętrznie po wpisaniu `/<nazwa>`).
- **Przez slash command** w terminalu: wpisz `/<nazwa-skilla>` i argumenty.
- Skille są też auto-uruchamiane na podstawie trigger phrases z opisu (`description:` w `SKILL.md`) — nie musisz pamiętać nazwy, wystarczy opisać zadanie.
