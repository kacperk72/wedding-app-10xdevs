import { expect, test } from '@playwright/test';
import { authenticateAs } from './support/sso-stub';

// Risk #4 / Flow 3 — a payment due inside the 30-day window must surface on the
// contracts page "Najbliższe płatności" card (the couple's "what's due soon"
// view). The window math is unit-tested at the backend; this proves it actually
// renders. Seeded payment "pay-seed" is due ~10 days out.
test('karta „Najbliższe płatności" pokazuje ratę z okna 30 dni', async ({ context, page }) => {
  await authenticateAs(context, 'a');
  await page.goto('/app/umowy');

  const upcoming = page.locator('section.panel').filter({ hasText: 'Najbliższe płatności' });
  await expect(upcoming).toBeVisible();

  // The seeded due installment shows up (its vendor), and the empty-state copy is gone.
  await expect(upcoming).toContainText('Pałac Polanka');
  await expect(upcoming).not.toContainText('Brak płatności w najbliższych 30 dniach');
});
