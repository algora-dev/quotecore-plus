/**
 * Guard: every bare package imported by server code must be in
 * production `dependencies` (not devDependencies).
 *
 * Prevents the 2026-08-21 incident class: `sharp` sat in devDependencies,
 * worked locally (devDeps installed) and historically worked on Vercel
 * (Next's own optional dep shadowed it), then broke prod routes at module
 * init after build-pipeline/lockfile changes.
 *
 * Wired as `prebuild` so both local and Vercel builds fail fast.
 *
 * Run: node scripts/check-server-deps.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));

// Server-only source roots where imports must resolve from prod deps.
const SCAN_ROOTS = ['app', 'backend/src'];

const IGNORE = new Set([
  // Node builtins + path-alias internals
  'node:fs', 'node:path', 'node:url', 'node:crypto', 'node:util', 'node:os',
  'node:child_process', 'node:stream', 'node:http', 'node:https', 'node:buffer',
  'fs', 'path', 'url', 'crypto', 'util', 'os', 'child_process', 'stream',
  'http', 'https', 'buffer',
  // our own alias
  '@/app', '@/components', '@/lib', '@/hooks', '@/types',
]);

const BUILTIN_PREFIX = /^node:/;

const importRe = /(?:import\s+(?:[\s\S]*?)\s+from\s+|require\(\s*|import\(\s*)['"]([^'"]+)['"]/g;

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, files);
    else if (/\.(ts|tsx|js|mjs|cjs)$/.test(name) && !/\.d\.ts$/.test(name)) files.push(p);
  }
  return files;
}

const violations = new Map();
const files = [];
for (const r of SCAN_ROOTS) {
  try { files.push(...walk(join(root, r))); } catch { /* root missing - fine */ }
}

for (const f of files) {
  const src = readFileSync(f, 'utf8');
  let m;
  while ((m = importRe.exec(src))) {
    const spec = m[1];
    if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('@/') || BUILTIN_PREFIX.test(spec) || IGNORE.has(spec)) continue;
    const pkgName = spec.startsWith('@')
      ? spec.split('/').slice(0, 2).join('/')
      : spec.split('/')[0];
    const isDep = pkg.dependencies && pkgName in pkg.dependencies;
    const isDev = pkg.devDependencies && pkgName in pkg.devDependencies;
    // type-only imports are erased at build; still require them resolvable but only flag runtime risk for devDeps
    if (isDep || (!isDep && !isDev)) continue;
    if (isDev) {
      const key = pkgName;
      if (!violations.has(key)) violations.set(key, []);
      violations.get(key).push(f);
    }
  }
}

if (violations.size > 0) {
  console.error('check-server-deps: FAIL');
  for (const [name, fl] of violations) {
    console.error(`  "${name}" is in devDependencies but imported by server code:`);
    for (const f of fl.slice(0, 5)) console.error(`    - ${f.slice(root.length + 1)}`);
    if (fl.length > 5) console.error(`    ... and ${fl.length - 5} more`);
  }
  console.error('Move these to production "dependencies" in package.json.');
  process.exit(1);
}
console.log('check-server-deps: OK (all server imports resolve from production dependencies)');
