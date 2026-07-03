// Fix all remaining mojibake in TakeoffWorkstation.tsx
// Run: node scripts/fix-mojibake-takeoff.js
const fs = require('fs');

const filePath = 'app/(auth)/[workspaceSlug]/quotes/[id]/takeoff/TakeoffWorkstation.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Exact mojibake sequences found in the file, mapped to correct Unicode:
const fixes = [
  // â”€ (box drawing horizontal) = e2 201d 20ac → ─ U+2500
  ['\u00e2\u201d\u20ac', '\u2500'],
  
  // â€" (em dash) = e2 20ac 201d → — U+2014
  ['\u00e2\u20ac\u201d', '\u2014'],
  
  // â€" (en dash) = e2 20ac 201c → – U+2013
  ['\u00e2\u20ac\u201c', '\u2013'],
  
  // â€™ (right single quote) = e2 20ac 2122 → ' U+2019
  ['\u00e2\u20ac\u2122', '\u2019'],
  
  // â€¦ (ellipsis) = e2 20ac a6 → … U+2026
  ['\u00e2\u20ac\u00a6', '\u2026'],
  
  // â†' (right arrow) = e2 2020 2019 → → U+2192
  ['\u00e2\u2020\u2019', '\u2192'],
  
  // â†<90> (left arrow) = e2 2020 90 → ← U+2190
  ['\u00e2\u2020\u0090', '\u2190'],
  
  // â†¶ (undo) = e2 2020 b6 → ↶ U+21B6
  ['\u00e2\u2020\u00b6', '\u21b6'],
  
  // â†· (redo) = e2 2020 b7 → ↷ U+21B7
  ['\u00e2\u2020\u00b7', '\u21b7'],
  
  // âœ" (check mark) = e2 153 201c → ✓ U+2713
  ['\u00e2\u2122\u201c', '\u2713'],  // variant 1
  ['\u00e2\u201c\u2122', '\u2713'],  // variant 2
  ['\u00e2\u2122\u201d', '\u2713'],  // variant 3
  
  // â‰ˆ (approximate) = e2 2030 2c6 → ≈ U+2248
  ['\u00e2\u2030\u02c6', '\u2248'],
  
  // Ã— (multiplication) = c3 97 → × U+00D7  
  ['\u00c3\u0097', '\u00d7'],
  
  // Warning sign variants if any remain
  ['\u00e2\u009a\u00a0\u00ef\u00b8\u008f', '\u26a0\ufe0f'],
  ['\u00e2\u009a\u00a0', '\u26a0'],
];

let totalFixes = 0;
for (const [bad, good] of fixes) {
  const parts = content.split(bad);
  if (parts.length > 1) {
    const count = parts.length - 1;
    content = parts.join(good);
    totalFixes += count;
    console.log(`Fixed ${count}x: ${JSON.stringify(bad)} → ${JSON.stringify(good)}`);
  }
}

fs.writeFileSync(filePath, content, 'utf8');
console.log(`\nTotal replacements: ${totalFixes}`);
console.log('Done.');
