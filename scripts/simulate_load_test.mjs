import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Supabase configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://phaafkuwtgpawuqnenkp.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBoYWFma3V3dGdwYXd1cW5lbmtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODQzMDc5MSwiZXhwIjoyMDk0MDA2NzkxfQ.Oq9Tc6UgWZTKxStGiXDo45_D-Zrc9OPbj0GVp6JUVWs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const TOTAL_SUBMISSIONS_TARGET = 1050; // Combined 1000+ records
const NUM_COLLECTORS = 5;
const SUBMISSIONS_PER_COLLECTOR = Math.ceil(TOTAL_SUBMISSIONS_TARGET / NUM_COLLECTORS); // 210 each

// Realistic delay between submissions per collector (ms)
const MIN_DELAY_MS = 600;
const MAX_DELAY_MS = 1400;

const SESSION_PREFIX = Math.floor(Math.random() * 899 + 100); // 3 digit unique prefix

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const CATEGORIES = ['Food & Beverages', 'Crafts & Arts', 'Apparel & Fashion', 'Electronics', 'Agriculture', 'Cosmetics'];
const FIRST_NAMES = ['Grace', 'Brian', 'Sarah', 'David', 'Joan', 'Emmanuel', 'Agnes', 'Moses', 'Rebecca', 'Samuel'];
const LAST_NAMES = ['Mbabazi', 'Kato', 'Namubiru', 'Mukasa', 'Akello', 'Otim', 'Tumwesigye', 'Kigozi', 'Nabirye', 'Okello'];

function generateVendorRecord(collectorId, index) {
  const fName = FIRST_NAMES[getRandomInt(0, FIRST_NAMES.length - 1)];
  const lName = LAST_NAMES[getRandomInt(0, LAST_NAMES.length - 1)];
  const name = `${fName} ${lName}`;
  const phone = `+2567${SESSION_PREFIX}${collectorId}${String(index).padStart(4, '0')}`;
  const bizName = `${name}'s ${CATEGORIES[getRandomInt(0, CATEGORIES.length - 1)]} Hub`;
  const category = CATEGORIES[getRandomInt(0, CATEGORIES.length - 1)];

  return {
    contact_name: name,
    business_name: bizName,
    phone,
    email: `loadtest_${SESSION_PREFIX}_${collectorId}_${index}@test-quonnect.org`,
    category,
    business_category: category,
    age: String(getRandomInt(20, 60)),
    gender: Math.random() > 0.5 ? 'Female' : 'Male',
    how_long_in_business: '1-3 years',
    primary_source_of_income: 'Yes',
  };
}

async function getOrCreateTestEdition() {
  console.log('[Setup] Checking for test market edition...');
  const { data: existing, error: eErr } = await supabase
    .from('market_days')
    .select('id, name')
    .eq('name', 'Staging Load Test Edition')
    .maybeSingle();

  if (existing) {
    console.log(`[Setup] Using existing test edition: ${existing.name} (${existing.id})`);
    return existing.id;
  }

  const { data: region } = await supabase.from('regions').select('id').limit(1).maybeSingle();
  const regionId = region?.id || 'd8319666-5eef-48df-9e58-0277bf3415b4';

  const { data: inserted, error: iErr } = await supabase
    .from('market_days')
    .insert({
      name: 'Staging Load Test Edition',
      status: 'upcoming',
      region_id: regionId,
      event_date: '2026-10-01',
    })
    .select('id, name')
    .single();

  if (iErr) {
    console.warn('[Setup] Could not create dedicated test edition, using upcoming edition:', iErr.message);
    const { data: fallback } = await supabase.from('market_days').select('id, name').limit(1).single();
    return fallback.id;
  }

  console.log(`[Setup] Created test edition: ${inserted.name} (${inserted.id})`);
  return inserted.id;
}

async function getFormMetadata() {
  const { data: formData, error: fErr } = await supabase
    .from('forms')
    .select('id')
    .eq('slug', 'vendor_data_collection')
    .single();

  if (fErr || !formData) throw new Error(`Form not found: ${fErr?.message}`);

  const { data: questions, error: qErr } = await supabase
    .from('survey_questions')
    .select('id, csv_column')
    .eq('form_id', formData.id);

  if (qErr) throw new Error(`Questions not found: ${qErr?.message}`);

  return { formId: formData.id, questions };
}

async function runCollectorWorker(collectorId, count, editionId, formMeta, stats, logStream) {
  console.log(`[Collector ${collectorId}] Starting worker for ${count} submissions...`);

  for (let i = 1; i <= count; i++) {
    const record = generateVendorRecord(collectorId, i);
    const submissionId = crypto.randomUUID();
    const startTime = Date.now();
    let statusCode = 200;
    let errorMessage = null;

    try {
      // 1. Lookup or Insert Vendor
      let vendorId;
      const { data: existingVendor } = await supabase
        .from('vendors')
        .select('id')
        .eq('phone', record.phone)
        .limit(1);

      if (existingVendor && existingVendor.length > 0) {
        vendorId = existingVendor[0].id;
      } else {
        const { data: vendorData, error: vErr } = await supabase
          .from('vendors')
          .insert({
            business_name: record.business_name,
            contact_name: record.contact_name,
            phone: record.phone,
            email: record.email,
            category: record.category,
            is_active: true,
          })
          .select('id')
          .single();

        if (vErr) throw new Error(`Vendor insert: ${vErr.message} (code: ${vErr.code})`);
        vendorId = vendorData.id;
      }

      // 2. Insert Survey Response
      const { error: resErr } = await supabase.from('survey_responses').insert({
        id: submissionId,
        form_id: formMeta.formId,
        context_type: 'market_day',
        context_id: editionId,
        vendor_id: vendorId,
        source: 'link',
        submitted_at: new Date().toISOString(),
      });

      if (resErr && resErr.code !== '23505') {
        throw new Error(`Survey response insert: ${resErr.message} (code: ${resErr.code})`);
      }

      // 3. Insert Survey Answers
      const answersToInsert = [];
      for (const q of formMeta.questions) {
        const val = record[q.csv_column];
        if (val !== undefined && val !== null && val !== '') {
          answersToInsert.push({
            response_id: submissionId,
            question_id: q.id,
            answer: String(val),
          });
        }
      }

      if (answersToInsert.length > 0) {
        const { error: ansErr } = await supabase.from('survey_answers').insert(answersToInsert);
        if (ansErr && ansErr.code !== '23505') {
          throw new Error(`Survey answers insert: ${ansErr.message} (code: ${ansErr.code})`);
        }
      }

      // 4. Insert Walkin
      const { error: walkErr } = await supabase.from('walkins').insert({
        id: submissionId,
        market_day_id: editionId,
        full_name: record.contact_name,
        phone: record.phone,
        email: record.email,
        business_type: record.category,
        age: parseInt(record.age),
        recorded_at: new Date().toISOString(),
      });

      if (walkErr && walkErr.code !== '23505') {
        throw new Error(`Walkin insert: ${walkErr.message} (code: ${walkErr.code})`);
      }

    } catch (err) {
      statusCode = 500;
      errorMessage = err.message || String(err);
    }

    const durationMs = Date.now() - startTime;
    const globalCount = ++stats.totalCompleted;
    if (statusCode === 200) {
      stats.successCount++;
      stats.latencies.push(durationMs);
    } else {
      stats.failureCount++;
      stats.errors.push({ collectorId, index: i, error: errorMessage, atCount: globalCount });
    }

    // Structured Log entry
    const logEntry = {
      timestamp: new Date().toISOString(),
      globalCount,
      collectorId,
      subIndex: i,
      submissionId,
      statusCode,
      durationMs,
      error: errorMessage,
    };
    logStream.write(JSON.stringify(logEntry) + '\n');

    if (globalCount % 50 === 0 || globalCount === 1 || globalCount === 60 || globalCount === 100 || statusCode !== 200) {
      const avgLat = (stats.latencies.reduce((a, b) => a + b, 0) / (stats.latencies.length || 1)).toFixed(0);
      const minLat = Math.min(...(stats.latencies.length ? stats.latencies : [0]));
      const maxLat = Math.max(...(stats.latencies.length ? stats.latencies : [0]));
      console.log(
        `[Progress ${String(globalCount).padStart(4, ' ')}/${TOTAL_SUBMISSIONS_TARGET}] ` +
        `Collector ${collectorId} (#${i}): ` +
        `Status ${statusCode} | ${durationMs}ms (avg: ${avgLat}ms, min: ${minLat}ms, max: ${maxLat}ms) | ` +
        `Success: ${stats.successCount}, Fails: ${stats.failureCount}` +
        (errorMessage ? ` | ERROR: ${errorMessage}` : '')
      );
    }

    // Jitter delay between collector submissions
    const delay = getRandomInt(MIN_DELAY_MS, MAX_DELAY_MS);
    await sleep(delay);
  }

  console.log(`[Collector ${collectorId}] Completed all ${count} submissions.`);
}

async function main() {
  console.log('='.repeat(70));
  console.log('STARTING CONCURRENT LOAD TEST SIMULATION (1000+ SUBMISSIONS)');
  console.log(`Collectors: ${NUM_COLLECTORS} concurrent field collectors`);
  console.log(`Target: ${TOTAL_SUBMISSIONS_TARGET} total records (~${SUBMISSIONS_PER_COLLECTOR} per collector)`);
  console.log(`Delay per submission: ${MIN_DELAY_MS}ms - ${MAX_DELAY_MS}ms jitter`);
  console.log('='.repeat(70));

  const logFilePath = path.join(process.cwd(), 'load_test_results.jsonl');
  const logStream = fs.createWriteStream(logFilePath, { flags: 'w' });

  const editionId = await getOrCreateTestEdition();
  const formMeta = await getFormMetadata();

  const stats = {
    totalCompleted: 0,
    successCount: 0,
    failureCount: 0,
    latencies: [],
    errors: [],
    startTime: Date.now(),
  };

  const collectorPromises = [];
  for (let c = 1; c <= NUM_COLLECTORS; c++) {
    await sleep(300);
    collectorPromises.push(
      runCollectorWorker(c, SUBMISSIONS_PER_COLLECTOR, editionId, formMeta, stats, logStream)
    );
  }

  await Promise.all(collectorPromises);
  logStream.end();

  const totalTimeSec = ((Date.now() - stats.startTime) / 1000).toFixed(1);
  const latencies = [...stats.latencies].sort((a, b) => a - b);
  const avgLatency = (latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1)).toFixed(1);
  const medianLatency = latencies[Math.floor(latencies.length * 0.5)] || 0;
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)] || 0;
  const p99Latency = latencies[Math.floor(latencies.length * 0.99)] || 0;
  const minLatency = latencies[0] || 0;
  const maxLatency = latencies[latencies.length - 1] || 0;

  console.log('\n' + '='.repeat(70));
  console.log('LOAD TEST SIMULATION COMPLETE — FINAL REPORT');
  console.log('='.repeat(70));
  console.log(`Total Requests:      ${stats.totalCompleted}`);
  console.log(`Successful:          ${stats.successCount} (${((stats.successCount / stats.totalCompleted) * 100).toFixed(1)}%)`);
  console.log(`Failed:              ${stats.failureCount}`);
  console.log(`Total Time:          ${totalTimeSec}s`);
  console.log(`Throughput:          ${(stats.totalCompleted / totalTimeSec).toFixed(2)} submissions/sec`);
  console.log('--- Latency Profile ---');
  console.log(`Min Latency:         ${minLatency}ms`);
  console.log(`Median (p50):        ${medianLatency}ms`);
  console.log(`Average Latency:     ${avgLatency}ms`);
  console.log(`95th Percentile:     ${p95Latency}ms`);
  console.log(`99th Percentile:     ${p99Latency}ms`);
  console.log(`Max Latency:         ${maxLatency}ms`);
  console.log('='.repeat(70));

  if (stats.errors.length > 0) {
    console.log('\nSample Errors Encountered:');
    stats.errors.slice(0, 10).forEach((err, idx) => {
      console.log(`  [#${idx + 1}] at global count ${err.atCount} (Collector ${err.collectorId}): ${err.error}`);
    });
  }

  // Latency bucket progression (to see if slowdown happened over time)
  console.log('\n--- Latency Progression (by bucket of 200 submissions) ---');
  const bucketSize = 200;
  for (let b = 0; b < stats.totalCompleted; b += bucketSize) {
    const bucketLatencies = stats.latencies.slice(b, b + bucketSize);
    if (bucketLatencies.length > 0) {
      const bAvg = (bucketLatencies.reduce((x, y) => x + y, 0) / bucketLatencies.length).toFixed(0);
      const bMin = Math.min(...bucketLatencies);
      const bMax = Math.max(...bucketLatencies);
      console.log(`Submissions ${b + 1} to ${Math.min(b + bucketSize, stats.totalCompleted)}: avg ${bAvg}ms (min: ${bMin}ms, max: ${bMax}ms)`);
    }
  }

  // Summary object file for review
  const summary = {
    totalCompleted: stats.totalCompleted,
    successCount: stats.successCount,
    failureCount: stats.failureCount,
    totalTimeSec: parseFloat(totalTimeSec),
    throughput: parseFloat((stats.totalCompleted / totalTimeSec).toFixed(2)),
    minLatency,
    medianLatency,
    avgLatency: parseFloat(avgLatency),
    p95Latency,
    p99Latency,
    maxLatency,
    errors: stats.errors,
  };
  fs.writeFileSync(path.join(process.cwd(), 'load_test_summary.json'), JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error('Fatal load test error:', err);
  process.exit(1);
});
