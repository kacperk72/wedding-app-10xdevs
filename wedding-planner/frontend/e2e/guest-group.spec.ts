import { expect, test } from '@playwright/test';
import { authenticateAs } from './support/sso-stub';

// Risk #9 / Flow 2 — adding a guest with a relation must land them under the
// matching relation group in the rendered list (the user-visible effect of
// groupedByRelation). Unique surname keeps re-runs against a reused dev server
// from colliding.
test('dodany gość pojawia się w grupie swojej relacji', async ({ context, page }) => {
  await authenticateAs(context, 'a');
  const lastName = `Grupowa-${Date.now()}`;
  await page.goto('/app/goscie');

  // Wait for the list to load (seeded "Wspólni znajomi" group present) so the
  // empty-state CTA — which also reads "Dodaj gościa" — is gone before we click.
  await expect(page.getByRole('heading', { name: 'Wspólni znajomi' })).toBeVisible();
  await page.getByRole('button', { name: 'Dodaj gościa' }).click();
  const dialog = page.getByRole('dialog', { name: 'Dodaj gościa' });
  await dialog.locator('#firstName').fill('Karol');
  await dialog.locator('#lastName').fill(lastName);
  await dialog.getByLabel('Relacja').selectOption({ label: 'Znajomi z pracy' });
  await dialog.getByRole('button', { name: 'Dodaj', exact: true }).click();

  await expect(page.getByRole('status').filter({ hasText: 'Gość został dodany.' })).toBeVisible();

  // The new guest renders inside the "Znajomi z pracy" group section, not just somewhere.
  const group = page
    .locator('section.panel')
    .filter({ has: page.getByRole('heading', { name: 'Znajomi z pracy' }) });
  await expect(group.getByText(`Karol ${lastName}`)).toBeVisible();
});
