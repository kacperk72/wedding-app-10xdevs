import { test, expect } from '@playwright/test';
import { authenticateAs } from './support/sso-stub';

// Golden flow (test-plan Risk #2 — cross-account stale read): two independent
// browser contexts in ONE test prove that partner B's fresh page load renders
// partner A's committed guest. GuestsService.create() appends optimistically
// only for the acting user, so B genuinely depends on the re-fetch hitting the
// backend — this is the signal the API layer cannot give.
//
// Polish-UI assertions target the rendered DOM (US-01): the ToastService
// feedback copy and the app-header date from formatDDMMYYYY (seeded wedding
// date 2026-09-12 → "12.09.2026"). Backend error bodies are mixed-locale and
// are deliberately not asserted.
test('partner B sees partner A\'s committed guest after a fresh load', async ({ browser }) => {
  // Unique per run so repeated runs against a reused dev server stay green.
  const lastName = `Próbna-${Date.now()}`;

  // --- Context A: partner A adds a guest -----------------------------------
  const contextA = await browser.newContext();
  await authenticateAs(contextA, 'a');
  const pageA = await contextA.newPage();

  await pageA.goto('/app/goscie');
  await expect(pageA.getByRole('heading', { name: 'Goście' })).toBeVisible();

  // DD.MM.YYYY: the shell header renders the seeded wedding date.
  await expect(pageA.locator('.header__counter-date')).toHaveText('12.09.2026');

  await pageA.getByRole('button', { name: 'Dodaj gościa' }).first().click();
  const dialog = pageA.getByRole('dialog', { name: 'Dodaj gościa' });
  await expect(dialog).toBeVisible();
  await dialog.locator('#firstName').fill('Celina');
  await dialog.locator('#lastName').fill(lastName);
  await dialog.getByRole('button', { name: 'Dodaj', exact: true }).click();

  // Polish feedback copy rendered via ToastService (auto-dismisses after 4s,
  // so assert before anything slow).
  await expect(pageA.getByRole('status').filter({ hasText: 'Gość został dodany.' })).toBeVisible();

  // A sees the new guest (optimistic append + server echo).
  await expect(pageA.locator('.data-table')).toContainText(`Celina ${lastName}`);

  // --- Context B: partner B loads fresh and must see A's write -------------
  const contextB = await browser.newContext();
  await authenticateAs(contextB, 'b');
  const pageB = await contextB.newPage();

  await pageB.goto('/app/goscie');
  await expect(pageB.getByRole('heading', { name: 'Goście' })).toBeVisible();

  // The committed write, served by the backend on B's re-fetch — never by
  // B's local state (separate context, separate storage, first load).
  await expect(pageB.locator('.data-table')).toContainText(`Celina ${lastName}`);

  await contextA.close();
  await contextB.close();
});
