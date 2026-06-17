import { expect, test } from '@playwright/test';
import { authenticateAs } from './support/sso-stub';

// Provenance
//   Risk:  test-plan.md Risk #9 / Flow 5 — the catering "build selection → see
//          price → freeze into contract" journey must produce a real, visible
//          contract carrying the computed price. A regression anywhere across
//          catering → contracts → payments breaks a primary user journey.
//   Why e2e: crosses catering UI → selection/price API → freeze endpoint →
//          contracts DB → contracts page render. No unit/integration layer sees
//          the whole journey end-to-end in the browser.
//   Seed:  modeled on golden-flow.spec.ts (auth stub, role locators, DOM-only
//          assertions). The "sala" vendor is hand-seeded in e2e-seed.js; the
//          offer/package/selection are built through the real preset API below.

test('zamrożenie oferty cateringowej tworzy umowę z policzoną ceną', async ({ context, page }) => {
  await authenticateAs(context, 'a');

  // Unique guest count per run → a unique total, so re-runs against a reused
  // dev server don't collide on identical contract rows.
  const guests = 120 + (Date.now() % 80);

  // --- Load the catering configurator
  await page.goto('/app/oferta-sali');
  await expect(page.getByRole('heading', { name: 'Oferta sali' })).toBeVisible();

  // --- Build an offer from the real Pałac Polanka preset (exercises the API)
  await page.getByRole('button', { name: 'Dodaj ofertę' }).click();
  const offerDialog = page.getByRole('dialog', { name: 'Dodaj ofertę sali' });
  await offerDialog.getByRole('button', { name: 'Załaduj Pałac Polanka 2026' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Oferta Pałacu Polanka została załadowana.' }),
  ).toBeVisible();

  // --- Set our own guest count and let the price recompute
  await page.getByLabel('Goście').fill(String(guests));
  const priceSummary = page.locator('.price-summary');
  await expect(priceSummary).toContainText(`× ${guests}`);

  // The price the couple sees is the oracle the frozen contract must match.
  const total = (await priceSummary.getByRole('heading').innerText()).trim();
  expect(total).not.toMatch(/^0\s*zł$/); // sanity: a real, non-zero price rendered

  // --- Freeze the selection into a contract (vendor + payment schedule default)
  await priceSummary.getByRole('button', { name: 'Zamroź w umowie' }).click();
  const freezeDialog = page.getByRole('dialog', { name: 'Zamroź w umowie' });
  await freezeDialog.getByRole('button', { name: 'Utwórz umowę' }).click();

  // --- The journey's user-visible outcome: confirmation + landing on contracts
  await expect(
    page.getByRole('status').filter({ hasText: 'Umowa została utworzona.' }),
  ).toBeVisible();
  await page.waitForURL(/\/app\/umowy$/);

  // --- The frozen contract appears for the vendor, carrying the computed total
  const contractRow = page
    .locator('.data-table')
    .getByRole('row')
    .filter({ hasText: 'Pałac Polanka' })
    .filter({ hasText: total });
  await expect(contractRow).toBeVisible();
});
