// Generic Trades Phase 6 regression — static grep for the central
// trade-compat helper (Gerald round-2 M-03).
//
// Walks every server-action file under `app/` and asserts that any file
// containing INSERT or UPSERT against `quote_components` ALSO imports
// `assertComponentCompatibleWithQuote` from `@/app/lib/trades/assertCompatible`.
//
// This is a static guard: it catches a regression at PR time, not at
// runtime. Adding a new attach path without calling the helper trips this
// test in CI.
//
// Run from projects/quotecore-plus:
//   node scripts/test-trade-helper-imports.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = 'app';
const HELPER_IMPORT_PATTERN = /assertComponentCompatibleWithQuote/;
const QUOTE_COMPONENTS_WRITE_PATTERNS = [
  /\.from\(['"]quote_components['"]\)\s*\.insert\b/,
  /\.from\(['"]quote_components['"]\)\s*\.upsert\b/,
  // Catch the chain split across newlines too.
  /\.from\(\s*['"]quote_components['"]\s*\)[^.]*\.insert\b/s,
];

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.next')) continue;
      out.push(...walk(full));
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(ROOT);
console.log(`[trade-helper-imports] scanning ${files.length} TS/TSX files under ${ROOT}/...`);

const violations = [];
const exemptions = new Set([
  // The pricing engine + central helper themselves never mutate
  // quote_components, but if a regex false-positive ever lands them here,
  // we exempt them explicitly. Empty for now.
]);

for (const file of files) {
  if (exemptions.has(file)) continue;
  const text = readFileSync(file, 'utf8');

  // Does this file INSERT or UPSERT into quote_components?
  const writesQc = QUOTE_COMPONENTS_WRITE_PATTERNS.some((p) => p.test(text));
  if (!writesQc) continue;

  // It does. Does it also import the helper?
  if (!HELPER_IMPORT_PATTERN.test(text)) {
    violations.push(file);
  } else {
    console.log(`  OK   ${file.replace(/\\/g, '/')}: writes quote_components AND imports assertComponentCompatibleWithQuote`);
  }
}

if (violations.length > 0) {
  console.error('---');
  console.error('FAIL: the following files INSERT/UPSERT into quote_components but do NOT import assertComponentCompatibleWithQuote:');
  for (const f of violations) console.error('  -', f.replace(/\\/g, '/'));
  console.error('');
  console.error('Round-2 M-03 enforcement: every quote_components mutation site must call');
  console.error('assertComponentCompatibleWithQuote() before the write. Inline trade checks');
  console.error('are not allowed. See app/lib/trades/assertCompatible.ts.');
  process.exit(1);
}

console.log('---');
console.log('PASS: every quote_components write site imports assertComponentCompatibleWithQuote (or no write sites found).');
process.exit(0);
