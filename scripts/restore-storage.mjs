import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline/promises';

const targetUrl = process.env.TARGET_SUPABASE_URL;
const targetKey = process.env.TARGET_SUPABASE_SERVICE_ROLE_KEY;

if (!targetUrl || !targetKey) {
  console.error('Error: TARGET_SUPABASE_URL and TARGET_SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const sourceDir = process.argv[2] || process.env.STORAGE_BACKUP_DIR || path.join('backups', 'storage');

if (!fs.existsSync(sourceDir)) {
  console.error(`Error: storage backup directory not found: ${sourceDir}`);
  process.exit(1);
}

const supabase = createClient(targetUrl, targetKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const mimeTypes = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.zip': 'application/zip',
};

function contentTypeFor(file) {
  return mimeTypes[path.extname(file).toLowerCase()] || 'application/octet-stream';
}

function walkFiles(dir, base, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, base, files);
    } else {
      files.push(path.relative(base, full));
    }
  }
  return files;
}

async function main() {
  if (process.env.FORCE !== '1') {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(
      `Restore storage from ${sourceDir} into TARGET_SUPABASE_URL. Type 'yes' to continue: `
    );
    rl.close();
    if (answer !== 'yes') {
      console.log('Aborted.');
      process.exit(1);
    }
  }

  const manifestPath = path.join(sourceDir, '_buckets.json');
  let manifest = [];
  if (fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  }

  const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;
  const existing = new Set((existingBuckets || []).map((bucket) => bucket.name));

  const bucketDirs = fs
    .readdirSync(sourceDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const stats = { buckets: 0, files: 0, errors: 0 };

  for (const bucketName of bucketDirs) {
    const config = manifest.find((bucket) => bucket.name === bucketName) || {};
    if (!existing.has(bucketName)) {
      const options = { public: Boolean(config.public) };
      if (config.file_size_limit) options.fileSizeLimit = config.file_size_limit;
      if (config.allowed_mime_types) options.allowedMimeTypes = config.allowed_mime_types;
      const { error } = await supabase.storage.createBucket(bucketName, options);
      if (error) {
        stats.errors += 1;
        console.error(`  Failed to create bucket ${bucketName}: ${error.message}`);
        continue;
      }
      console.log(`Created bucket: ${bucketName}`);
    } else {
      console.log(`Bucket exists: ${bucketName}`);
    }
    stats.buckets += 1;

    const base = path.join(sourceDir, bucketName);
    for (const relative of walkFiles(base, base, [])) {
      const objectPath = relative.split(path.sep).join('/');
      const buffer = fs.readFileSync(path.join(base, relative));
      const { error } = await supabase.storage.from(bucketName).upload(objectPath, buffer, {
        upsert: true,
        contentType: contentTypeFor(relative),
      });
      if (error) {
        stats.errors += 1;
        console.error(`  Failed ${bucketName}/${objectPath}: ${error.message}`);
        continue;
      }
      stats.files += 1;
      console.log(`  Uploaded ${bucketName}/${objectPath} (${buffer.length} bytes)`);
    }
  }

  console.log(
    `Storage restore complete: ${stats.buckets} bucket(s), ${stats.files} file(s), ${stats.errors} error(s).`
  );
  if (stats.errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error(`Storage restore failed: ${err.message}`);
  process.exit(1);
});
