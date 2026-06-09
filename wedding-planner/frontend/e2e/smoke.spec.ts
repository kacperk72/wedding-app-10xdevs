import { test, expect } from '@playwright/test';
import { authenticateAs } from './support/sso-stub';

// Proves the e2e harness end-to-end before the golden flow: a stubbed SSO
// session for a seeded member passes the authGuard (token + /me weddingId) and
// lands on the authenticated /app shell, rather than redirecting to '/' (login)
// or '/app/setup' (no wedding).
test('stubbed SSO login lands on the authenticated /app shell', async ({ context, page }) => {
  await authenticateAs(context, 'a');

  await page.goto('/app');

  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole('navigation', { name: 'Nawigacja główna' })).toBeVisible();
});
