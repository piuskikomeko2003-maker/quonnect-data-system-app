/**
 * Multi-day edition test.
 *
 * Creates a temporary 2-day edition, then verifies:
 *   1. A Day-2-only link issues exactly one Day 2 ticket.
 *   2. An all-days link issues one ticket per day, numbered independently.
 *   3. Ticket numbers are sequential per day, even when registrations run concurrently.
 *   4. Replaying a used link by the same vendor is idempotent.
 *   5. A consumed link cannot be replayed by a different vendor.
 *   6. Adding Day 2 to a Day-1-only vendor creates no duplicate vendor/registration.
 *   7. Wrong-day check-in is rejected.
 *
 * Usage: node scripts/test_multi_day_editions.mjs
 * Requires add_multi_day_editions.sql to be applied.
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

const TAG = `multiday-${Date.now()}`;
const created = { editions: [], links: [], vendors: [], types: [] };
let failures = 0;

function fail(msg) {
  failures += 1;
  console.error(`FAIL: ${msg}`);
}

function check(label, condition, detail = '') {
  console.log(`  ${condition ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!condition) fail(label);
}

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

async function makeTempEdition(regionId) {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('market_days')
    .insert({
      region_id: regionId,
      name: `${TAG} Market`,
      slug: `${TAG}-market`,
      edition: `${TAG} Edition`,
      event_date: today,
      standard_fee: 20000,
      status: 'upcoming',
    })
    .select('id, name')
    .single();
  if (error) throw error;
  created.editions.push(data.id);

  const { error: dayErr } = await supabase
    .from('edition_days')
    .upsert(
      [
        { edition_id: data.id, day_number: 1, event_date: today, fee: 20000, label: 'Day 1' },
        { edition_id: data.id, day_number: 2, event_date: tomorrow, fee: 25000, label: 'Day 2' },
      ],
      { onConflict: 'edition_id,day_number' }
    );
  if (dayErr) throw dayErr;

  const { data: days, error: readErr } = await supabase
    .from('edition_days')
    .select('id, day_number, event_date')
    .eq('edition_id', data.id)
    .order('day_number');
  if (readErr) throw readErr;

  return { edition: data, day1: days[0], day2: days[1] };
}

async function makeLink(editionId, allowedDayIds, suffix) {
  const token = `${TAG}-${suffix}-${Math.random().toString(36).slice(2, 8)}`;
  const { error } = await supabase.from('form_links').insert({
    token,
    form_slug: 'paid_vendor_registration',
    edition_id: editionId,
    is_single_use: true,
    allowed_day_ids: allowedDayIds,
  });
  if (error) throw error;
  created.links.push(token);
  return token;
}

async function register(token, edition, phone, name, index) {
  const { data, error } = await supabase.rpc('register_paid_vendor_multi', {
    p_token: token,
    p_edition_id: edition.id,
    p_phone: phone,
    p_contact_name: name,
    p_business_name: `${name} Crafts`,
    p_category: 'Crafts',
    p_email: '',
    p_amount_paid: 20000,
    p_payment_status: 'paid',
  });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  created.vendors.push(phone);
  return { ...row, phone, index };
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
    await supabase.from('market_days').delete().eq('id', editionId);
  }
  console.log('Cleanup complete.');
}

async function main() {
  console.log(`\n======================================================`);
  console.log('MULTI-DAY EDITION TEST');
  console.log(`======================================================`);

  const { data: regions } = await supabase.from('regions').select('id, name').limit(1);
  if (!regions?.length) throw new Error('No regions found.');
  const { edition, day1, day2 } = await makeTempEdition(regions[0].id);
  console.log(`Edition ${edition.id}: Day 1=${day1.event_date} Day 2=${day2.event_date}`);

  // 1. Day 2 only
  const day2Token = await makeLink(edition.id, [day2.id], 'day2');
  const day2Result = await register(
    day2Token,
    edition,
    `+25670${String(Date.now()).slice(-7)}1`,
    'Day Two Vendor',
    1
  );
  check('Day-2-only link issues exactly one ticket', day2Result.tickets.length === 1,
    `${day2Result.tickets.length} ticket(s)`);
  check('Day-2-only ticket is Day 2', day2Result.tickets[0]?.day_number === 2,
    JSON.stringify(day2Result.tickets[0]?.day_label));
  const { data: day2Reg } = await supabase
    .from('vendor_registrations')
    .select('ticket_number, stall_number')
    .eq('id', day2Result.registration_id)
    .single();
  check('Day-2-only registration leaves the legacy Day 1 mirror empty',
    day2Reg?.ticket_number == null && day2Reg?.stall_number == null,
    `legacy=${day2Reg?.ticket_number}/${day2Reg?.stall_number}`);

  // 2/3. Concurrent all-days links. Each vendor pays for both days.
  const total = 60;
  const jobs = [];
  for (let i = 0; i < total; i++) {
    const token = await makeLink(edition.id, [day1.id, day2.id], `all-${i}`);
    jobs.push({
      token,
      phone: `+2567${String(Date.now()).slice(-5)}${String(i).padStart(3, '0')}`,
      name: `Multi Vendor ${i}`,
      index: i,
    });
  }

  const results = await mapConcurrent(jobs, 20, (job) =>
    register(job.token, edition, job.phone, job.name, job.index)
  );

  const allValid = results.every((r) => r.tickets.length === 2);
  check('All-days links issue two tickets', allValid,
    `bad=${results.filter((r) => r.tickets.length !== 2).length}`);

  const day1Numbers = results.map((r) => Number(r.tickets.find((t) => t.day_number === 1)?.ticket_number));
  const day2Numbers = results.map((r) => Number(r.tickets.find((t) => t.day_number === 2)?.ticket_number));

  const verifySequential = (label, numbers) => {
    const unique = new Set(numbers);
    const sorted = [...numbers].sort((a, b) => a - b);
    const sequential = sorted.every((n, i) => i === 0 || n === sorted[i - 1] + 1);
    check(`${label} ticket numbers unique and sequential`, unique.size === numbers.length && sequential,
      `range=${sorted[0]}..${sorted[sorted.length - 1]}`);
  };
  verifySequential('Day 1', day1Numbers);
  verifySequential('Day 2', day2Numbers);

  // 4. Idempotent replay by the same vendor.
  const replay = await register(
    jobs[0].token,
    edition,
    jobs[0].phone,
    jobs[0].name,
    jobs[0].index
  );
  const original = results[0].tickets.find((t) => t.day_number === 1)?.ticket_number;
  const replayed = replay.tickets.find((t) => t.day_number === 1)?.ticket_number;
  check('Same-vendor replay is idempotent', original === replayed,
    `original=${original} replay=${replayed}`);

  // 5. A different vendor cannot reuse the token.
  const { error: reuseErr } = await supabase.rpc('register_paid_vendor_multi', {
    p_token: jobs[0].token,
    p_edition_id: edition.id,
    p_phone: '+256799999991',
    p_contact_name: 'Attacker',
    p_business_name: 'Attacker',
    p_category: 'Crafts',
    p_email: '',
    p_amount_paid: 0,
    p_payment_status: 'paid',
  });
  check('Consumed link is rejected for a different vendor', !!reuseErr);

  // 6. Add Day 2 to an existing Day-1-only vendor without duplication.
  const day1Token = await makeLink(edition.id, [day1.id], 'day1-only');
  const phone = `+25671${String(Date.now()).slice(-7)}9`;
  const day1Only = await register(day1Token, edition, phone, 'Day One Vendor', 999);
  const beforeVendors = (await supabase.from('vendors').select('id').eq('phone', phone)).data || [];
  const { data: adminResult, error: addErr } = await supabase.rpc('register_paid_vendor_admin_multi', {
    p_edition_id: edition.id,
    p_phone: phone,
    p_contact_name: 'Day One Vendor',
    p_business_name: 'Day One Crafts',
    p_category: 'Crafts',
    p_email: '',
    p_amount_paid: 25000,
    p_payment_status: 'paid',
    p_day_ids: [day2.id],
  });
  const afterVendors = (await supabase.from('vendors').select('id').eq('phone', phone)).data || [];
  check('Adding Day 2 does not duplicate the vendor', beforeVendors.length === 1 && afterVendors.length === 1,
    `vendors=${afterVendors.length}`);
  check('Adding Day 2 produces the add-day RPC result', !addErr && !!adminResult,
    addErr?.message || '');
  const day1After = (await supabase
    .from('vendor_tickets')
    .select('id, edition_day_id, ticket_number')
    .eq('edition_id', edition.id)
    .eq('registration_id', day1Only.registration_id)).data || [];
  check('Existing Day 1 ticket is preserved and Day 2 added', day1After.length === 2,
    `tickets=${day1After.length}`);

  // 7. Wrong-day check-in is rejected by the DB function.
  const day1Ticket = day1After.find((t) => t.edition_day_id === day1.id);
  const { error: checkInErr } = await supabase.rpc('check_in_vendor_ticket', {
    p_ticket_id: day1Ticket?.id,
    p_check_in: true,
  });
  // Day 1 is today in this fixture, so it should succeed. Day 2 must fail.
  const day2Ticket = day1After.find((t) => t.edition_day_id === day2.id);
  const { error: wrongDayErr } = await supabase.rpc('check_in_vendor_ticket', {
    p_ticket_id: day2Ticket?.id,
    p_check_in: true,
  });
  check('Day 2 ticket cannot be checked in on Day 1', !!wrongDayErr,
    wrongDayErr?.message || 'accepted');
  if (checkInErr) {
    console.log(`  (note) Day 1 check-in returned: ${checkInErr.message}`);
  }

  console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .then(cleanup)
  .catch(async (err) => {
    console.error('Test error:', err);
    await cleanup();
    process.exitCode = 1;
  });
