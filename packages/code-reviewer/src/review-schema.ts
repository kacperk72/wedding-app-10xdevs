import { z } from 'zod';

/**
 * Jedyne źródło prawdy dla kształtu odpowiedzi reviewera.
 * Importowane zarówno przez agenta (src/review.ts), jak i przez evale (promptfoo).
 *
 * Score'y trzymamy jako zwykłe z.number(): structured output części modeli
 * odrzuca minimum/maximum na typie liczbowym, więc zakres 1-10 wymuszamy
 * opisem pola (.describe) i promptem systemowym, a nie samym schematem.
 */
export const REVIEW_SCHEMA = z.object({
  implementationCorrectness: z
    .number()
    .describe(
      'Poprawność implementacji: czy kod robi to, co deklaruje (skala 1-10). ' +
        '1: logika jest błędna albo po cichu psuje istniejące zachowania. ' +
        '10: poprawny na ścieżce głównej, w przypadkach brzegowych i w obsłudze błędów.',
    ),
  idiomaticity: z
    .number()
    .describe(
      'Idiomatyczność: zgodność z konwencjami stacku i projektu (skala 1-10). ' +
        '1: łamie konwencje z CLAUDE.md (np. konstruktor zamiast inject(), brak signals, NgModules). ' +
        '10: w pełni zgodny z Angular standalone + signals / Express routes + service-role + JWKS.',
    ),
  complexity: z
    .number()
    .describe(
      'Złożoność: prostota rozwiązania względem problemu (skala 1-10). ' +
        '1: nadmiarowe abstrakcje albo zduplikacja istniejących helperów. ' +
        '10: najprostsze sensowne rozwiązanie, reużywa istniejące wzorce.',
    ),
  testRiskCoverage: z
    .number()
    .describe(
      'Pokrycie testami proporcjonalne do ryzyka zmienianych ścieżek (skala 1-10). ' +
        '1: ryzykowna zmiana (CRUD, FSM płatności, agregaty) bez testów. ' +
        '10: nowe/zmienione ścieżki mają testy w test/*.test.js, w tym przypadki brzegowe.',
    ),
  documentation: z
    .number()
    .describe(
      'Dokumentacja: czy zmiana jest udokumentowana tam, gdzie trzeba (skala 1-10). ' +
        '1: zmiana schematu/migracji bez aktualizacji 04-database.md lub STATUS.md, brak opisu nieoczywistych decyzji. ' +
        '10: docs i komentarze nadążają za kodem, brak driftu.',
    ),
  securitySafety: z
    .number()
    .describe(
      'Bezpieczeństwo (skala 1-10). ' +
        '1: brak kontroli cross-wedding (np. select * na globalnej tabeli bez .in(ids), pominięty assertWeddingRecordExists), ' +
        'wyciek sekretów (password_hash, token zaproszenia), obejście membership guard. ' +
        '10: autoryzacja w middleware, FK filtrowane po ID, brak wycieków.',
    ),
  verdict: z
    .enum(['pass', 'fail'])
    .describe(
      'Wiążący werdykt dla całej zmiany. "fail" gdy którekolwiek kryterium ujawnia poważny problem ' +
        '(zwłaszcza bezpieczeństwo lub poprawność z oceną <= 3).',
    ),
  summary: z
    .string()
    .describe(
      'Podsumowanie w języku polskim, w Markdown, gotowe jako komentarz do PR-a. ' +
        '2-4 zdania: co jest dobre, co wymaga poprawy, wskaż konkretne pliki/linie.',
    ),
});

export type Review = z.infer<typeof REVIEW_SCHEMA>;
