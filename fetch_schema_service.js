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
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

console.log("Using key prefix:", key ? key.substring(0, 10) : "undefined");

fetch(url, {
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
})
.then(res => res.json())
.then(data => {
  if (data.definitions) {
    console.log("SUCCESS. Tables found:", Object.keys(data.definitions));
    fs.writeFileSync('full_schema.json', JSON.stringify(data.definitions, null, 2));
  } else {
    console.log("Failed. Response:", data);
  }
})
.catch(err => {
  console.error(err);
});
