// Fix mojibake in .ts/.tsx files
// These are "double-encoded" mojibake: UTF-8 bytes interpreted as Windows-1252, then re-encoded as UTF-8.
// Each pattern is the actual Unicode code points stored in the file.
const fs = require('fs');
const path = require('path');

const patterns = [
  // âˆ’ (U+00E2 U+02C6 U+2019) → − (U+2212 MINUS SIGN)
  { bad: '\u00e2\u02c6\u2019', good: '\u2212' },
  // ðŸ" (U+00F0 U+0178 U+201C U+0090) → 📐 (U+1F4D0 TRIANGULAR RULER)
  { bad: '\u00f0\u0178\u201c\u0090', good: '\uD83D\uDCD0' },
  // ðŸ" (U+00F0 U+0178 U+201C U+0090) → 📌 (U+1F4CC PUSHPIN) - alternate
  { bad: '\u00f0\u0178\u201c\u009e', good: '\uD83D\uDCCD' },
  // â†' (U+00E2 U+2020 U+2019) → → (U+2192 RIGHT ARROW)
  { bad: '\u00e2\u2020\u2019', good: '\u2192' },
  // â€" (U+00E2 U+20AC U+201D) → — (U+2014 EM DASH)
  { bad: '\u00e2\u20ac\u201d', good: '\u2014' },
  // â€" (U+00E2 U+20AC U+2013) → – (U+2013 EN DASH)  
  { bad: '\u00e2\u20ac\u2013', good: '\u2013' },
  // â€œ (U+00E2 U+20AC U+009C) → " (U+201C LEFT DOUBLE QUOTATION MARK)
  { bad: '\u00e2\u20ac\u009c', good: '\u201C' },
  // â€\u009d (U+00E2 U+20AC U+009D) → " (U+201D RIGHT DOUBLE QUOTATION MARK)
  { bad: '\u00e2\u20ac\u009d', good: '\u201D' },
  // â€¦ (U+00E2 U+20AC U+00A6) → … (U+2026 HORIZONTAL ELLIPSIS)
  { bad: '\u00e2\u20ac\u00a6', good: '\u2026' },
  // â€¢ (U+00E2 U+20AC U+00A2) → • (U+2022 BULLET)
  { bad: '\u00e2\u20ac\u00a2', good: '\u2022' },
  // Â£ (U+00C2 U+00A3) → £ (U+00A3 POUND SIGN)
  { bad: '\u00c2\u00a3', good: '\u00a3' },
  // Â° (U+00C2 U+00B0) → ° (U+00B0 DEGREE SIGN)
  { bad: '\u00c2\u00b0', good: '\u00b0' },
  // Â² (U+00C2 U+00B2) → ² (U+00B2 SUPERSCRIPT TWO)
  { bad: '\u00c2\u00b2', good: '\u00b2' },
  // Â³ (U+00C2 U+00B3) → ³ (U+00B3 SUPERSCRIPT THREE)
  { bad: '\u00c2\u00b3', good: '\u00b3' },
];

const skipDirs = new Set(['node_modules', '.next', '.git', 'dist', 'build']);

function scanDir(dir) {
  const results = [];
  function walk(d) {
    const entries = fs.readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(d, entry.name);
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        walk(fullPath);
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        let hasIssue = false;
        let fixed = content;
        for (const { bad, good } of patterns) {
          if (content.includes(bad)) {
            hasIssue = true;
            fixed = fixed.split(bad).join(good);
          }
        }
        if (hasIssue) {
          results.push({ file: fullPath });
          fs.writeFileSync(fullPath, fixed, 'utf8');
        }
      }
    }
  }
  walk(dir);
  return results;
}

const results = scanDir('.');
console.log(`Fixed ${results.length} files:`);
for (const r of results) {
  console.log(`  ${r.file}`);
}
if (results.length === 0) {
  console.log('No mojibake found.');
}
