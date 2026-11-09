// Unit tests for per-day table counts.
//
//   npm run test:vendor-tables
//
// A multi-day vendor can own different table counts on different days:
// 2 tables on Day 1, 3 tables on Day 2. The ticket row is the source of truth,
// and the registration-level count is only a legacy mirror.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_TABLES,
  MIN_TABLES,
  normalizeTables,
  tablesForDay,
  totalDayTables,
} from '../src/lib/vendorTables.ts';

test('normalizeTables clamps to the supported range', () => {
  assert.equal(normalizeTables(0), MIN_TABLES);
  assert.equal(normalizeTables(-3), MIN_TABLES);
  assert.equal(normalizeTables(99), MAX_TABLES);
  assert.equal(normalizeTables(3), 3);
  assert.equal(normalizeTables('4'), 4);
});

test('normalizeTables falls back to one for missing or invalid values', () => {
  assert.equal(normalizeTables(undefined), 1);
  assert.equal(normalizeTables(null), 1);
  assert.equal(normalizeTables(''), 1);
  assert.equal(normalizeTables('abc'), 1);
});

test('tablesForDay reads the ticket that belongs to the requested day', () => {
  const tickets = [
    { edition_day_id: 'day-1', tables: 2 },
    { edition_day_id: 'day-2', tables: 3 },
  ];
  assert.equal(tablesForDay(tickets, 'day-1'), 2);
  assert.equal(tablesForDay(tickets, 'day-2'), 3);
  assert.equal(tablesForDay(tickets, 'day-3'), null);
});

test('tablesForDay never returns an out-of-range count', () => {
  assert.equal(tablesForDay([{ edition_day_id: 'day-1', tables: 12 }], 'day-1'), MAX_TABLES);
  assert.equal(tablesForDay([{ edition_day_id: 'day-1', tables: 0 }], 'day-1'), MIN_TABLES);
});

test('totalDayTables adds every paid day', () => {
  assert.equal(
    totalDayTables(99, [
      { edition_day_id: 'day-1', tables: 2 },
      { edition_day_id: 'day-2', tables: 3 },
    ]),
    5
  );
});

test('totalDayTables falls back to the registration mirror without day tickets', () => {
  assert.equal(totalDayTables(4, []), 4);
  assert.equal(totalDayTables(undefined, null), 1);
});
