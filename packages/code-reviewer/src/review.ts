import { review } from './agent.ts';

/** Wczytanie diffa ze standardowego wejścia (git diff origin/main...HEAD | npm run review). */
async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

async function main(): Promise<void> {
  const diff = await readStdin();
  if (!diff.trim()) {
    throw new Error('Pusty diff na stdin. Użyj: git diff origin/main...HEAD | npm run review');
  }

  const { review: result, model, usage } = await review({
    title: process.env.PR_TITLE,
    body: process.env.PR_BODY,
    diff,
  });

  // Telemetria na stderr, żeby nie zaśmiecać JSON-a na stdout.
  process.stderr.write(
    `[code-reviewer] model=${model} in=${usage?.inputTokens ?? '?'} out=${usage?.outputTokens ?? '?'}\n`,
  );

  // JSON na stdout — to jest kontrakt, na którym opiera się bramka w CI.
  // Świadomie kończymy 0 nawet przy werdykcie "fail": pipeline najpierw musi
  // odczytać JSON (komentarz + etykieta), a dopiero osobny krok bramkuje merge
  // na podstawie pola verdict. Exit code 2 zostaje zarezerwowany na realne błędy.
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}

main().catch((err) => {
  process.stderr.write(`[code-reviewer] błąd: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(2);
});
