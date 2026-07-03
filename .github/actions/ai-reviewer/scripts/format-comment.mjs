// Renderuje JSON z agenta review do komentarza Markdown na PR.
// Bez zależności — czysty Node ESM. Użycie: node format-comment.mjs <review.json>
import { readFileSync } from 'node:fs';

const path = process.argv[2];
if (!path) {
  console.error('Użycie: node format-comment.mjs <review.json>');
  process.exit(1);
}

const r = JSON.parse(readFileSync(path, 'utf8'));

const rows = [
  ['Poprawność implementacji', r.implementationCorrectness],
  ['Idiomatyczność', r.idiomaticity],
  ['Złożoność', r.complexity],
  ['Pokrycie testami', r.testRiskCoverage],
  ['Dokumentacja', r.documentation],
  ['Bezpieczeństwo', r.securitySafety],
];

const badge = r.verdict === 'pass' ? '✅ **PASS**' : '❌ **FAIL**';

let out = `## 🤖 AI Code Review — ${badge}\n\n`;
out += '| Kryterium | Ocena (1–10) |\n|---|:--:|\n';
for (const [label, score] of rows) out += `| ${label} | ${score} |\n`;
out += `\n${r.summary}\n`;
out +=
  '\n<sub>Wygenerowane przez `packages/code-reviewer` (Vercel AI SDK + OpenRouter). ' +
  'Werdykt `fail` blokuje merge.</sub>\n';

process.stdout.write(out);
