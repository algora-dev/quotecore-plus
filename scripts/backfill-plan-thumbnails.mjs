// Backfill job-list plan thumbnails (owner 2026-11-19).
//
// Iterates quote_files rows with file_type='plan' AND thumb_path IS NULL,
// generates a 240px JPEG preview into the thumbs/ prefix of the same
// QUOTE-DOCUMENTS bucket, and sets thumb_path. Image mimes only; non-image
// plans (PDFs etc.) are skipped and counted.
//
// IMPORTANT (memory/CREDENTIALS.md): the SUPABASE_SERVICE_ROLE_KEY in
// .env.local belongs to the DELETED old project. The live service key is
// fetched in-memory via the Management API and never persisted.
//
// Idempotent: safe to run any number of times (rows with thumb_path set are
// skipped). Runs in passes so rows updated mid-run can never be skipped.
//
// Usage (from projects/quotecore-plus):
//   node scripts/backfill-plan-thumbnails.mjs            # real run
//   node scripts/backfill-plan-thumbnails.mjs --dry-run  # counts only

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const DRY_RUN = process.argv.includes('--dry-run');
const PROJECT_ID = 'bcqrrrvbzlfmfgvotzqw';
const SUPABASE_URL = `https://${PROJECT_ID}.supabase.co`;
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  console.error('FATAL: SUPABASE_ACCESS_TOKEN not set (user-scope env var)');
  process.exit(1);
}

// Fetch the LIVE service_role key in-memory (legacy keys; never persisted).
const keysRes = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_ID}/api-keys`, {
  headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
});
if (!keysRes.ok) {
  console.error('FATAL: api-keys fetch failed:', keysRes.status, await keysRes.text());
  process.exit(1);
}
const keys = await keysRes.json();
const serviceKey = (Array.isArray(keys) ? keys : keys?.data ?? [])
  .find((k) => k.name === 'service_role')?.api_key;
if (!serviceKey) {
  console.error('FATAL: service_role key not found in api-keys response');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const BUCKET = 'QUOTE-DOCUMENTS';
const PAGE = 200;

function thumbPathOf(p) {
  const i = p.lastIndexOf('/');
  const dir = i === -1 ? '' : p.slice(0, i);
  const base = i === -1 ? p : p.slice(i + 1);
  const stem = base.replace(/\.[^.]+$/, '') || base;
  return `${dir ? dir + '/' : ''}thumbs/${stem}.jpg`;
}

let done = 0;
let skippedNonImage = 0;
let failed = 0;

// Passes: each pass grabs the first PAGE null-thumb plan rows, processes
// them, then re-queries. Rows that gained a thumb drop out of the filter.
for (;;) {
  const { data: rows, error } = await admin
    .from('quote_files')
    .select('id, storage_path, mime_type')
    .eq('file_type', 'plan')
    .is('thumb_path', null)
    .order('uploaded_at', { ascending: true })
    .range(0, PAGE - 1);
  if (error) {
    console.error('FATAL: query failed:', error.message);
    process.exit(1);
  }
  if (!rows.length) break;

  for (const row of rows) {
    const mime = row.mime_type || '';
    if (!mime.startsWith('image/') || mime === 'image/svg+xml') {
      skippedNonImage++;
      continue;
    }
    if (DRY_RUN) {
      done++;
      continue;
    }
    try {
      const dl = await admin.storage.from(BUCKET).download(row.storage_path);
      if (dl.error) throw new Error(dl.error.message);
      const buf = Buffer.from(await dl.data.arrayBuffer());
      const thumb = await sharp(buf, { failOn: 'none' })
        .rotate()
        .resize({ width: 240, withoutEnlargement: true })
        .jpeg({ quality: 78 })
        .toBuffer();
      const tp = thumbPathOf(row.storage_path);
      const up = await admin.storage
        .from(BUCKET)
        .upload(tp, thumb, { contentType: 'image/jpeg', upsert: true });
      if (up.error) throw new Error(up.error.message);
      const upd = await admin.from('quote_files').update({ thumb_path: tp }).eq('id', row.id);
      if (upd.error) throw new Error(upd.error.message);
      done++;
      console.log(`[ok] ${row.storage_path} -> ${tp}`);
    } catch (err) {
      failed++;
      console.error(`[fail] ${row.storage_path}: ${err.message}`);
    }
  }

  if (rows.length < PAGE) break; // final partial page
}

console.log(
  `backfill complete: ${done} thumbnails${DRY_RUN ? ' (dry-run)' : ''}, ` +
  `${skippedNonImage} non-image skipped, ${failed} failed`,
);
