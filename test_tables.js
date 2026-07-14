const fs = require('fs');
const path = require('path');
const { createClient } = require('./node_modules/@supabase/supabase-js');

const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const supabaseKey = envContent.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.+)/)?.[1]?.trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  console.log("=== Inspecting tables ===");
  
  // Test regions
  const { data: regions, error: rErr } = await supabase.from('regions').select('*').limit(1);
  console.log("regions error:", rErr?.message || "none");
  if (regions) console.log("regions columns:", Object.keys(regions[0] || {}));

  // Test market_days
  const { data: md, error: mdErr } = await supabase.from('market_days').select('*').limit(1);
  console.log("market_days error:", mdErr?.message || "none");
  if (md) console.log("market_days columns:", Object.keys(md[0] || {}));

  // Test market_day_editions
  const { data: mde, error: mdeErr } = await supabase.from('market_day_editions').select('*').limit(1);
  console.log("market_day_editions error:", mdeErr?.message || "none");
  if (mde) console.log("market_day_editions columns:", Object.keys(mde[0] || {}));

  // Test editions
  const { data: ed, error: edErr } = await supabase.from('editions').select('*').limit(1);
  console.log("editions error:", edErr?.message || "none");
  if (ed) console.log("editions columns:", Object.keys(ed[0] || {}));
}

inspect();
