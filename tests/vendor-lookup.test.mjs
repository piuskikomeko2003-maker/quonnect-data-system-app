// Unit tests for vendor phone matching used by survey auto-fill.
//
//   npm run test:vendor-lookup
//
// Paid vendors are stored with inconsistent phone formats (0746..., 746...,
// +256746...). A collector typing any of those must still match the same
// vendor, otherwise the survey is treated as a brand-new vendor.

import test from 'node:test';
import assert from 'node:assert/strict';
import { phoneVariants, normalizePhone } from '../src/lib/vendorLookup.ts';

test('normalizes Ugandan local numbers with a leading zero', () => {
  assert.equal(normalizePhone('0746057672'), '0746057672');
});

test('normalizes numbers stored without the leading zero', () => {
  assert.equal(normalizePhone('746057672'), '0746057672');
});

test('normalizes country-code formats', () => {
  assert.equal(normalizePhone('+256746057672'), '0746057672');
  assert.equal(normalizePhone('256 746 057 672'), '0746057672');
});

test('normalizes pasted numbers with spaces and punctuation', () => {
  assert.equal(normalizePhone('0746-057-672'), '0746057672');
  assert.equal(normalizePhone('(0746) 057 672'), '0746057672');
});

test('returns every format a stored vendor phone might use', () => {
  const variants = phoneVariants('+256746057672');
  for (const expected of [
    '0746057672',
    '746057672',
    '256746057672',
    '+256746057672',
  ]) {
    assert.ok(variants.includes(expected), `missing ${expected} in ${variants.join(', ')}`);
  }
});

test('keeps unmatched numbers as digits instead of inventing a local number', () => {
  assert.equal(normalizePhone('12345'), '12345');
  assert.deepEqual(phoneVariants(''), []);
});
