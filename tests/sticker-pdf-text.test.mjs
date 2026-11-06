// Regression tests for PDF text encoding.
//
//   npm run test:sticker-pdf-text
//
// pdf-lib's built-in Helvetica/Times/Courier fonts use WinAnsi encoding. A
// vendor name containing an emoji used to abort the whole range with:
//   WinAnsi cannot encode "🥰" (0x1f970)

import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { renderStickerPdf, sanitizePdfText } from '../src/lib/stickers/pdf.ts';
import {
  DEFAULT_STICKER_DESIGN,
  DEFAULT_STICKER_TEMPLATE,
  normalizeTemplate,
} from '../src/types/sticker.ts';

async function helvetica() {
  const pdf = await PDFDocument.create();
  return pdf.embedFont(StandardFonts.Helvetica);
}

test('drops emoji that WinAnsi cannot encode', async () => {
  const font = await helvetica();
  assert.equal(sanitizePdfText('Mama 🥰 Fresh  Foods', font), 'Mama Fresh Foods');
  assert.equal(sanitizePdfText('❤️ Hearts ❤️', font), 'Hearts');
  // The sanitized string must also be measurable/encodable.
  assert.doesNotThrow(() => font.widthOfTextAtSize('Mama Fresh Foods', 12));
});

test('keeps WinAnsi punctuation and accented letters', async () => {
  const font = await helvetica();
  assert.equal(sanitizePdfText('Café – “Fresh”…', font), 'Café – “Fresh”…');
});

test('falls back to ASCII for unsupported symbols', async () => {
  const font = await helvetica();
  assert.equal(sanitizePdfText('Go → Now', font), 'Go -> Now');
  assert.equal(sanitizePdfText('Price ₹500', font), 'Price ?500');
});

test('renders a sticker PDF when a vendor name contains an emoji', async () => {
  const template = normalizeTemplate({
    id: 'test-template',
    preset_key: 'test',
    preset_name: 'Test',
    is_active: true,
    ...DEFAULT_STICKER_TEMPLATE,
    design: DEFAULT_STICKER_DESIGN,
  });

  const stickers = [
    {
      registration_id: 'reg-201',
      vendor_id: 'vendor-201',
      business_name: 'Mama 🥰 Fresh Foods',
      ticket_number: 201,
      table_number: 1,
    },
    {
      registration_id: 'reg-202',
      vendor_id: 'vendor-202',
      business_name: 'Nakato ❤️ Crafts',
      ticket_number: 202,
      table_number: 2,
    },
  ];

  const bytes = await renderStickerPdf({ template, stickers });
  assert.ok(bytes.length > 0);

  const doc = await PDFDocument.load(bytes);
  assert.ok(doc.getPageCount() >= 1);
});
