// Unit tests for the ticket download/prefetch helpers.
//
//   npm run test:tickets
//
// Runs in plain Node via the same TypeScript loader as the sticker tests.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTicketsPdf,
  clearTicketBlobCache,
  getTicketBlob,
  ticketCacheKey,
  ticketFileStem,
  ticketPngFilename,
  ticketRenderUrl,
} from '../src/lib/tickets/download.ts';

// 1x1 transparent PNG — enough for pdf-lib to embed as a real image.
const TINY_PNG = Uint8Array.from(
  Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64'
  )
);

const ticket = (overrides = {}) => ({
  ticketId: 'ticket-1',
  dayId: 'day-2',
  dayNumber: 2,
  dayLabel: 'Day 2',
  dayDate: '2026-12-02',
  ticketNumber: 14,
  ticketCode: '014',
  editionName: 'December Market — Day 2',
  vendorName: 'Ada Crafts',
  businessName: 'Ada Crafts Ltd',
  phone: '+256700000000',
  category: 'Crafts',
  registeredAt: '2026-11-01T09:00:00.000Z',
  ...overrides,
});

function pngResponse() {
  return {
    ok: true,
    status: 200,
    blob: async () => new Blob([TINY_PNG], { type: 'image/png' }),
  };
}

test('render URL carries the ticket id and day context', () => {
  const url = new URL(ticketRenderUrl(ticket(), 'edition-1'), 'https://app.test');
  assert.equal(url.pathname, '/api/tickets/render');
  assert.equal(url.searchParams.get('ticket_id'), 'ticket-1');
  assert.equal(url.searchParams.get('edition_day_id'), 'day-2');
  assert.equal(url.searchParams.get('ticket_number'), '014');
  assert.equal(url.searchParams.get('day_label'), 'Day 2');
  assert.equal(url.searchParams.get('edition_id'), 'edition-1');
});

test('filenames are unique per day even when day counters restart at 1', () => {
  const day1 = ticketFileStem(ticket({ ticketId: 'a', dayId: 'd1', dayLabel: 'Day 1', ticketCode: '001' }));
  const day2 = ticketFileStem(ticket({ ticketId: 'b', dayId: 'd2', dayLabel: 'Day 2', ticketCode: '001' }));
  assert.equal(day1, 'Vendor-Pass-Day-1-001');
  assert.equal(day2, 'Vendor-Pass-Day-2-001');
});

test('multi-day download names include each day and its own ticket code', () => {
  const day1 = ticket({ dayId: 'd1', dayNumber: 1, dayLabel: 'Day 1', ticketCode: '011' });
  const day2 = ticket({ dayId: 'd2', dayNumber: 2, dayLabel: 'Day 2', ticketCode: '008' });
  assert.equal(ticketPngFilename(day1, 0), 'quonnect-ticket-day1-011.png');
  assert.equal(ticketPngFilename(day2, 1), 'quonnect-ticket-day2-008.png');
});

test('filename day is inferred from the label when dayNumber is missing', () => {
  const day2 = ticket({ dayNumber: undefined, dayLabel: '2nd Day Pass', ticketCode: '008' });
  assert.equal(ticketPngFilename(day2, 1), 'quonnect-ticket-day2-008.png');
});

test('concurrent downloads of the same pass share one render request', async () => {
  clearTicketBlobCache();
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    return pngResponse();
  };

  const [first, second] = await Promise.all([
    getTicketBlob(ticket(), 'edition-1', { fetcher }),
    getTicketBlob(ticket(), 'edition-1', { fetcher }),
  ]);

  assert.equal(calls, 1);
  assert.equal(first, second);
});

test('failed renders are not cached, so a retry works', async () => {
  clearTicketBlobCache();
  let calls = 0;
  const fetcher = async () => {
    calls += 1;
    if (calls === 1) return { ok: false, status: 503, blob: async () => new Blob([]) };
    return pngResponse();
  };

  await assert.rejects(() => getTicketBlob(ticket(), 'edition-1', { fetcher }));
  const blob = await getTicketBlob(ticket(), 'edition-1', { fetcher });
  assert.equal(calls, 2);
  assert.equal(blob.type, 'image/png');
});

test('multi-day download builds one PDF with one page per pass', async () => {
  clearTicketBlobCache();
  const fetcher = async () => pngResponse();
  const tickets = [
    ticket({ ticketId: 't1', dayId: 'd1', dayLabel: 'Day 1', ticketCode: '001' }),
    ticket({ ticketId: 't2', dayId: 'd2', dayLabel: 'Day 2', ticketCode: '002' }),
  ];

  // Warm through the same fetcher the helper will use.
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetcher;
  try {
    const bytes = await buildTicketsPdf(tickets, 'edition-1');
    const { PDFDocument } = await import('pdf-lib');
    const pdf = await PDFDocument.load(bytes);
    assert.equal(pdf.getPageCount(), 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('cache key distinguishes days of the same ticket number', () => {
  const day1 = ticketCacheKey(ticket({ ticketId: undefined, dayId: 'd1', dayLabel: 'Day 1' }), 'edition-1');
  const day2 = ticketCacheKey(ticket({ ticketId: undefined, dayId: 'd2', dayLabel: 'Day 2' }), 'edition-1');
  assert.notEqual(day1, day2);
});
