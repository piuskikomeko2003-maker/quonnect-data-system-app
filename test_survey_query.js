const fs = require('fs');
const path = require('path');
const { createClient } = require('./node_modules/@supabase/supabase-js');

const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const supabaseKey = envContent.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.+)/)?.[1]?.trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data, error } = await supabase
    .from('survey_responses')
    .select('*')
    .eq('market_day_id', 'd8319666-5eef-48df-9e58-0277bf3415b4')
    .limit(1);

  if (error) {
    console.error("Error querying market_day_id directly:", error.message);
  } else {
    console.log("Success querying market_day_id directly.");
  }
}

test();
