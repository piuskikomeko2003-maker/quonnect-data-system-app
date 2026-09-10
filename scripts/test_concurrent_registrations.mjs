import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) env[parts[0].trim()] = parts.slice(1).join('=').trim();
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Keyed mutex logic (same as API route)
class KeyedMutex {
  constructor() {
    this.queues = new Map();
  }
  async run(key, fn) {
    const current = this.queues.get(key) || Promise.resolve();
    let resolveNext;
    const next = new Promise((res) => { resolveNext = res; });
    this.queues.set(key, next);
    try {
      await current;
      return await fn();
    } finally {
      resolveNext();
      if (this.queues.get(key) === next) {
        this.queues.delete(key);
      }
    }
  }
}

const editionMutex = new KeyedMutex();

async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const isTransient = err.message?.includes('fetch') || err.message?.includes('ECONNRESET') || err.message?.includes('network');
      if (!isTransient) throw err;
      await new Promise(r => setTimeout(r, 100 * attempt));
    }
  }
}

async function registerOneVendor(token, editionId, index, batchPrefix) {
  return await editionMutex.run(editionId, async () => {
    return await withRetry(async () => {
      // 1. Verify link
      const { data: link, error: lErr } = await supabase
        .from('form_links')
        .select('token, expires_at')
        .eq('token', token)
        .single();

      if (lErr || !link || (link.expires_at && new Date(link.expires_at) <= new Date())) {
        throw new Error(`Token ${token} invalid or expired`);
      }

      // 2. Count existing registrations under mutex
      const { count: earlierCount } = await supabase
        .from('vendor_registrations')
        .select('id', { count: 'exact', head: true })
        .eq('market_day_id', editionId);

      const ticketNumber = (earlierCount || 0) + 1;
      const ticketCode = `TKT-${String(ticketNumber).padStart(3, '0')}`;

      // 3. Upsert vendor atomically
      const phone = `+256788${batchPrefix}${String(index).padStart(4, '0')}`;
      const name = `Scale Vendor ${index}`;
      const { data: vendor, error: vErr } = await supabase
        .from('vendors')
        .upsert({
          business_name: `${name} Crafts`,
          contact_name: name,
          phone,
          category: 'Crafts',
          is_active: true,
        }, { onConflict: 'phone' })
        .select('id')
        .single();

      if (vErr) throw vErr;

      // 4. Insert registration
      const { data: reg, error: rErr } = await supabase
        .from('vendor_registrations')
        .insert({
          market_day_id: editionId,
          vendor_id: vendor.id,
          amount_paid: 20000,
          payment_status: 'paid',
          stall_number: ticketCode,
          notes: `Ticket #${ticketNumber} (${ticketCode})`,
        })
        .select('id')
        .single();

      if (rErr) throw rErr;

      // 5. Expire link
      await supabase
        .from('form_links')
        .update({ expires_at: new Date().toISOString() })
        .eq('token', token);

      return {
        index,
        ticketNumber,
        ticketCode,
        vendorId: vendor.id,
        regId: reg.id,
        token,
      };
    });
  });
}

// Concurrency pool runner (processes N items with max concurrency)
async function mapConcurrent(items, concurrency, fn) {
  const results = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function runLoadTest(totalVendors = 300, workerConcurrency = 20) {
  console.log(`\n======================================================`);
  console.log(`🚀 RUNNING SCALE TEST: ${totalVendors} PAID VENDORS (Concurrency: ${workerConcurrency})`);
  console.log(`======================================================`);

  // 1. Fetch active edition
  const { data: edition } = await supabase
    .from('market_days')
    .select('id, name')
    .limit(1)
    .single();

  console.log(`Event Edition: ${edition.name} (${edition.id})`);

  // 2. Count existing registrations before test
  const { count: initialCount } = await supabase
    .from('vendor_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('market_day_id', edition.id);

  console.log(`Initial registration count in DB: ${initialCount}`);

  // 3. Batch generate single-use tokens
  console.log(`Generating ${totalVendors} single-use tokens in DB...`);
  const batchPrefix = String(Math.floor(Math.random() * 89 + 10));
  const tokens = [];
  const linkInserts = [];
  for (let i = 1; i <= totalVendors; i++) {
    const token = `scale-${batchPrefix}-${i}-${Date.now()}`;
    tokens.push(token);
    linkInserts.push({
      token,
      form_slug: 'paid_vendor_registration',
      edition_id: edition.id,
      expires_at: null,
    });
  }

  // Insert links in chunks of 100
  for (let c = 0; c < linkInserts.length; c += 100) {
    const chunk = linkInserts.slice(c, c + 100);
    const { error: chunkErr } = await supabase.from('form_links').insert(chunk);
    if (chunkErr) {
      console.error('Failed to insert link chunk:', chunkErr);
      process.exit(1);
    }
  }
  console.log(`All ${totalVendors} single-use links ready in DB.`);

  // 4. FIRE ALL 300 REGISTRATIONS!
  console.log(`⚡ Processing ${totalVendors} registrations across ${workerConcurrency} parallel connections...`);
  const startTime = Date.now();

  const results = await mapConcurrent(tokens, workerConcurrency, (token, idx) =>
    registerOneVendor(token, edition.id, idx + 1, batchPrefix)
  );

  const elapsedMs = Date.now() - startTime;
  const avgLatency = (elapsedMs / totalVendors).toFixed(1);
  const throughput = (totalVendors / (elapsedMs / 1000)).toFixed(1);

  console.log(`\n======================================================`);
  console.log(`✅ COMPLETED ${totalVendors} REGISTRATIONS IN ${(elapsedMs / 1000).toFixed(2)}s`);
  console.log(`⚡ Average Latency: ${avgLatency}ms / registration`);
  console.log(`📈 Peak Throughput: ${throughput} registrations / second`);
  console.log(`======================================================`);

  // 5. Verification: Check for duplicate ticket numbers
  const ticketCodes = results.map(r => r.ticketCode);
  const uniqueTicketCodes = new Set(ticketCodes);

  console.log(`Total tickets issued: ${ticketCodes.length}`);
  console.log(`Unique ticket numbers: ${uniqueTicketCodes.size}`);

  if (uniqueTicketCodes.size !== totalVendors) {
    console.error(`❌ COLLISION DETECTED! Only ${uniqueTicketCodes.size} unique tickets out of ${totalVendors}!`);
    process.exit(1);
  } else {
    console.log(`🎉 100% UNIQUE! Exactly ${uniqueTicketCodes.size} unique tickets out of ${totalVendors}. Zero collisions!`);
  }

  // 6. Verify strictly sequential ordering
  const ticketNumbers = results.map(r => r.ticketNumber).sort((a, b) => a - b);
  const expectedFirst = initialCount + 1;
  const expectedLast = initialCount + totalVendors;
  console.log(`First Ticket: #${ticketNumbers[0]} (Expected: #${expectedFirst})`);
  console.log(`Last Ticket:  #${ticketNumbers[ticketNumbers.length - 1]} (Expected: #${expectedLast})`);

  let isSequential = true;
  for (let i = 0; i < ticketNumbers.length; i++) {
    if (ticketNumbers[i] !== expectedFirst + i) {
      isSequential = false;
      break;
    }
  }

  if (isSequential) {
    console.log(`🎉 100% SEQUENTIAL! All tickets strictly monotonic (#${expectedFirst} -> #${expectedLast}) with ZERO gaps.`);
  } else {
    console.error(`❌ Non-sequential ticket numbers detected.`);
  }

  // 7. Verify all single-use links are now closed
  console.log(`\nVerifying all ${totalVendors} links are now closed / expired...`);
  const { data: closedLinks } = await supabase
    .from('form_links')
    .select('token, expires_at')
    .in('token', tokens);

  const allClosed = closedLinks.every(l => l.expires_at !== null);
  if (allClosed) {
    console.log(`🎉 100% CLOSED! All ${closedLinks.length} single-use links expired in DB.`);
  } else {
    console.error(`❌ Some links remained open!`);
  }

  // 8. Clean up test records
  console.log(`\nCleaning up ${totalVendors} test records from DB...`);
  const regIds = results.map(r => r.regId);
  const vendorIds = results.map(r => r.vendorId);

  for (let c = 0; c < regIds.length; c += 100) {
    await supabase.from('vendor_registrations').delete().in('id', regIds.slice(c, c + 100));
  }
  for (let c = 0; c < vendorIds.length; c += 100) {
    await supabase.from('vendors').delete().in('id', vendorIds.slice(c, c + 100));
  }
  for (let c = 0; c < tokens.length; c += 100) {
    await supabase.from('form_links').delete().in('token', tokens.slice(c, c + 100));
  }
  console.log(`✅ Cleanup complete. Database restored.`);
  console.log(`======================================================\n`);
}

// Run for 50 vendors
runLoadTest(50, 15).catch(console.error);
