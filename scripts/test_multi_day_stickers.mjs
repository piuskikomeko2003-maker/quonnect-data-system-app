/**
 * Per-day sticker template test.
 *
 * Run with:
 *   npm run test:multi-day-stickers
 *
 * Requires both multi-day migrations to be applied. Creates a temporary 2-day
 * edition, issues Day 1 + Day 2 tickets, creates per-day sticker templates and
 * verifies that:
 *   - day template resolution wins over the edition/global fallback;
 *   - one template per day is enforced;
 *   - sticker vendors are loaded per day with that day's ticket numbers;
 *   - per-ticket sticker progress is independent between days.
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import {
  createStickerTemplate,
  fetchStickerVendors,
  getStickerTemplate,
  listStickerTemplates,
} from '../src/lib/stickers/server.ts';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach((line) => {
  const idx = line.indexOf('=');
  if (idx > 0) env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
});
process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TAG = `stickers-multiday-${Date.now()}`;
let editionId = null;
let vendorId = null;
let day1 = null;
let day2 = null;
let template1 = null;
let template2 = null;
let failures = 0;

function check(label, condition, detail = '') {
  console.log(`  ${condition ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!condition) failures++;
}

async function cleanup() {
  console.log('\nCleaning up test data...');
  if (editionId) {
    await supabase.from('sticker_templates').delete().eq('edition_id', editionId);
    const { data: regs } = await supabase
      .from('vendor_registrations')
      .select('vendor_id')
      .eq('market_day_id', editionId);
    const ids = [...new Set((regs || []).map((r) => r.vendor_id))];
    await supabase.from('vendor_registrations').delete().eq('market_day_id', editionId);
    if (ids.length) await supabase.from('vendors').delete().in('id', ids);
    await supabase.from('form_links').delete().eq('edition_id', editionId);
    await supabase.from('market_days').delete().eq('id', editionId);
  }
  console.log('Cleanup complete.');
}

async function main() {
  console.log('\n======================================================');
  console.log('PER-DAY STICKER TEMPLATE TEST');
  console.log('======================================================');

  const { data: regions } = await supabase.from('regions').select('id').limit(1);
  if (!regions?.length) throw new Error('No regions found.');

  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  const { data: edition, error: edErr } = await supabase
    .from('market_days')
    .insert({
      region_id: regions[0].id,
      name: `${TAG} Market`,
      slug: `${TAG}-market`,
      edition: `${TAG} Edition`,
      event_date: today,
      standard_fee: 20000,
      status: 'upcoming',
    })
    .select('id, name')
    .single();
  if (edErr) throw edErr;
  editionId = edition.id;

  const { data: days, error: dayErr } = await supabase
    .from('edition_days')
    .upsert(
      [
        { edition_id: editionId, day_number: 1, event_date: today, fee: 20000, label: 'Day 1' },
        { edition_id: editionId, day_number: 2, event_date: tomorrow, fee: 25000, label: 'Day 2' },
      ],
      { onConflict: 'edition_id,day_number' }
    )
    .select('id, day_number')
    .order('day_number');
  if (dayErr) throw dayErr;
  day1 = days[0];
  day2 = days[1];

  const token = `${TAG}-link`;
  const { error: linkErr } = await supabase.from('form_links').insert({
    token,
    form_slug: 'paid_vendor_registration',
    edition_id: editionId,
    is_single_use: true,
    allowed_day_ids: [day1.id, day2.id],
  });
  if (linkErr) throw linkErr;

  const phone = `+2567${String(Date.now()).slice(-8)}`;
  const { data: registration, error: regErr } = await supabase.rpc('register_paid_vendor_multi', {
    p_token: token,
    p_edition_id: editionId,
    p_phone: phone,
    p_contact_name: 'Sticker Test Vendor',
    p_business_name: 'Sticker Test Crafts',
    p_category: 'Crafts',
    p_email: '',
    p_amount_paid: 45000,
    p_payment_status: 'paid',
  });
  if (regErr) throw regErr;
  vendorId = registration.registration_id;

  check('Registration issued two day tickets', registration.tickets.length === 2);

  // Create per-day templates by copying the current fallback.
  template1 = await createStickerTemplate(supabase, {
    editionId,
    editionDayId: day1.id,
  });
  template2 = await createStickerTemplate(supabase, {
    editionId,
    editionDayId: day2.id,
  });
  check('Day 1 template stores edition_day_id', template1.edition_day_id === day1.id);
  check('Day 2 template stores edition_day_id', template2.edition_day_id === day2.id);
  check('Day templates have distinct names', template1.preset_name !== template2.preset_name,
    `${template1.preset_name} / ${template2.preset_name}`);

  const resolved1 = await getStickerTemplate(supabase, null, editionId, day1.id);
  const resolved2 = await getStickerTemplate(supabase, null, editionId, day2.id);
  check('Day 1 resolves to the Day 1 template', resolved1?.id === template1.id);
  check('Day 2 resolves to the Day 2 template', resolved2?.id === template2.id);

  let duplicateBlocked = false;
  try {
    await createStickerTemplate(supabase, { editionId, editionDayId: day1.id });
  } catch {
    duplicateBlocked = true;
  }
  check('A second template for the same day is blocked', duplicateBlocked);

  const all = await listStickerTemplates(supabase);
  check('Two day templates exist in the list',
    all.filter((t) => t.edition_id === editionId && t.edition_day_id).length === 2);

  const day1Vendors = await fetchStickerVendors(supabase, editionId, day1.id);
  const day2Vendors = await fetchStickerVendors(supabase, editionId, day2.id);
  const day1Ticket = registration.tickets.find((t) => t.day_number === 1);
  const day2Ticket = registration.tickets.find((t) => t.day_number === 2);

  check('Day 1 vendor load returns the Day 1 ticket',
    day1Vendors.length === 1 && day1Vendors[0].ticket_id === day1Ticket.ticket_id);
  check('Day 2 vendor load returns the Day 2 ticket',
    day2Vendors.length === 1 && day2Vendors[0].ticket_id === day2Ticket.ticket_id);
  check('Ticket numbers match their day',
    day1Vendors[0]?.ticket_number === day1Ticket.ticket_number &&
    day2Vendors[0]?.ticket_number === day2Ticket.ticket_number,
    `day1=${day1Vendors[0]?.ticket_number} day2=${day2Vendors[0]?.ticket_number}`);

  // Printed progress is per ticket: marking Day 2 printed must not affect Day 1.
  const { error: printErr } = await supabase
    .from('vendor_tickets')
    .update({ stickers_printed: 1 })
    .eq('id', day2Ticket.ticket_id);
  if (printErr) throw printErr;

  const day1After = await fetchStickerVendors(supabase, editionId, day1.id);
  const day2After = await fetchStickerVendors(supabase, editionId, day2.id);
  check('Day 1 progress stays at 0',
    Math.max(0, Number(day1After[0]?.stickers_printed) || 0) === 0);
  check('Day 2 progress moved to 1',
    Math.max(0, Number(day2After[0]?.stickers_printed) || 0) === 1);

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
