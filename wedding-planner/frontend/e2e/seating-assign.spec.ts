import { expect, test } from '@playwright/test';
import { authenticateAs } from './support/sso-stub';

// Risk #7 / Flow 4 — the keyboard fallback must seat a guest end-to-end in the
// real browser (drag has no keyboard equivalent; this is the FR-029 path), and
// the result must be announced via the polite live region. Complements the
// mocked component test with a real DOM + persistence + announcement run.
test('przypisanie gościa do stołu przez menu (klawiatura) sadza go i ogłasza wynik', async ({
  context,
  page,
}) => {
  await authenticateAs(context, 'a');
  await page.goto('/app/rozsadzenie');

  // Seeded unseated guest "Zofia Seatowa" is in the pool — open her assign menu
  // (the same action the keyboard handler triggers, no drag). Scope to her card:
  // the shared in-memory server may hold guests left by other specs.
  const card = page.getByRole('article').filter({ hasText: 'Zofia Seatowa' });
  await card.getByRole('button', { name: 'Przypisz do stołu' }).click();
  const menu = page.getByRole('dialog', { name: 'Zofia Seatowa' });
  await expect(menu).toBeVisible();

  // The only free table is preselected; confirm the assignment.
  await menu.getByRole('button', { name: 'Przypisz', exact: true }).click();

  // The guest is now seated at the table (a seat-chip button labelled with her name)…
  await expect(page.getByRole('button', { name: 'Zofia Seatowa' })).toBeVisible();
  // …and the success is announced to assistive tech (FR-029).
  await expect(page.locator('.seating-announcer')).toContainText(
    'Przypisano Zofia Seatowa do stołu Stół Testowy',
  );
});
