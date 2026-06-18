import { ToolLoopAgent, Output, stepCountIs } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { REVIEW_SCHEMA, type Review } from './review-schema.ts';
import { SYSTEM_PROMPT, buildReviewPrompt, type ReviewInput } from './prompt.ts';

export const DEFAULT_MODEL = 'anthropic/claude-haiku-4.5';

/**
 * Bezpiecznik na zbyt duże diffy: powyżej tego limtu znaków przycinamy wejście,
 * żeby nie przekroczyć okna kontekstowego modelu (np. 200k tokenów Haiku).
 * Pierwsza linia obrony to wykluczanie plików generowanych (lock, dist) już na
 * etapie liczenia diffa — patrz action.yml. To jest siatka bezpieczeństwa.
 */
const MAX_DIFF_CHARS = 120_000;

export interface ReviewOptions {
  /** vendor/model na OpenRouter; domyślnie REVIEW_MODEL z env lub DEFAULT_MODEL. */
  model?: string;
}

export interface ReviewUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

export interface ReviewResult {
  review: Review;
  model: string;
  usage?: ReviewUsage;
}

/**
 * Rdzeń reviewera: diff (+ opcjonalnie tytuł/opis PR-a) na wejściu,
 * ustrukturyzowana ocena na wyjściu. Importowane przez CLI (review.ts)
 * oraz przez custom providera promptfoo (promptfoo-provider.ts).
 *
 * Wąska, jednokrokowa pętla "diff wchodzi, werdykt wychodzi" — bez narzędzi,
 * 2 kroki (model formułuje ocenę, potem emituje structured output). Kontrola
 * kosztu: recenzja diffa nie potrzebuje agentowego crawlowania repo.
 */
export async function review(
  input: ReviewInput,
  options: ReviewOptions = {},
): Promise<ReviewResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      'Brak OPENROUTER_API_KEY. Lokalnie: ustaw w .env (skopiuj z .env.example). W CI: sekret repo OPENROUTER_API_KEY.',
    );
  }

  let diff = input.diff;
  if (diff.length > MAX_DIFF_CHARS) {
    diff =
      diff.slice(0, MAX_DIFF_CHARS) +
      '\n\n[UWAGA: diff przekroczył limit i został przycięty — oceniaj tylko widoczny fragment i zaznacz to w podsumowaniu.]';
  }

  const openrouter = createOpenRouter({ apiKey });
  const modelId = options.model || process.env.REVIEW_MODEL || DEFAULT_MODEL;

  const reviewer = new ToolLoopAgent({
    model: openrouter(modelId),
    instructions: SYSTEM_PROMPT,
    tools: {},
    output: Output.object({ schema: REVIEW_SCHEMA }),
    stopWhen: stepCountIs(2),
  });

  const { output, totalUsage } = await reviewer.generate({
    prompt: buildReviewPrompt({ ...input, diff }),
  });

  return {
    review: output,
    model: modelId,
    usage: totalUsage
      ? {
          inputTokens: totalUsage.inputTokens,
          outputTokens: totalUsage.outputTokens,
          totalTokens: totalUsage.totalTokens,
        }
      : undefined,
  };
}
