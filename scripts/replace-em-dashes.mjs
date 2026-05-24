// One-shot script: replace U+2014 (em-dash) with "-" across code & content.
// Skips node_modules, .next, .git, _bmad, build output, lockfiles, generated types.
// Run from repo root: node scripts/replace-em-dashes.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const EM_DASH = '\u2014';

const INCLUDE_DIRS = ['app', 'components', 'lib', 'content'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.mdx', '.md', '.css', '.json']);
const SKIP_FILES = new Set([
  'package-lock.json',
  'database.types.ts', // generated, don't touch
]);

let filesChanged = 0;
let totalReplacements = 0;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
      walk(full);
    } else if (entry.isFile()) {
      if (SKIP_FILES.has(entry.name)) continue;
      const ext = path.extname(entry.name);
      if (!EXTENSIONS.has(ext)) continue;
      const content = fs.readFileSync(full, 'utf8');
      if (!content.includes(EM_DASH)) continue;
      const count = (content.match(new RegExp(EM_DASH, 'g')) || []).length;
      const replaced = content.replace(new RegExp(EM_DASH, 'g'), '-');
      fs.writeFileSync(full, replaced, 'utf8');
      filesChanged++;
      totalReplacements += count;
      console.log(`  ${path.relative(ROOT, full)}: ${count}`);
    }
  }
}

for (const dir of INCLUDE_DIRS) {
  const full = path.join(ROOT, dir);
  if (fs.existsSync(full)) walk(full);
}

console.log(`\nDone. Files changed: ${filesChanged}, em-dashes replaced: ${totalReplacements}`);
