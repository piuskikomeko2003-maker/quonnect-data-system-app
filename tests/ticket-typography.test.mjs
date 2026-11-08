// Unit tests for the shared ticket typography rules.
//
//   npm run test:typography
//
// The designer preview, the client pass card and the server PNG renderer all
// use these helpers, so these assertions protect "preview === download".

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TICKET_DEFAULT_FONT_SIZE,
  TICKET_FONT_FAMILY,
  TICKET_FONT_FAMILY_CSS,
  TICKET_LINE_HEIGHT,
  resolveTicketFontSize,
  resolveTicketFontWeight,
} from '../src/lib/tickets/typography.ts';

test('font size is fixed per field regardless of content length', () => {
  const pos = { fontSize: 24 };
  assert.equal(resolveTicketFontSize(pos), 24);
  // The old adaptive logic shrank long names; that caused vendors' passes to
  // use different sizes. Sizing must never depend on the text.
  assert.equal(resolveTicketFontSize(pos), resolveTicketFontSize(pos));
});

test('missing or invalid font sizes fall back to the shared default', () => {
  assert.equal(resolveTicketFontSize(undefined), TICKET_DEFAULT_FONT_SIZE);
  assert.equal(resolveTicketFontSize(null), TICKET_DEFAULT_FONT_SIZE);
  assert.equal(resolveTicketFontSize({}), TICKET_DEFAULT_FONT_SIZE);
  assert.equal(resolveTicketFontSize({ fontSize: 0 }), TICKET_DEFAULT_FONT_SIZE);
  assert.equal(resolveTicketFontSize({ fontSize: Number.NaN }), TICKET_DEFAULT_FONT_SIZE);
});

test('every supported weight form maps to the same numeric weight', () => {
  assert.equal(resolveTicketFontWeight('normal'), 400);
  assert.equal(resolveTicketFontWeight('medium'), 500);
  assert.equal(resolveTicketFontWeight('500'), 500);
  assert.equal(resolveTicketFontWeight('semibold'), 600);
  assert.equal(resolveTicketFontWeight('600'), 600);
  assert.equal(resolveTicketFontWeight('bold'), 700);
  assert.equal(resolveTicketFontWeight('700'), 700);
  assert.equal(resolveTicketFontWeight(undefined), 400);
});

test('preview and renderer share one font family and line height', () => {
  assert.equal(TICKET_FONT_FAMILY, 'Geist');
  assert.match(TICKET_FONT_FAMILY_CSS, /^Geist,/);
  assert.equal(TICKET_LINE_HEIGHT, 1.25);
});
