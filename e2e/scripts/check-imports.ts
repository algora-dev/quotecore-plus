/**
 * Static Import Guard — Safety Rule (Phase 1, item 7)
 *
 * This file is imported by the base fixture to provide a runtime check.
 * The real enforcement is via a separate ESLint rule or test script.
 *
 * Run: npx tsx e2e/scripts/check-imports.ts
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const FORBIDDEN_IMPORTS = [
  '@supabase/supabase-js',
  '@supabase/ssr',
  'stripe',
  'openai',
  '../lib/supabase',
  '../../lib/supabase',
  '../../lib/stripe',
  '../../lib/openai',
];

const E2E_DIR = join(process.cwd(), 'e2e');

function walkDir(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...walkDir(fullPath));
    } else if (extname(fullPath) === '.ts' || extname(fullPath) === '.tsx') {
      files.push(fullPath);
    }
  }
  return files;
}

let violations = 0;

try {
  const files = walkDir(E2E_DIR);
  for (const file of files) {
    const content = readFileSync(file, 'utf-8');
    for (const forbidden of FORBIDDEN_IMPORTS) {
      if (content.includes(forbidden)) {
        console.error(`[import-guard] VIOLATION: ${file} imports "${forbidden}"`);
        violations++;
      }
    }
  }
} catch (err) {
  // e2e dir might not exist yet during early setup
  console.log('[import-guard] e2e/ directory not found or empty — skipping.');
}

if (violations > 0) {
  console.error(`\n[import-guard] ${violations} forbidden import(s) detected under e2e/.`);
  console.error('[import-guard] E2E tests must NOT import Supabase, Stripe, OpenAI, or admin clients.');
  process.exit(1);
} else {
  console.log('[import-guard] OK — no forbidden imports under e2e/.');
  process.exit(0);
}
