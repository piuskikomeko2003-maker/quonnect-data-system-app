import { test, expect } from '@playwright/test';
import {
  AUTH_ROUTES,
  login,
  openNavIfMobile,
  expectNoHorizontalOverflow,
  expectNoDocumentVerticalScroll,
  expectPrimaryScrollUsable,
  expectHeaderPinned,
  expectVisibleDialogsFitViewport,
} from './helpers';

const hasCreds = !!process.env.E2E_EMAIL && !!process.env.E2E_PASSWORD;

/**
 * A representative subset of viewports for the authenticated sweep so the suite
 * stays fast while still covering mobile, tablet, desktop, and landscape phone.
 */
const AUTH_VIEWPORTS = [
  { name: 'phone-375', width: 375, height: 667 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'laptop-1280', width: 1280, height: 800 },
  { name: 'phone-landscape-812', width: 812, height: 375 },
] as const;

test.describe('dashboard — responsive layout', () => {
  test.skip(
    !hasCreds,
    'Set E2E_EMAIL and E2E_PASSWORD to run authenticated responsive checks'
  );

  for (const vp of AUTH_VIEWPORTS) {
    test.describe(vp.name, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test('every nav section fits, scrolls, and stays pinned', async ({ page }) => {
        const loggedIn = await login(page);
        expect(loggedIn, 'login succeeded (check credentials/approval)').toBeTruthy();

        for (const route of AUTH_ROUTES) {
          const label = `${vp.name} / ${route.name}`;
          await openNavIfMobile(page, vp.width);

          const navButton = page.locator(`button[title="${route.title}"]`).first();
          if (!(await navButton.isVisible().catch(() => false))) continue;

          await navButton.click();
          await page.waitForTimeout(400);

          await expectNoHorizontalOverflow(page, label);
          await expectNoDocumentVerticalScroll(page, label);
          await expectPrimaryScrollUsable(page, label, vp.height);
          await expectHeaderPinned(page, label);
          await expectVisibleDialogsFitViewport(page, label);

          await page.screenshot({
            path: `e2e/screenshots/${vp.name}-${route.name.replace(/[^a-z0-9]+/gi, '-')}.png`,
            fullPage: true,
          });
        }
      });

      test('region creation modal stays inside the viewport', async ({ page }) => {
        const loggedIn = await login(page);
        expect(loggedIn, 'login succeeded (check credentials/approval)').toBeTruthy();

        const regionTrigger = page.locator('button[aria-haspopup="listbox"]').first();
        if (!(await regionTrigger.isVisible().catch(() => false))) {
          test.skip(true, 'Region dropdown not available in this environment');
          return;
        }
        await regionTrigger.click();
        await page.waitForTimeout(200);

        const createRegion = page.getByText('Create New Region', { exact: false }).first();
        if (!(await createRegion.isVisible().catch(() => false))) {
          test.skip(true, 'Create Region action not available');
          return;
        }
        await createRegion.click();
        await page.waitForTimeout(300);

        await expectVisibleDialogsFitViewport(page, `${vp.name} region modal`);
      });
    });
  }
});
