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

fetch(url, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
})
.then(res => res.json())
.then(data => {
  fs.writeFileSync('raw_schema.json', JSON.stringify(data, null, 2));
  console.log("Keys in root:", Object.keys(data));
  console.log("Paths available:", Object.keys(data.paths || {}));
})
.catch(err => {
  console.error(err);
});
