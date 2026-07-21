const fs = require('fs');
const schema = JSON.parse(fs.readFileSync('full_schema.json', 'utf8'));

const targets = ['vendors', 'walkins', 'survey_responses', 'market_days', 'vendor_registrations'];

targets.forEach(t => {
  console.log(`\nTable: ${t}`);
  if (schema[t]) {
    const props = schema[t].properties || {};
    Object.keys(props).forEach(p => {
      console.log(`  - ${p}: ${props[p].type} (${props[p].format || ''})`);
    });
  } else {
    console.log("  Not found in schema definitions.");
  }
});
