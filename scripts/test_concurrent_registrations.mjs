/**
 * Paid-vendor ticket concurrency test.
 *
 * Exercises the REAL production allocation path: the `register_paid_vendor`
 * Postgres function (per-edition advisory lock + monotonic ticket counter).
 * No client-side mutex is used, so this faithfully reproduces 500+ vendors
 * hitting different editions/regions at once.
 *
 * Creates temporary editions/links/vendors, verifies, then cleans everything up.
 *
 * Usage: node scripts/test_concurrent_registrations.mjs [totalVendors] [concurrency]
 */
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach((line) => {
  const idx = line.indexOf('=');
  if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TOTAL = Number(process.argv[2] || 500);
const CONCURRENCY = Number(process.argv[3] || 40);
const TAG = `loadtest-${Date.now()}`;
const created = { editions: [], links: [], vendors: [], regs: [], counters: [] };

async function mapConcurrent(items, concurrency, fn) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

async function makeTempEdition(regionId, suffix) {
  const { data, error } = await supabase
    .from('market_days')
    .insert({
      region_id: regionId,
      name: `${TAG} ${suffix}`,
      slug: `${TAG}-${suffix}`,
      event_date: new Date().toISOString().slice(0, 10),
      status: 'upcoming',
    })
    .select('id, name')
    .single();
  if (error) throw error;
  created.editions.push(data.id);
  return data;
}

async function register(token, edition, index) {
  const phone = `+2567${String(Date.now()).slice(-6)}${String(index).padStart(3, '0')}`;
  const { data, error } = await supabase.rpc('register_paid_vendor', {
    p_token: token,
    p_edition_id: edition.id,
    p_phone: phone,
    p_contact_name: `Scale Vendor ${index}`,
    p_business_name: `Scale Vendor ${index} Crafts`,
    p_category: 'Crafts',
    p_email: '',
    p_amount_paid: 20000,
    p_payment_status: 'paid',
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  created.vendors.push(phone);
  created.regs.push({ editionId: edition.id, phone });
  return { index, row, phone, token };
}

async function cleanup() {
  console.log('\nCleaning up test data...');
  for (const editionId of created.editions) {
    const { data: regs } = await supabase
      .from('vendor_registrations')
      .select('vendor_id')
      .eq('market_day_id', editionId);
    const vendorIds = [...new Set((regs || []).map((r) => r.vendor_id))];
    if (vendorIds.length) {
      await supabase.from('vendor_registrations').delete().eq('market_day_id', editionId);
      await supabase.from('vendors').delete().in('id', vendorIds);
    }
    await supabase.from('form_links').delete().eq('edition_id', editionId);
    await supabase.from('edition_ticket_counters').delete().eq('edition_id', editionId);
    await supabase.from('market_days').delete().eq('id', editionId);
  }
  console.log('Cleanup complete.');
}

async function main() {
  console.log(`\n======================================================`);
  console.log(`PAID VENDOR SCALE TEST — ${TOTAL} vendors, concurrency ${CONCURRENCY}`);
  console.log(`======================================================`);

  const { data: regions } = await supabase.from('regions').select('id, name').limit(2);
  if (!regions || regions.length === 0) throw new Error('No regions found to attach test editions.');
  const regionA = regions[0];
  const regionB = regions[1] || regions[0];
  console.log(`Regions: A=${regionA.name}${regionB.id !== regionA.id ? ` B=${regionB.name}` : ''}`);

  const editionA = await makeTempEdition(regionA.id, 'A');
  const editionB = await makeTempEdition(regionB.id, 'B');
  console.log(`Editions: A=${editionA.id} B=${editionB.id}`);

  const half = Math.ceil(TOTAL / 2);
  const tokensA = [];
  const tokensB = [];
  const links = [];
  for (let i = 0; i < TOTAL; i++) {
    const token = `${TAG}-${i}-${Math.random().toString(36).slice(2, 8)}`;
    const edition = i < half ? editionA : editionB;
    (i < half ? tokensA : tokensB).push(token);
    links.push({ token, form_slug: 'paid_vendor_registration', edition_id: edition.id, expires_at: null });
  }
  for (let c = 0; c < links.length; c += 100) {
    const { error } = await supabase.from('form_links').insert(links.slice(c, c + 100));
    if (error) throw error;
  }
  created.links.push(...tokensA, ...tokensB);
  console.log(`Created ${TOTAL} single-use links across 2 editions.`);

  const jobs = [
    ...tokensA.map((t, i) => ({ token: t, edition: editionA, index: i + 1 })),
    ...tokensB.map((t, i) => ({ token: t, edition: editionB, index: half + i + 1 })),
  ];

  const start = Date.now();
  const results = await mapConcurrent(jobs, CONCURRENCY, (job) => register(job.token, job.edition, job.index));
  const elapsed = Date.now() - start;

  const numbersA = results.filter((r) => jobs[r.index - 1].edition.id === editionA.id).map((r) => Number(r.row.ticket_number));
  const numbersB = results.filter((r) => jobs[r.index - 1].edition.id === editionB.id).map((r) => Number(r.row.ticket_number));

  const fail = (msg) => {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  };

  console.log(`\nCompleted in ${(elapsed / 1000).toFixed(2)}s (${(TOTAL / (elapsed / 1000)).toFixed(1)}/s)`);

  const check = (label, nums) => {
    const uniq = new Set(nums);
    const sorted = [...nums].sort((a, b) => a - b);
    const sequential = sorted.every((n, i) => n === sorted[0] + i);
    console.log(`  ${label}: count=${nums.length} unique=${uniq.size} range=${sorted[0]}..${sorted[sorted.length - 1]} sequential=${sequential}`);
    if (uniq.size !== nums.length) fail(`${label} produced duplicate ticket numbers`);
    if (!sequential) fail(`${label} ticket numbers are not sequential`);
  };

  console.log('\nVerification:');
  check('Edition A', numbersA);
  check('Edition B', numbersB);

  // Idempotency: re-submitting an already-registered vendor returns the same ticket.
  const retryToken = jobs[0].token;
  const retryPhone = results[0].phone;
  const { data: retryData, error: retryErr } = await supabase.rpc('register_paid_vendor', {
    p_token: retryToken,
    p_edition_id: jobs[0].edition.id,
    p_phone: retryPhone,
    p_contact_name: 'Retry Vendor',
    p_business_name: 'Retry',
    p_category: 'Crafts',
    p_email: '',
    p_amount_paid: 20000,
    p_payment_status: 'paid',
  });
  if (retryErr) {
    fail(`idempotent retry errored: ${retryErr.message}`);
  } else {
    const row = Array.isArray(retryData) ? retryData[0] : retryData;
    const same = row.ticket_number === results[0].row.ticket_number;
    console.log(`  Idempotent retry: original=${results[0].row.ticket_number} retry=${row.ticket_number} match=${same}`);
    if (!same) fail('idempotent retry returned a different ticket number');
  }

  // A consumed token used by a different vendor must be rejected.
  const { error: reuseErr } = await supabase.rpc('register_paid_vendor', {
    p_token: retryToken,
    p_edition_id: jobs[0].edition.id,
    p_phone: '+256799999999',
    p_contact_name: 'Attacker',
    p_business_name: 'Attacker',
    p_category: 'Crafts',
    p_email: '',
    p_amount_paid: 0,
    p_payment_status: 'paid',
  });
  console.log(`  Single-use enforcement: reuse ${reuseErr ? 'rejected ✓' : 'ACCEPTED ✗'}`);
  if (!reuseErr) fail('a consumed single-use token was accepted for a different vendor');
}

main()
  .then(cleanup)
  .catch(async (err) => {
    console.error('Test error:', err);
    await cleanup();
    process.exitCode = 1;
  });
