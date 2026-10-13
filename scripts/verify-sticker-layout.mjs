// Verification for the sticker layout engine.
//
// Run with:  npm run test:stickers
//
// It imports the REAL modules the app ships:
//   - computeStickerLayout / slotImageBox / autoFitStickerSize  (the ONE layout fn)
//   - renderStickerPdf                                           (the real PDF)
// and proves the preview and the PDF agree on page size, page count and the
// rectangle every slot's design image is drawn into.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from 'pdf-lib';
import {
  computeStickerLayout,
  slotImageBox,
  autoFitStickerSize,
  A4_LANDSCAPE_MM,
  A4_PORTRAIT_MM,
  MIN_PRINTABLE_MARGIN_MM,
} from '../src/lib/stickers/pageLayout.ts';
import { renderStickerPdf } from '../src/lib/stickers/pdf.ts';
import { DEFAULT_STICKER_TEMPLATE, DEFAULT_STICKER_DESIGN, normalizeTemplate } from '../src/types/sticker.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

let failures = 0;
let checks = 0;
function ok(condition, message) {
  checks++;
  if (!condition) {
    failures++;
    console.error(`  ✗ ${message}`);
  }
}
function approx(a, b, tol, label) {
  ok(Math.abs(a - b) <= tol, `${label}: expected ${b}±${tol}, got ${a}`);
}

const CLOSE = (a, b, tol = 0.05) => Math.abs(a - b) <= tol;

// The shipped default: landscape 3 x 3, 89 x 59 mm, 6 mm gaps.
const base = {
  orientation: 'landscape',
  columns: 3,
  rows: 3,
  stickerWidthMm: 89,
  stickerHeightMm: 59,
  gapXMm: 6,
  gapYMm: 6,
  autoCenter: true,
  cutMarks: true,
  fitMode: 'exact',
  imageWidthPx: 1774,
  imageHeightPx: 887,
};

console.log('\nSticker layout verification\n');

// ── 1. Landscape 3x3 @ 89x59, 6 mm gaps fits with nothing cropped ─────────────
console.log('1. Landscape 3x3 @ 89x59 mm, 6 mm gaps');
{
  const layout = computeStickerLayout(base);
  ok(layout.fits, 'layout should fit');
  ok(layout.errors.length === 0, `no errors, got: ${layout.errors.join(' | ')}`);
  ok(layout.stickersPerPage === 9, `9 stickers per page, got ${layout.stickersPerPage}`);
  ok(layout.orientation === 'landscape', 'orientation landscape');
  ok(layout.pageWidthMm === A4_LANDSCAPE_MM.width && layout.pageHeightMm === A4_LANDSCAPE_MM.height, 'page 297x210');
  approx(layout.margins.left, 9, 0.01, 'left margin');
  approx(layout.margins.right, 9, 0.01, 'right margin');
  approx(layout.margins.top, 10.5, 0.01, 'top margin');
  approx(layout.margins.bottom, 10.5, 0.01, 'bottom margin');
  approx(layout.gridWidthMm, 279, 0.01, 'grid width');
  approx(layout.gridHeightMm, 189, 0.01, 'grid height');

  // Exact slot coordinates (the values the PDF draws).
  const first = layout.slots[0];
  approx(first.x, 9, 0.01, 'slot 0 x');
  approx(first.y, 10.5, 0.01, 'slot 0 y');
  const last = layout.slots[8];
  approx(last.x, 9 + 2 * (89 + 6), 0.01, 'slot 8 x');
  approx(last.y, 10.5 + 2 * (59 + 6), 0.01, 'slot 8 y');

  // Nothing may leave the page, and the exact fit must not crop.
  let cropped = 0;
  let offPage = 0;
  for (const slot of layout.slots) {
    const img = slotImageBox(layout, slot);
    if (img.x < -0.01 || img.y < -0.01 || img.x + img.width > layout.pageWidthMm + 0.01 || img.y + img.height > layout.pageHeightMm + 0.01) {
      offPage++;
    }
    if (img.cropped) cropped++;
  }
  ok(offPage === 0, `no slot image leaves the page (off: ${offPage})`);
  ok(cropped === 0, `exact fit never crops (cropped: ${cropped})`);

  // Crop marks: two edges (left/right) per column/row boundary => 2*(3+3) edges
  // x 2 ticks = 16.
  ok(layout.cropMarks.length === 16, `16 crop marks, got ${layout.cropMarks.length}`);
  console.log(`   page ${layout.pageWidthMm}x${layout.pageHeightMm} mm, ${layout.stickersPerPage} slots, margins ${layout.margins.left}/${layout.margins.top} mm`);
}

// ── 2. 92 x 70 mm overflows and is blocked ───────────────────────────────────
console.log('2. Landscape 3x3 @ 92x70 mm must be blocked');
{
  const layout = computeStickerLayout({ ...base, stickerWidthMm: 92, stickerHeightMm: 70 });
  ok(!layout.fits, 'layout must not fit');
  ok(layout.errors.length > 0, 'at least one error');
  ok(/wide|tall|margin/i.test(layout.errors.join(' ')), `error mentions the overflow/margin: ${layout.errors.join(' | ')}`);
  console.log(`   errors: ${layout.errors.join(' | ')}`);
}

// ── 3. Regression: the actual bad template (portrait, 6 x 70.2 mm) ───────────
console.log('3. Regression guard — old portrait 6 x 70.2 mm config');
{
  const layout = computeStickerLayout({
    orientation: 'portrait',
    columns: 6,
    rows: 9,
    stickerWidthMm: 70.2,
    stickerHeightMm: 25,
    gapXMm: 0,
    gapYMm: 0,
    autoCenter: true,
  });
  ok(layout.pageWidthMm === A4_PORTRAIT_MM.width, 'portrait width 210');
  ok(layout.gridWidthMm > layout.pageWidthMm, 'grid is wider than the page (the original bug)');
  ok(!layout.fits, 'the original bad layout no longer silently passes');
  ok(layout.errors.length > 0, 'it produces an error');
  console.log(`   grid ${layout.gridWidthMm.toFixed(1)} mm vs page ${layout.pageWidthMm} mm -> ${layout.errors.length} error(s)`);
}

// ── 4. Auto-fit keeps the image aspect ratio and fits ────────────────────────
console.log('4. Auto-fit');
{
  const { widthMm, heightMm } = autoFitStickerSize({ ...base, stickerWidthMm: 1, stickerHeightMm: 1 });
  const aspect = widthMm / heightMm;
  approx(aspect, 1774 / 887, 0.05, 'auto-fit keeps the design aspect');
  const layout = computeStickerLayout({ ...base, stickerWidthMm: widthMm, stickerHeightMm: heightMm });
  ok(layout.fits, 'auto-fit result fits the page');
  ok(layout.margins.left >= MIN_PRINTABLE_MARGIN_MM - 0.01, `auto-fit keeps >= ${MIN_PRINTABLE_MARGIN_MM} mm margin`);
  console.log(`   auto-fit -> ${widthMm} x ${heightMm} mm (aspect ${aspect.toFixed(3)})`);
}

// ── 5. Fit modes behave exactly as described ─────────────────────────────────
console.log('5. Image fit modes');
{
  const layoutExact = computeStickerLayout({ ...base, fitMode: 'exact' });
  const imgExact = slotImageBox(layoutExact, layoutExact.slots[0]);
  ok(!imgExact.cropped, 'exact: not cropped');
  approx(imgExact.width, 89 + 2 * layoutExact.imageInset.left, 0.01, 'exact: fills the slot + bleed (stretch)');
  approx(imgExact.height, 59 + 2 * layoutExact.imageInset.top, 0.01, 'exact: fills the slot + bleed (stretch)');

  const layoutCover = computeStickerLayout({ ...base, fitMode: 'cover' });
  const imgCover = slotImageBox(layoutCover, layoutCover.slots[0]);
  ok(imgCover.cropped, 'cover: cropped because the aspects differ');
  approx(imgCover.width / imgCover.height, 1774 / 887, 0.02, 'cover: preserves the image aspect');

  const layoutContain = computeStickerLayout({ ...base, fitMode: 'contain' });
  const imgContain = slotImageBox(layoutContain, layoutContain.slots[0]);
  ok(!imgContain.cropped, 'contain: not cropped');
  approx(imgContain.width / imgContain.height, 1774 / 887, 0.02, 'contain: preserves the image aspect');
  ok(
    imgContain.width <= 91.01 && imgContain.height <= 61.01,
    'contain: fits inside the slot + bleed box'
  );
}

// ── 6. The real PDF: landscape A4, right page count, and slot coords ─────────
console.log('6. Real PDF matches the layout');
await (async () => {
  const template = normalizeTemplate({
    id: 'test-template',
    preset_key: 'test',
    preset_name: 'Test',
    is_active: true,
    ...DEFAULT_STICKER_TEMPLATE,
    design: DEFAULT_STICKER_DESIGN,
  });

  const stickers = Array.from({ length: 30 }, (_, i) => ({
    registration_id: `r${i}`,
    vendor_id: `v${i}`,
    business_name: `Vendor ${i + 1} Ltd`,
    ticket_number: i + 1,
    table_number: (i % 3) + 1,
  }));

  const bytes = await renderStickerPdf({ template, stickers });
  ok(bytes.length > 0, 'PDF bytes produced');

  const doc = await PDFDocument.load(bytes);
  const layout = computeStickerLayout(base);
  const pages = doc.getPageCount();
  const expectedPages = Math.ceil(30 / layout.stickersPerPage);
  ok(pages === expectedPages, `PDF page count ${pages} === ceil(30/${layout.stickersPerPage}) = ${expectedPages}`);

  const { width, height } = doc.getPage(0).getSize();
  approx(width / 2.83465, 297, 0.5, 'PDF page width is 297 mm');
  approx(height / 2.83465, 210, 0.5, 'PDF page height is 210 mm');

  // The exact rectangles the PDF draws images into are slotImageBox() outputs.
  // Prove they equal the layout slots inflated by the (clamped) bleed.
  const inset = layout.imageInset;
  let mismatches = 0;
  layout.slots.forEach((slot) => {
    const img = slotImageBox(layout, slot);
    if (
      !CLOSE(img.x, slot.x - inset.left) ||
      !CLOSE(img.y, slot.y - inset.top) ||
      !CLOSE(img.width, slot.width + inset.left + inset.right) ||
      !CLOSE(img.height, slot.height + inset.top + inset.bottom)
    ) {
      mismatches++;
    }
  });
  ok(mismatches === 0, `all ${layout.slots.length} slot image boxes follow the layout (mismatches: ${mismatches})`);
  console.log(`   PDF: ${pages} pages, ${(width / 2.83465).toFixed(0)}x${(height / 2.83465).toFixed(0)} mm, 30 stickers = ${expectedPages} pages`);
})();

// ── 7. Source guards: no duplicated layout maths ─────────────────────────────
console.log('7. Source guards');
{
  const pdfSrc = fs.readFileSync(path.join(ROOT, 'src/lib/stickers/pdf.ts'), 'utf8');
  ok(pdfSrc.includes('computeStickerLayout'), 'pdf.ts uses computeStickerLayout');
  ok(pdfSrc.includes('slotImageBox'), 'pdf.ts uses slotImageBox');
  ok(!/Math\.max\(\s*box\.width\s*\/\s*imgW/.test(pdfSrc), 'pdf.ts no longer has its own cover-fit maths');
  ok(!/gridSizeMm|effectiveMarginsMm/.test(pdfSrc), 'pdf.ts no longer computes margins itself');

  const previewSrc = fs.readFileSync(path.join(ROOT, 'src/components/settings/StickerPagePreview.tsx'), 'utf8');
  ok(previewSrc.includes('computeStickerLayout'), 'preview uses computeStickerLayout');
  ok(previewSrc.includes('slotImageBox'), 'preview uses slotImageBox');

  const geometrySrc = fs.readFileSync(path.join(ROOT, 'src/lib/stickers/geometry.ts'), 'utf8');
  ok(geometrySrc.includes('computeStickerLayout'), 'geometry.ts delegates to computeStickerLayout');
}

console.log(`\n${checks - failures}/${checks} checks passed\n`);
if (failures > 0) {
  console.error(`${failures} check(s) failed.`);
  process.exit(1);
}
