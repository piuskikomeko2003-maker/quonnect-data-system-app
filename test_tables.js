const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  // 1. Check vendors columns
  console.log("Checking vendors columns...");
  const { data: vData, error: vError } = await supabase
    .from('vendors')
    .select('id, business_name, contact_name, phone, email, category, is_active')
    .limit(1);
  if (vError) {
    console.error("Vendors column select failed:", vError.message);
  } else {
    console.log("Vendors column select: SUCCESS");
  }
  try {
    console.log("Seeding regions...");
    const { data: existingRegions, error: regSelectError } = await supabase.from('regions').select('*');
    if (regSelectError) throw regSelectError;

    let regionMap = {};
    for (const r of existingRegions) {
      regionMap[r.name] = r.id;
    }

    const targetRegions = ['Kampala', 'Jinja', 'Mbarara'];
    for (const name of targetRegions) {
      if (!regionMap[name]) {
        const { data: inserted, error: insError } = await supabase
          .from('regions')
          .insert({ name, slug: name.toLowerCase() })
          .select();
        if (insError) throw insError;
        regionMap[name] = inserted[0].id;
        console.log(`Created region: ${name} (${inserted[0].id})`);
      }
    }

    console.log("Seeding market days...");
    const targetMarketDays = [
      { name: 'Kampala May 2026', regionName: 'Kampala', event_date: '2026-05-26', status: 'completed' },
      { name: 'Kampala April 2026', regionName: 'Kampala', event_date: '2026-04-26', status: 'completed' },
      { name: 'Kampala March 2026', regionName: 'Kampala', event_date: '2026-03-26', status: 'completed' },
      { name: 'Jinja April 2026', regionName: 'Jinja', event_date: '2026-04-26', status: 'completed' },
      { name: 'Mbarara May 2026', regionName: 'Mbarara', event_date: '2026-05-26', status: 'completed' }
    ];

    const { data: existingMDs, error: mdError } = await supabase.from('market_days').select('*');
    if (mdError) throw mdError;

    let mdMap = {};
    for (const md of existingMDs) {
      mdMap[md.name] = md.id;
    }

    for (const md of targetMarketDays) {
      if (!mdMap[md.name]) {
        const regId = regionMap[md.regionName];
        const { data: insertedMD, error: mdInsError } = await supabase
          .from('market_days')
          .insert({
            name: md.name,
            region_id: regId,
            event_date: md.event_date,
            status: md.status
          })
          .select();
        if (mdInsError) {
          console.error(`Failed to insert market day "${md.name}":`, mdInsError.message);
        } else {
          mdMap[md.name] = insertedMD[0].id;
          console.log(`Created market day: ${md.name} (${insertedMD[0].id})`);
        }
      }
    }

    console.log("Seeding forms...");
    const { data: forms, error: formError } = await supabase.from('forms').select('*');
    if (formError) throw formError;
    
    let formId;
    if (forms.length === 0) {
      const { data: insertedForm, error: formInsError } = await supabase
        .from('forms')
        .insert({ name: 'Vendor Data Collection Survey', is_active: true })
        .select();
      if (formInsError) throw formInsError;
      formId = insertedForm[0].id;
      console.log(`Created form: ${insertedForm[0].name} (${formId})`);
    } else {
      formId = forms[0].id;
    }

    console.log("Seeding form sections...");
    const sections = ['Identity', 'Business Profile', 'Attendance', 'Employment', 'Impact', 'Challenges'];
    const { data: existingSections, error: secError } = await supabase.from('form_sections').select('*');
    if (secError) throw secError;

    let sectionMap = {};
    for (const s of existingSections) {
      sectionMap[s.name] = s.id;
    }

    for (let i = 0; i < sections.length; i++) {
      const name = sections[i];
      if (!sectionMap[name]) {
        const { data: insertedSec, error: secInsError } = await supabase
          .from('form_sections')
          .insert({ name, form_id: formId, sort_order: i })
          .select();
        if (secInsError) throw secInsError;
        sectionMap[name] = insertedSec[0].id;
        console.log(`Created section: ${name} (${insertedSec[0].id})`);
      }
    }

    console.log("Seeding survey questions...");
    const questions = [
      { csv_column: 'name', question_text: 'Full Name', question_type: 'text', section: 'Identity' },
      { csv_column: 'phone', question_text: 'Phone Number', question_type: 'text', section: 'Identity' },
      { csv_column: 'business_name', question_text: 'Business Name', question_type: 'text', section: 'Identity' },
      { csv_column: 'gender', question_text: 'Gender', question_type: 'select', section: 'Identity' },
      { csv_column: 'age', question_text: 'Age', question_type: 'number', section: 'Identity' },
      { csv_column: 'employee_count', question_text: 'Employee Count', question_type: 'number', section: 'Employment' },
      { csv_column: 'new_hires_this_year', question_text: 'New Hires This Year', question_type: 'number', section: 'Employment' },
      { csv_column: 'business_type', question_text: 'Business Classification', question_type: 'select', section: 'Business Profile' },
      { csv_column: 'sells_own_products', question_text: 'Sells Own Products?', question_type: 'boolean', section: 'Business Profile' },
      { csv_column: 'export_ready', question_text: 'Export Ready?', question_type: 'boolean', section: 'Business Profile' },
      { csv_column: 'impact_rating', question_text: 'Program Impact Rating', question_type: 'number', section: 'Impact' },
      { csv_column: 'business_growth_narrative', question_text: 'Business Growth Narrative', question_type: 'text', section: 'Impact' }
    ];

    const { data: existingQuestions, error: qError } = await supabase.from('survey_questions').select('*');
    if (qError) throw qError;

    let qMap = {};
    for (const q of existingQuestions) {
      qMap[q.csv_column] = q.id;
    }

    for (const q of questions) {
      if (!qMap[q.csv_column]) {
        const secId = sectionMap[q.section];
        const { error: qInsError } = await supabase
          .from('survey_questions')
          .insert({
            form_id: formId,
            section_id: secId,
            csv_column: q.csv_column,
            question_text: q.question_text,
            question_type: q.question_type,
            is_required: true
          });
        if (qInsError) {
          console.error(`Failed to insert question "${q.csv_column}":`, qInsError.message);
        } else {
          console.log(`Created question: ${q.csv_column}`);
        }
      }
    }

    console.log("Seeding completed!");
  } catch (err) {
    console.error("Seeding error:", err);
  }
}

check();
