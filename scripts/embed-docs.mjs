/**
 * embed-docs.mjs — AI Assistant knowledge pipeline (Phase 0B)
 * ===========================================================
 *
 * Walks content/docs/*.mdx, strips frontmatter/MDX to text, chunks by heading
 * (~300-500 tokens with overlap), embeds via OpenAI text-embedding-3-small
 * (1536 dims), and upserts into the service-role-only `doc_chunks` table.
 *
 * Idempotent + incremental: each chunk carries a content_hash. We only embed
 * chunks whose hash changed, and we DELETE stale chunks for docs that were
 * removed/renamed or whose chunk count shrank (Gerald M-05).
 *
 * Usage:
 *   node scripts/embed-docs.mjs              # incremental
 *   node scripts/embed-docs.mjs --dry-run    # plan only, no API/DB writes
 *   node scripts/embed-docs.mjs --force      # re-embed everything
 *
 * Secrets come from .env.local (never committed): OPENAI_API_KEY,
 * NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOCS_ROOT = path.join(ROOT, 'content', 'docs');

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMS = 1536;
// Rough chunk sizing by characters (~4 chars/token => ~1600-2000 chars target).
const MAX_CHUNK_CHARS = 1800;

// --- env -------------------------------------------------------------------

function loadEnvLocal() {
  const p = path.join(ROOT, '.env.local');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      // Strip optional surrounding single/double quotes (Next.js does this too).
      let v = m[2];
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      process.env[m[1]] = v;
    }
  }
}
loadEnvLocal();

const OPENAI_API_KEY = (process.env.OPENAI_API_KEY || '').trim();
const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

if (!OPENAI_API_KEY || !SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'Missing env. Need OPENAI_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in .env.local'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// --- docs walking / chunking ----------------------------------------------

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.mdx')) out.push(full);
  }
  return out;
}

function toSlug(absPath) {
  const rel = path.relative(DOCS_ROOT, absPath).replace(/\\/g, '/');
  return rel === 'index.mdx' ? '' : rel.replace(/\.mdx$/, '');
}

/** Strip MDX/JSX noise to plain-ish text for embedding. */
function stripMdx(body) {
  return body
    .replace(/^import\s.+$/gm, '')
    .replace(/^export\s.+$/gm, '')
    .replace(/<[^>]+>/g, ' ') // JSX/HTML tags
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```/g, '')) // keep code text
    .replace(/\r/g, '');
}

/**
 * Split a doc body into heading-anchored chunks. Each chunk = a heading + its
 * prose, further split if it exceeds MAX_CHUNK_CHARS (with light overlap).
 */
function chunkDoc(body) {
  const text = stripMdx(body);
  const lines = text.split('\n');
  const sections = [];
  let current = { heading: '', lines: [] };

  for (const line of lines) {
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      if (current.lines.join('').trim()) sections.push(current);
      current = { heading: h[2].trim(), lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.join('').trim() || current.heading) sections.push(current);

  const chunks = [];
  for (const sec of sections) {
    const prose = sec.lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const full = (sec.heading ? `## ${sec.heading}\n` : '') + prose;
    if (full.length <= MAX_CHUNK_CHARS) {
      if (full.trim()) chunks.push({ heading: sec.heading, content: full.trim() });
      continue;
    }
    // Oversized section: split on paragraph boundaries with overlap.
    const paras = prose.split(/\n{2,}/);
    let buf = sec.heading ? `## ${sec.heading}\n` : '';
    for (const para of paras) {
      if ((buf + '\n\n' + para).length > MAX_CHUNK_CHARS && buf.trim()) {
        chunks.push({ heading: sec.heading, content: buf.trim() });
        buf = (sec.heading ? `## ${sec.heading} (cont.)\n` : '') + para;
      } else {
        buf += '\n\n' + para;
      }
    }
    if (buf.trim()) chunks.push({ heading: sec.heading, content: buf.trim() });
  }
  return chunks;
}

function hash(s) {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 32);
}
function approxTokens(s) {
  return Math.ceil(s.length / 4);
}

// --- OpenAI embeddings -----------------------------------------------------

async function embed(input) {
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`OpenAI embeddings HTTP ${r.status}: ${t.slice(0, 200)}`);
  }
  const j = await r.json();
  return { vectors: j.data.map((d) => d.embedding), tokens: j.usage.total_tokens };
}

// --- main ------------------------------------------------------------------

async function main() {
  const files = walk(DOCS_ROOT);
  console.log(`Found ${files.length} MDX docs under content/docs`);

  // Build desired chunk set.
  const desired = []; // { slug, section, heading, chunk_index, content, content_hash, token_count }
  for (const file of files) {
    const raw = fs.readFileSync(file, 'utf8');
    const { content: body } = matter(raw);
    const slug = toSlug(file);
    const section = slug.includes('/') ? slug.split('/')[0] : '';
    const chunks = chunkDoc(body);
    chunks.forEach((c, i) => {
      desired.push({
        slug,
        section,
        heading: c.heading,
        chunk_index: i,
        content: c.content,
        content_hash: hash(c.content),
        token_count: approxTokens(c.content),
      });
    });
  }
  console.log(`Computed ${desired.length} desired chunks`);

  // Existing chunks.
  const { data: existing, error: exErr } = await supabase
    .from('doc_chunks')
    .select('slug, chunk_index, content_hash');
  if (exErr) throw exErr;
  const existingMap = new Map(
    (existing ?? []).map((r) => [`${r.slug}#${r.chunk_index}`, r.content_hash])
  );
  const desiredKeys = new Set(desired.map((d) => `${d.slug}#${d.chunk_index}`));

  // Stale = exists in DB but not desired anymore.
  const stale = (existing ?? []).filter(
    (r) => !desiredKeys.has(`${r.slug}#${r.chunk_index}`)
  );

  // Changed/new = desired whose hash differs (or forced).
  const toEmbed = desired.filter((d) => {
    if (FORCE) return true;
    return existingMap.get(`${d.slug}#${d.chunk_index}`) !== d.content_hash;
  });

  console.log(
    `Plan: embed ${toEmbed.length} new/changed, delete ${stale.length} stale, ` +
      `${desired.length - toEmbed.length} unchanged.`
  );

  if (DRY_RUN) {
    console.log('--dry-run: no API calls or DB writes.');
    return;
  }

  // Embed in batches.
  let totalTokens = 0;
  const BATCH = 64;
  for (let i = 0; i < toEmbed.length; i += BATCH) {
    const batch = toEmbed.slice(i, i + BATCH);
    const { vectors, tokens } = await embed(batch.map((b) => b.content));
    totalTokens += tokens;
    const rows = batch.map((b, j) => ({
      slug: b.slug,
      section: b.section,
      heading: b.heading,
      chunk_index: b.chunk_index,
      content: b.content,
      token_count: b.token_count,
      content_hash: b.content_hash,
      embedding: vectors[j],
      updated_at: new Date().toISOString(),
    }));
    if (vectors[0]?.length !== EMBEDDING_DIMS) {
      throw new Error(`Unexpected embedding dims: ${vectors[0]?.length}`);
    }
    const { error: upErr } = await supabase
      .from('doc_chunks')
      .upsert(rows, { onConflict: 'slug,chunk_index' });
    if (upErr) throw upErr;
    console.log(`  upserted ${i + batch.length}/${toEmbed.length}`);
  }

  // Delete stale.
  for (const s of stale) {
    const { error } = await supabase
      .from('doc_chunks')
      .delete()
      .eq('slug', s.slug)
      .eq('chunk_index', s.chunk_index);
    if (error) throw error;
  }
  if (stale.length) console.log(`Deleted ${stale.length} stale chunks`);

  console.log(
    `Done. Embedded ${toEmbed.length} chunks (~${totalTokens} embedding tokens).`
  );
}

main().catch((e) => {
  console.error('embed-docs failed:', e.message);
  process.exit(1);
});
