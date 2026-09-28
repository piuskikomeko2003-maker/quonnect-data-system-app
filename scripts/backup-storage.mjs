import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const contents = fs.readFileSync(file, 'utf8');
  for (const line of contents.split('\n')) {
    const parts = line.split('=');
    if (parts.length < 2) continue;
    const key = parts[0].trim();
    if (!key || key.startsWith('#')) continue;
    if (process.env[key] === undefined) process.env[key] = parts.slice(1).join('=').trim();
  }
}

loadEnvFile('.env.local');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const OUTPUT_DIR = process.env.STORAGE_BACKUP_DIR || path.join('backups', 'storage');

async function listAll(bucket, prefix) {
  const entries = [];
  const pageSize = 100;
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.storage.from(bucket).list(prefix, {
      limit: pageSize,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    if (!data || data.length === 0) break;
    entries.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return entries;
}

async function walk(bucket, prefix, stats) {
  const entries = await listAll(bucket, prefix);
  for (const entry of entries) {
    const objectPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) {
      await walk(bucket, objectPath, stats);
      continue;
    }
    const { data, error } = await supabase.storage.from(bucket).download(objectPath);
    if (error) {
      stats.errors += 1;
      console.error(`  Failed ${bucket}/${objectPath}: ${error.message}`);
      continue;
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    const target = path.join(OUTPUT_DIR, bucket, objectPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, buffer);
    stats.files += 1;
    console.log(`  Saved ${bucket}/${objectPath} (${buffer.length} bytes)`);
  }
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;

  const stats = { files: 0, errors: 0 };
  for (const bucket of buckets || []) {
    console.log(`Bucket: ${bucket.name}`);
    await walk(bucket.name, '', stats);
  }

  const manifest = (buckets || []).map((bucket) => ({
    name: bucket.name,
    public: bucket.public,
    file_size_limit: bucket.file_size_limit,
    allowed_mime_types: bucket.allowed_mime_types,
  }));
  fs.writeFileSync(path.join(OUTPUT_DIR, '_buckets.json'), JSON.stringify(manifest, null, 2));

  console.log(`Storage backup complete: ${stats.files} file(s), ${stats.errors} error(s).`);
  if (stats.errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error(`Storage backup failed: ${err.message}`);
  process.exit(1);
});
