const fs = require('fs');
const path = require('path');
const { createClient } = require('./node_modules/@supabase/supabase-js');

const envContent = fs.readFileSync(path.join(__dirname, '.env.local'), 'utf8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)?.[1]?.trim();
const supabaseKey = envContent.match(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.+)/)?.[1]?.trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  // Get Kampala region id
  const { data: regions } = await supabase.from('regions').select('id').eq('name', 'Kampala').limit(1);
  if (!regions || regions.length === 0) {
    console.log("No Kampala region found");
    return;
  }
  const regId = regions[0].id;
  console.log("Kampala Region ID:", regId);

  // Fetch vendors like in page.tsx
  const { data, error } = await supabase
    .from('survey_responses')
    .select(`
      vendor_id,
      vendors (
        id,
        business_name,
        contact_name,
        phone,
        email,
        category,
        is_active,
        created_at
      ),
      market_days!inner (
        id,
        region_id
      )
    `)
    .eq('market_days.region_id', regId);

  if (error) {
    console.error("Query Error:", error);
  } else {
    console.log("Query Success. Row count:", data.length);
    if (data.length > 0) {
      console.log("First row:", JSON.stringify(data[0], null, 2));
    }
  }
}

test();
