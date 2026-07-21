const fs = require('fs');
const path = require('path');
const { createClient } = require('./node_modules/@supabase/supabase-js');

const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const supabaseKey = envContent.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.+)/)?.[1]?.trim();

const supabase = createClient(supabaseUrl, supabaseKey);

const tables = [
  'regions',
  'market_days',
  'events',
  'vendors',
  'vendor_regions',
  'vendor_attributes',
  'event_registrations',
  'walkins',
  'survey_responses',
  'forms',
  'survey_fields',
  'field_responses'
];

async function inspect() {
  console.log("=== Inspecting tables ===");
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    if (error) {
      console.log(`Table: ${t} - ERROR: ${error.message}`);
    } else {
      console.log(`Table: ${t} - EXISTS. Columns:`, Object.keys(data[0] || {}));
    }
  }
}

inspect();
