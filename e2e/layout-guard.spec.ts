import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

/**
 * No-auth structural guard. Runs in CI without credentials.
 *
 * Protects the Quick Entry layout invariant: the page must get its width from
 * the single shared <PageContainer>, which is required to pair its max-width
 * with `w-full` (otherwise a flex item falls back to content-dependent
 * shrink-to-fit sizing — the original per-edition width bug).
 */
test.describe('layout guard — form pages use the shared container', () => {
  test('PageContainer pairs its max-width with w-full', () => {
    const src = fs.readFileSync(
      path.join(root, 'src/components/layout/PageContainer.tsx'),
      'utf8'
    );
    expect(src).toContain('PAGE_CONTENT_MAX_WIDTH');
    expect(src).toContain('w-full');
  });

  test('Quick Entry page renders through PageContainer without width overrides', () => {
    const src = fs.readFileSync(path.join(root, 'src/app/page.tsx'), 'utf8');
    const marker = 'data-testid="quick-entry-page"';
    const idx = src.indexOf(marker);
    expect(idx, 'Quick Entry must render through the shared PageContainer').toBeGreaterThan(-1);

    const open = src.lastIndexOf('<PageContainer', idx);
    const tag = src.slice(open, src.indexOf('>', idx) + 1);
    expect(tag, `PageContainer must not carry per-instance width classes: ${tag}`).not.toMatch(
      /max-w-|w-\[/
    );
  });
});
