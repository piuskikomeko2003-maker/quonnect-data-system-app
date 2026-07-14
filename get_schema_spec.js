const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`;
const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

console.log("Fetching schema from:", url);

fetch(url, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
})
.then(res => res.json())
.then(data => {
  console.log("Exposed Tables:");
  const definitions = data.definitions || {};
  Object.keys(definitions).forEach(tableName => {
    console.log(`\nTable: ${tableName}`);
    const properties = definitions[tableName].properties || {};
    Object.keys(properties).forEach(propName => {
      console.log(`  - ${propName}: ${properties[propName].type}`);
    });
  });
})
.catch(err => {
  console.error("Failed to fetch schema:", err);
});
