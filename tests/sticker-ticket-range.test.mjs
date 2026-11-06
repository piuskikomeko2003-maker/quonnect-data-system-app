// Regression tests for ticket-number ranges in sticker printing.
//
//   npm run test:sticker-range
//
// The old print flow treated "start position" as a row/slot offset and the
// number box as a sticker count. That made "tickets 100 to 200" pick whatever
// happened to sit at those positions. These tests pin the range to the actual
// ticket number value, applied BEFORE multi-table expansion.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  filterVendorsByTicketRange,
  normalizeTicketRange,
  selectBatch,
  sortVendorsByTicket,
  summarizeTicketRange,
  ticketNumberValue,
} from '../src/lib/stickers/layout.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

function vendor(ticket, overrides = {}) {
  return {
    registration_id: `reg-${ticket}`,
    ticket_id: `ticket-${ticket}`,
    edition_day_id: 'day-1',
    vendor_id: `vendor-${ticket}`,
    business_name: `Vendor ${ticket}`,
    ticket_number: ticket,
    tables: 1,
    stickers_printed: 0,
    ...overrides,
  };
}

const range = (from, to) => ({ from, to });
const ticketsOf = (selection) => [
  ...new Set(selection.stickers.map((sticker) => sticker.ticket_number)),
];

test('range 1 to 100 prints tickets 1 to 100 only', () => {
  const vendors = Array.from({ length: 250 }, (_, i) => vendor(i + 1));
  const selection = selectBatch(vendors, 9, {
    mode: 'all',
    ticketRange: range(1, 100),
  });

  assert.deepEqual(ticketsOf(selection), Array.from({ length: 100 }, (_, i) => i + 1));
  assert.equal(selection.stickers[0].ticket_number, 1);
  assert.equal(selection.stickers.at(-1).ticket_number, 100);
  assert.equal(selection.stickerCount, 100);
  assert.equal(selection.ticketCount, 100);
  assert.ok(selection.stickers.every((s) => s.ticket_number >= 1 && s.ticket_number <= 100));
});

test('range 100 to 200 starts at 100 and ends at 200 with nothing before 100', () => {
  const vendors = Array.from({ length: 250 }, (_, i) => vendor(i + 1));
  const selection = selectBatch(vendors, 9, {
    mode: 'all',
    ticketRange: range(100, 200),
  });

  assert.equal(selection.stickers[0].ticket_number, 100);
  assert.equal(selection.stickers.at(-1).ticket_number, 200);
  assert.deepEqual(ticketsOf(selection), Array.from({ length: 101 }, (_, i) => i + 100));
  assert.equal(selection.stickerCount, 101);
  assert.ok(selection.stickers.every((s) => s.ticket_number >= 100));
  assert.ok(!selection.stickers.some((s) => s.ticket_number === 99));
});

test('a 3-table ticket gives 3 stickers without changing ticket membership', () => {
  const vendors = [
    vendor(100),
    vendor(101, { tables: 3 }),
    vendor(102),
    vendor(103, { tables: 2 }),
  ];

  const selection = selectBatch(vendors, 9, {
    mode: 'all',
    ticketRange: range(100, 102),
  });

  assert.deepEqual(ticketsOf(selection), [100, 101, 102]);
  assert.equal(selection.stickerCount, 5); // 1 + 3 + 1
  assert.equal(selection.ticketCount, 3);

  const ticket101Tables = selection.stickers
    .filter((s) => s.ticket_number === 101)
    .map((s) => s.table_number);
  assert.deepEqual(ticket101Tables, [1, 2, 3]);

  // Stickers stay in ticket order: 100 Table 1, 101 Tables 1-3, 102 Table 1.
  assert.deepEqual(
    selection.stickers.map((s) => `${s.ticket_number}:${s.table_number}`),
    ['100:1', '101:1', '101:2', '101:3', '102:1']
  );
  assert.ok(!selection.stickers.some((s) => s.ticket_number === 103));
});

test('an explicit range includes tickets already marked printed', () => {
  // Reproduces the real bug: tickets 1-83 were confirmed by an earlier batch,
  // so a "remaining only" selection returned just 84-100 (17 stickers).
  const vendors = Array.from({ length: 100 }, (_, i) =>
    vendor(i + 1, i + 1 <= 83 ? { stickers_printed: 1 } : {})
  );

  const selection = selectBatch(vendors, 9, {
    mode: 'all',
    ticketRange: range(1, 100),
  });

  assert.deepEqual(ticketsOf(selection), Array.from({ length: 100 }, (_, i) => i + 1));
  assert.equal(selection.ticketCount, 100);
  assert.equal(selection.stickerCount, 100);
  assert.equal(selection.reprintStickerCount, 83);
  assert.equal(selection.includePrinted, true);
});

test('explicit range reprints every table of a partly printed vendor', () => {
  const vendors = [vendor(101, { tables: 3, stickers_printed: 2 })];
  const selection = selectBatch(vendors, 9, {
    mode: 'all',
    ticketRange: range(101, 101),
  });

  assert.deepEqual(
    selection.stickers.map((s) => s.table_number),
    [1, 2, 3]
  );
  assert.equal(selection.stickerCount, 3);
  assert.equal(selection.reprintStickerCount, 2);
});

test('range 5 to 5 prints only ticket 5', () => {
  const vendors = Array.from({ length: 20 }, (_, i) => vendor(i + 1));
  const selection = selectBatch(vendors, 9, {
    mode: 'all',
    ticketRange: range(5, 5),
  });

  assert.deepEqual(ticketsOf(selection), [5]);
  assert.deepEqual(selection.stickers.map((s) => s.ticket_number), [5]);
  assert.equal(selection.stickerCount, 1);
  assert.equal(selection.ticketCount, 1);
});

test('9 stickers per page; a short last page is allowed, no mid-page gaps', () => {
  const vendors = Array.from({ length: 10 }, (_, i) => vendor(i + 1));
  const selection = selectBatch(vendors, 9, {
    mode: 'all',
    ticketRange: range(1, 10),
  });

  assert.equal(selection.slotsPerPage, 9);
  assert.equal(selection.stickerCount, 10);
  assert.equal(selection.pages, 2);
  assert.equal(selection.leadingBlankSlots, 0);
  assert.equal(selection.emptySlots, 8);
  // The second page only pads the END; stickers themselves are contiguous.
  assert.deepEqual(
    selection.stickers.map((s) => s.ticket_number),
    Array.from({ length: 10 }, (_, i) => i + 1)
  );
});

test('text ticket numbers compare numerically, not lexicographically', () => {
  const vendors = [vendor('Ticket 100'), vendor('Ticket 9'), vendor('084')];
  const sorted = sortVendorsByTicket(vendors);

  assert.deepEqual(
    sorted.map((v) => v.ticket_number),
    ['Ticket 9', '084', 'Ticket 100']
  );
  assert.equal(ticketNumberValue('Ticket 084'), 84);
  assert.equal(ticketNumberValue(null), null);
  assert.equal(ticketNumberValue('no digits'), null);
});

test('filter keeps only in-range rows and never mutates the input', () => {
  const vendors = [vendor(1), vendor(99), vendor(100), vendor(200), vendor(201)];
  const filtered = filterVendorsByTicketRange(vendors, range(100, 200));

  assert.deepEqual(filtered.map((v) => v.ticket_number), [100, 200]);
  assert.equal(vendors.length, 5);
});

test('summary reports tickets, stickers and missing ticket numbers', () => {
  const vendors = [
    vendor(1),
    vendor(2, { tables: 3 }),
    vendor(4),
    vendor(6),
  ];
  const summary = summarizeTicketRange(vendors, range(1, 6));

  assert.equal(summary.from, 1);
  assert.equal(summary.to, 6);
  assert.equal(summary.ticketCount, 4);
  assert.equal(summary.stickerCount, 6); // 1 + 3 + 1 + 1
  assert.equal(summary.reprintStickerCount, 0);
  assert.deepEqual(summary.missingTickets, [3, 5]);
});

test('summary counts already-printed stickers as reprints', () => {
  const vendors = [
    vendor(1, { stickers_printed: 1 }),
    vendor(2, { tables: 3, stickers_printed: 2 }),
  ];
  const summary = summarizeTicketRange(vendors, range(1, 2));

  assert.equal(summary.ticketCount, 2);
  assert.equal(summary.stickerCount, 4); // 1 + 3 tables
  assert.equal(summary.reprintStickerCount, 3); // 1 + 2 already printed
  assert.deepEqual(summary.missingTickets, []);
});

test('normalizes range input and rejects empty/incomplete bounds', () => {
  assert.deepEqual(normalizeTicketRange('100', '200'), range(100, 200));
  assert.deepEqual(normalizeTicketRange('200', '100'), range(100, 200));
  assert.equal(normalizeTicketRange('', ''), null);
  assert.equal(normalizeTicketRange('100', ''), null);
  assert.equal(normalizeTicketRange('abc', '200'), null);
});

test('server filters the range on ticket_number with gte/lte, not offset', () => {
  const serverSrc = fs.readFileSync(path.join(ROOT, 'src/lib/stickers/server.ts'), 'utf8');
  assert.match(serverSrc, /\.gte\('ticket_number',\s*ticketRange\.from\)/);
  assert.match(serverSrc, /\.lte\('ticket_number',\s*ticketRange\.to\)/);
});
