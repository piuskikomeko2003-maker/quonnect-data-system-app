import { expect, Page } from '@playwright/test';

/**
 * Device viewports to smoke-test. Covers small/medium/large phones, a tablet,
 * tablet landscape, laptop, desktop, and a short landscape phone (the least
 * forgiving case for vertical layout math).
 */
export const VIEWPORTS = [
  { name: 'phone-320', width: 320, height: 568 },
  { name: 'phone-375', width: 375, height: 667 },
  { name: 'phone-414', width: 414, height: 896 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'tablet-landscape-1024', width: 1024, height: 768 },
  { name: 'laptop-1280', width: 1280, height: 800 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'phone-landscape-812', width: 812, height: 375 },
] as const;

export const AUTH_ROUTES = [
  { name: 'Overview', title: 'Overview' },
  { name: 'Vendors', title: 'Vendors' },
  { name: 'Walk-ins', title: 'Walk-ins' },
  { name: 'Paid Vendors', title: 'Paid Vendors' },
  { name: 'Quick Entry', title: 'Quick Entry' },
  { name: 'Import/Export', title: 'Import/Export' },
  { name: 'Jobs Supported', title: 'Jobs Supported' },
  { name: 'Form Builder', title: 'Form Builder' },
  { name: 'Create Market', title: 'Create Market' },
  { name: 'Settings', title: 'Settings' },
] as const;

/** True when the authenticated app shell is present on the page. */
export async function hasAppShell(page: Page): Promise<boolean> {
  return (await page.locator('#app-scroll').count()) > 0;
}

/**
 * Fails if the page can be scrolled horizontally by more than 1px, which is the
 * classic symptom of a container/layout that does not fit the viewport.
 */
export async function expectNoHorizontalOverflow(page: Page, label: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    scrollWidth,
    `${label}: horizontal overflow (scrollWidth ${scrollWidth} > clientWidth ${clientWidth})`
  ).toBeLessThanOrEqual(clientWidth + 1);
}

/**
 * In the app shell, scrolling must be owned by the internal #app-scroll
 * container. If the document itself scrolls, we get a double scrollbar.
 */
export async function expectNoDocumentVerticalScroll(page: Page, label: string) {
  if (!(await hasAppShell(page))) return;
  const { scrollHeight, clientHeight } = await page.evaluate(() => ({
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
  }));
  expect(
    scrollHeight,
    `${label}: document-level vertical scroll detected (an inner scroller should own it)`
  ).toBeLessThanOrEqual(clientHeight + 1);
}

/**
 * Verifies the primary scroll container exists, is not collapsed, does not
 * exceed the viewport, and can reach the bottom of its content (i.e. nothing is
 * clipped by an ancestor with overflow:hidden).
 */
export async function expectPrimaryScrollUsable(
  page: Page,
  label: string,
  viewportHeight: number
) {
  if (!(await hasAppShell(page))) return;
  const info = await page.evaluate(() => {
    const s = document.getElementById('app-scroll');
    if (!s) return null;
    const prev = s.scrollTop;
    s.scrollTop = s.scrollHeight;
    const reachedBottom = s.scrollTop + s.clientHeight >= s.scrollHeight - 2;
    s.scrollTop = prev;
    return { clientHeight: s.clientHeight, scrollHeight: s.scrollHeight, reachedBottom };
  });

  expect(info, `${label}: #app-scroll not found`).not.toBeNull();
  expect(info!.clientHeight, `${label}: primary scroll container has no height`).toBeGreaterThan(0);
  expect(
    info!.clientHeight,
    `${label}: primary scroll container is taller than the viewport`
  ).toBeLessThanOrEqual(viewportHeight + 1);
  expect(
    info!.reachedBottom,
    `${label}: could not scroll content to the bottom (content is clipped)`
  ).toBeTruthy();
}

/**
 * Verifies the top header is pinned: it does not move when the inner content
 * scrolls, and it stays fully inside the viewport (no top/bottom clipping).
 */
export async function expectHeaderPinned(page: Page, label: string) {
  if (!(await hasAppShell(page))) return;
  const header = page.locator('header').first();
  if ((await header.count()) === 0) return;

  const before = await header.boundingBox();

  await page.evaluate(() => {
    const s = document.getElementById('app-scroll');
    if (s) s.scrollTop = s.scrollHeight;
  });
  await page.waitForTimeout(150);
  const after = await header.boundingBox();

  expect(after, `${label}: header not measurable`).not.toBeNull();
  if (before && after) {
    expect(
      Math.abs(after.y - before.y),
      `${label}: header moved while content scrolled (not pinned)`
    ).toBeLessThanOrEqual(1);
  }
  expect(after!.y, `${label}: header clipped at the top`).toBeGreaterThanOrEqual(-1);
  expect(
    after!.y + after!.height,
    `${label}: header clipped at the bottom`
  ).toBeLessThanOrEqual(page.viewportSize()!.height + 1);

  // Restore scroll position so screenshots capture the top of the page.
  await page.evaluate(() => {
    const s = document.getElementById('app-scroll');
    if (s) s.scrollTop = 0;
  });
}

/**
 * Ensures a control is reachable by scrolling (proves content is not trapped
 * inside a clipped/overflow-hidden ancestor).
 */
export async function expectContentReachable(page: Page, selector: string, label: string) {
  const el = page.locator(selector).first();
  await el.scrollIntoViewIfNeeded();
  await expect(el, `${label}: ${selector} is not reachable in the viewport`).toBeInViewport();
}

/**
 * Asserts every open dialog (role="dialog") fits inside the viewport, so a
 * modal can never overflow the screen on small devices.
 */
export async function expectVisibleDialogsFitViewport(page: Page, label: string) {
  const dialogs = page.locator('[role="dialog"]');
  const count = await dialogs.count();
  const viewport = page.viewportSize();
  if (!viewport) return;

  for (let i = 0; i < count; i++) {
    const dialog = dialogs.nth(i);
    if (!(await dialog.isVisible().catch(() => false))) continue;
    const box = await dialog.boundingBox();
    if (!box) continue;
    expect(
      box.height,
      `${label}: dialog ${i} is taller than the viewport (${Math.round(box.height)} > ${viewport.height})`
    ).toBeLessThanOrEqual(viewport.height + 1);
    expect(
      box.width,
      `${label}: dialog ${i} is wider than the viewport (${Math.round(box.width)} > ${viewport.width})`
    ).toBeLessThanOrEqual(viewport.width + 1);
  }
}

export async function login(page: Page) {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) return false;

  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // The authenticated shell exposes rounded sidebar nav buttons with a title.
  try {
    await page.waitForSelector('button[title="Overview"]', { timeout: 30_000 });
    return true;
  } catch {
    return false;
  }
}

export async function openNavIfMobile(page: Page, width: number) {
  if (width < 768) {
    const menuButton = page.locator('[aria-label="Open menu"]');
    if (await menuButton.isVisible().catch(() => false)) {
      await menuButton.click();
      await page.waitForTimeout(250);
    }
  }
}
