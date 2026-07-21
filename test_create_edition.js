const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envLocal = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf-8');
const envVars = {};
envLocal.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    envVars[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const url = envVars.NEXT_PUBLIC_SUPABASE_URL;
const key = envVars.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || envVars.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key);

async function testStatus(statusValue) {
  const { data: regions } = await supabase.from('regions').select('id, name').limit(1);
  const region = regions[0];
  const testSlug = `test-status-${statusValue}-${Date.now()}`;

  const { data, error } = await supabase
    .from('market_days')
    .insert([{
      region_id: region.id,
      name: 'Test Market Day',
      slug: testSlug,
      event_date: '2026-08-01',
      edition: 'August 2026 Test',
      notes: 'Test Venue',
      status: statusValue
    }])
    .select()
    .single();

  if (error) {
    console.log(`Status "${statusValue}" FAILED:`, error.message);
  } else {
    console.log(`Status "${statusValue}" SUCCESS! Id: ${data.id}`);
    await supabase.from('market_days').delete().eq('id', data.id);
  }
}

async function runTests() {
  const statusesToTest = ['ongoing', 'cancelled', 'past', 'archived', 'live'];
  for (const s of statusesToTest) {
    await testStatus(s);
  }
}

runTests();
