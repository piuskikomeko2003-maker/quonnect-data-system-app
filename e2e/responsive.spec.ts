import { test } from '@playwright/test';
import {
  VIEWPORTS,
  expectNoHorizontalOverflow,
  expectContentReachable,
} from './helpers';

test.describe('public pages — responsive layout', () => {
  for (const vp of VIEWPORTS) {
    test.describe(vp.name, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      for (const path of ['/login', '/signup']) {
        test(`${path} fits and stays reachable`, async ({ page }) => {
          await page.goto(path);
          await page.waitForLoadState('networkidle');

          await expectNoHorizontalOverflow(page, `${vp.name} ${path}`);

          // The primary action must be reachable by scrolling — proves the
          // content is not trapped in a clipped ancestor on short screens.
          await expectContentReachable(
            page,
            'button[type="submit"]',
            `${vp.name} ${path}`
          );

          await page.screenshot({
            path: `e2e/screenshots/${vp.name}${path.replace('/', '-')}.png`,
            fullPage: true,
          });
        });
      }
    });
  }
});
