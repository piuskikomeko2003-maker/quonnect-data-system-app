// Regression tests for reusing a previous sticker template's layout/typography.
//
//   npm run test:sticker-reuse
//
// Operators often reuse the same sticker design across editions and only swap
// the artwork. They should be able to copy field positions, typography and page
// geometry from an existing template without inheriting its image file.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyReusableSettings,
  reusableSettingsFromTemplate,
} from '../src/lib/stickers/reuse.ts';
import { DEFAULT_STICKER_DESIGN, DEFAULT_STICKER_TEMPLATE } from '../src/types/sticker.ts';

function template(overrides = {}) {
  return {
    id: 'source-template',
    preset_key: 'source',
    preset_name: 'Source design',
    ...DEFAULT_STICKER_TEMPLATE,
    ...overrides,
    design: overrides.design ?? { ...DEFAULT_STICKER_DESIGN },
  };
}

function currentDraft(overrides = {}) {
  return {
    ...DEFAULT_STICKER_TEMPLATE,
    edition_id: 'edition-2',
    edition_day_id: 'day-2',
    image_path: 'artwork/new-sticker.png',
    image_width_px: 1200,
    image_height_px: 800,
    ...overrides,
  };
}

test('copies layout, typography and font sizes from the previous template', () => {
  const source = template({
    orientation: 'portrait',
    page_width_mm: 210,
    page_height_mm: 297,
    columns: 2,
    rows: 4,
    sticker_width_mm: 92.5,
    sticker_height_mm: 61.25,
    gap_x_mm: 3,
    gap_y_mm: 4,
    inner_padding_mm: 5,
    bleed_mm: 2,
    fit_mode: 'contain',
    auto_center: false,
    cut_lines: true,
    lock_aspect: false,
    business_font_size: 18,
    ticket_font_size: 12,
    table_font_size: 22,
    design: {
      ...DEFAULT_STICKER_DESIGN,
      business_name: {
        ...DEFAULT_STICKER_DESIGN.business_name,
        fontFamily: 'times',
        fontSizePct: 41,
        x: 12,
        y: 14,
        bold: false,
      },
    },
  });

  const result = applyReusableSettings(currentDraft(), source);

  assert.equal(result.orientation, 'portrait');
  assert.equal(result.page_width_mm, 210);
  assert.equal(result.page_height_mm, 297);
  assert.equal(result.columns, 2);
  assert.equal(result.rows, 4);
  assert.equal(result.sticker_width_mm, 92.5);
  assert.equal(result.sticker_height_mm, 61.25);
  assert.equal(result.gap_x_mm, 3);
  assert.equal(result.gap_y_mm, 4);
  assert.equal(result.inner_padding_mm, 5);
  assert.equal(result.bleed_mm, 2);
  assert.equal(result.fit_mode, 'contain');
  assert.equal(result.auto_center, false);
  assert.equal(result.cut_lines, true);
  assert.equal(result.lock_aspect, false);
  assert.equal(result.business_font_size, 18);
  assert.equal(result.ticket_font_size, 12);
  assert.equal(result.table_font_size, 22);
  assert.equal(result.design.business_name.fontFamily, 'times');
  assert.equal(result.design.business_name.fontSizePct, 41);
  assert.equal(result.design.business_name.x, 12);
  assert.equal(result.design.business_name.y, 14);
  assert.equal(result.design.business_name.bold, false);
});

test('keeps the current artwork image and edition/day scope', () => {
  const source = template({
    edition_id: 'edition-1',
    edition_day_id: 'day-1',
    image_path: 'artwork/source-sticker.png',
    image_width_px: 640,
    image_height_px: 480,
  });

  const result = applyReusableSettings(currentDraft(), source);

  assert.equal(result.image_path, 'artwork/new-sticker.png');
  assert.equal(result.image_width_px, 1200);
  assert.equal(result.image_height_px, 800);
  assert.equal(result.edition_id, 'edition-2');
  assert.equal(result.edition_day_id, 'day-2');
});

test('design is deep-copied so editing the new template cannot mutate the source', () => {
  const source = template();
  const reusable = reusableSettingsFromTemplate(source);

  reusable.design.business_name.x = 99;
  reusable.design.table_label.fontSizePct = 88;

  assert.notEqual(source.design.business_name.x, 99);
  assert.notEqual(source.design.table_label.fontSizePct, 88);
});

test('partial or legacy source designs are normalised into a complete design', () => {
  const source = template({ design: { business_name: { x: 20, y: 10 } } });
  const reusable = reusableSettingsFromTemplate(source);

  assert.equal(reusable.design.business_name.x, 20);
  assert.equal(reusable.design.business_name.y, 10);
  // Missing fields still have usable defaults instead of becoming undefined.
  assert.equal(typeof reusable.design.ticket_number.fontSizePct, 'number');
  assert.equal(typeof reusable.design.table_label.width, 'number');
});
