import { review } from './agent.ts';

/**
 * Custom provider promptfoo, który woła DOKŁADNIE tego samego agenta co produkcja
 * (ten sam prompt systemowy i ten sam schemat structured output), zmieniając jedynie
 * model per provider. Dzięki temu evale porównują modele na realnym kontrakcie review,
 * a nie na osobnej kopii promptu.
 *
 * Wejściowy `prompt` (z konfiguracji prompts: ['{{diff}}']) traktujemy jako diff.
 */
interface ProviderOptions {
  id?: string;
  label?: string;
  config?: { model?: string };
}

interface CallApiResult {
  output?: string;
  error?: string;
  tokenUsage?: { prompt?: number; completion?: number; total?: number };
}

export default class CodeReviewProvider {
  private readonly providerId: string;
  private readonly label?: string;
  private readonly model?: string;

  constructor(options: ProviderOptions = {}) {
    this.providerId = options.id || 'code-reviewer';
    this.label = options.label;
    this.model = options.config?.model;
  }

  id(): string {
    return this.providerId;
  }

  async callApi(prompt: string): Promise<CallApiResult> {
    try {
      const { review: result, usage } = await review({ diff: prompt }, { model: this.model });
      return {
        output: JSON.stringify(result),
        tokenUsage: {
          prompt: usage?.inputTokens,
          completion: usage?.outputTokens,
          total: usage?.totalTokens,
        },
      };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }
}
