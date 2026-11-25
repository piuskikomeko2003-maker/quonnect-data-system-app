// Regression tests for voiding paid vendor registrations instead of deleting.
//
//   npm run test:vendor-voiding
//
// Deleting a paid registration cascaded to its vendor_tickets rows, but the
// ticket counters never move backwards. The result was permanent gaps such as
// "ticket 005 is missing" even though the vendor had registered successfully.
// These tests pin the safe path: void + audit, never hard-delete paid rows.

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');

const read = (relative) => fs.readFileSync(path.join(ROOT, relative), 'utf8');

test('migration adds void metadata, audit table and a delete guard', () => {
  const sql = read('supabase/migrations/add_vendor_registration_voiding.sql');

  assert.match(sql, /ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS public\.vendor_registration_audit/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.void_vendor_registration/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION public\.prevent_paid_registration_hard_delete/);
  assert.match(sql, /OLD\.payment_status IN \('paid', 'voided'\)/);
  assert.match(sql, /Void it instead so its ticket numbers stay accountable/);
});

test('void API calls the server-only RPC and exposes the audit log', () => {
  const route = read('src/app/api/vendors/registrations/void/route.ts');

  assert.match(route, /rpc\('void_vendor_registration'/);
  assert.match(route, /p_performed_by: auth\.user\?\.id \?\? null/);
  assert.match(route, /vendor_registration_audit/);
  assert.match(route, /requireAdmin\(\)/);
});

test('paid vendor action voids instead of deleting the registration', () => {
  const page = read('src/app/page.tsx');

  assert.match(page, /handleVoidPaidVendor/);
  assert.match(page, /\/api\/vendors\/registrations\/void/);
  assert.doesNotMatch(page, /handleDeletePaidVendor/);
  // The delete-vendor path must refuse paid registrations before deleting.
  assert.match(page, /has paid registration records\. Deleting the vendor is blocked/);
});

test('voided rows are hidden from paid lists and the paid total', () => {
  const page = read('src/app/page.tsx');
  assert.match(page, /r\.payment_status !== 'voided'/);
  assert.match(page, /\.neq\('payment_status', 'voided'\)/);

  const finance = read('src/app/api/finance/summary/route.ts');
  assert.match(finance, /\.neq\('payment_status', 'voided'\)/);
});

test('ticket rendering rejects voided registrations', () => {
  const route = read('src/app/api/tickets/render/route.tsx');
  const matches = route.match(/payment_status === 'voided'/g) || [];
  assert.ok(matches.length >= 2, 'both token and ticket-id paths must reject voided rows');
});

test('legacy ticket allocation uses max+1, never a row count', () => {
  const api = read('src/app/api/collect/paid-register/route.ts');
  const lib = read('src/lib/paidRegistration.ts');

  for (const source of [api, lib]) {
    assert.match(source, /order\('ticket_number', \{ ascending: false \}\)/);
    assert.match(source, /Number\(highestRows\?\.\[0\]\?\.ticket_number \|\| 0\) \+ 1/);
    assert.doesNotMatch(source, /\(earlierCount \|\| 0\) \+ 1/);
  }
});
