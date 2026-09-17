import { test, expect, Page } from '@playwright/test';
import { login } from './helpers';

const hasCreds = !!process.env.E2E_EMAIL && !!process.env.E2E_PASSWORD;

/** Editions used to prove the panel width is edition-independent. */
const EDITIONS = [
  'Kampala September 2026',
  'Kampala October 2026',
  'Kampala April 2026',
];

/**
 * REGRESSION GUARD — Quick Entry Panel width must be identical across editions.
 *
 * Root cause this protects against: the panel page wrapper used `max-w-*`
 * + `mx-auto` without `w-full`. As a flex item inside the admin shell's
 * `flex flex-col` content column, auto margins disabled stretch, so the panel
 * sized to its widest child (shrink-to-fit) and silently changed width with
 * edition-specific content. Layout now comes from the shared <PageContainer>,
 * which always applies `w-full`. Do not reintroduce per-instance width classes.
 */

async function openQuickEntry(page: Page): Promise<boolean> {
  const navButton = page.locator('button[title="Quick Entry"]').first();
  if (!(await navButton.isVisible().catch(() => false))) return false;
  await navButton.click();
  await page.waitForTimeout(400);
  return (await page.locator('[data-testid="quick-entry-page"]').count()) > 0;
}

async function selectEdition(page: Page, name: string): Promise<boolean> {
  const trigger = page.locator('header button[aria-haspopup="listbox"]').first();
  if (!(await trigger.isVisible().catch(() => false))) return false;
  await trigger.click();
  await page.waitForTimeout(200);

  const option = page.locator('header button', { hasText: name }).first();
  if (!(await option.isVisible().catch(() => false))) {
    await page.keyboard.press('Escape');
    return false;
  }
  await option.click();
  await page.waitForTimeout(600);
  return true;
}

async function quickEntryWidth(page: Page): Promise<number> {
  return page
    .locator('[data-testid="quick-entry-page"]')
    .evaluate((el) => el.getBoundingClientRect().width);
}

test.describe('Quick Entry Panel — width parity across editions', () => {
  test.skip(
    !hasCreds,
    'Set E2E_EMAIL and E2E_PASSWORD to run authenticated layout checks'
  );

  test.use({ viewport: { width: 1440, height: 900 } });

  test('panel width is identical for 3 editions regardless of record count', async ({ page }) => {
    expect(await login(page)).toBeTruthy();
    expect(await openQuickEntry(page)).toBeTruthy();

    const measured: { edition: string; width: number }[] = [];
    for (const edition of EDITIONS) {
      if (!(await selectEdition(page, edition))) continue;
      measured.push({ edition, width: await quickEntryWidth(page) });
    }

    expect(
      measured.length,
      `Expected at least 3 measurable editions, got ${measured.length}. ` +
        `Ensure the region exposes: ${EDITIONS.join(', ')}`
    ).toBeGreaterThanOrEqual(3);

    const widths = measured.map((m) => Math.round(m.width));
    const first = widths[0];
    for (const m of measured) {
      expect(
        Math.abs(Math.round(m.width) - first),
        `Quick Entry Panel width differs for "${m.edition}": ` +
          `${Math.round(m.width)}px vs ${first}px — layout must not vary per edition. ` +
          `Measured: ${JSON.stringify(measured)}`
      ).toBeLessThanOrEqual(1);
    }
  });
});
