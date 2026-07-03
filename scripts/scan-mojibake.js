// Scan takeoff files for mojibake (UTF-8 decoded as Windows-1252)
// Usage: node scripts/scan-mojibake.js
const fs = require('fs');
const path = require('path');

const targets = [
  'app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffWorkstation.tsx',
  'app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffPage.tsx',
  'app/lib/takeoff/useCanvasHistory.ts',
  'app/lib/takeoff/reconstructCanvas.ts',
  'app/lib/takeoff/reconstructTypes.ts',
  'app/lib/takeoff/tool-for-measurement-type.ts',
];

// Mojibake indicators: characters that shouldn't appear in clean UTF-8 source
// â (0xE2) prefix sequences, Â (0xC2) prefix sequences, Ã (0xC3) prefix,
// replacement char (0xFFFD), BOM (0xFEFF), and specific mojibake chars
const mojibakeChars = /[\u00c2\u00c3\u00e2\u00e3][\u0080-\u00bf\u2020\u2021\u2022\u2013\u2014\u2018\u2019\u201a\u201c\u201d\u201e\u2030\u2039\u203a\u00a0-\u00ff]|\u00ef\u00bf\u00bd|[\u2010-\u2015](?=[\u0080-\u00bf])|[\u00c2-\u00c3][\u0080-\u00bf]/;

// Also check for common mojibake substrings
const mojibakeSubstrings = ['â€', 'â†', 'âœ', 'â‰', 'â­', 'â¯', 'Â²', 'Â³', 'Â°', 'Â·', 'Ã‚', 'â€™', 'â€¦', 'â€"', 'â€"', 'â€¢', 'â–', 'â¶', 'â†'];

let totalHits = 0;

for (const rel of targets) {
  const full = path.join(process.cwd(), rel);
  if (!fs.existsSync(full)) {
    console.log(`SKIP (not found): ${rel}`);
    continue;
  }
  const content = fs.readFileSync(full, 'utf8');
  const lines = content.split('\n');
  let fileHits = 0;
  lines.forEach((line, i) => {
    let found = false;
    // Check regex
    if (mojibakeChars.test(line)) found = true;
    // Check substrings
    for (const sub of mojibakeSubstrings) {
      if (line.includes(sub)) { found = true; break; }
    }
    // Check for Â followed by a symbol
    if (/[\u00c2\u00c3][\u00a0-\u00ff\u2020-\u2026]/.test(line)) found = true;
    // Check for â followed by common mojibake second bytes
    if (/[\u00e2][\u0080-\u00bf\u2020-\u2026]/.test(line)) found = true;

    if (found) {
      fileHits++;
      totalHits++;
      const preview = line.trim().substring(0, 140);
      console.log(`${rel}:${i + 1}: ${preview}`);
    }
  });
  if (fileHits === 0) {
    console.log(`CLEAN: ${rel}`);
  }
}

console.log(`\nTotal mojibake lines: ${totalHits}`);
process.exit(totalHits > 0 ? 1 : 0);
