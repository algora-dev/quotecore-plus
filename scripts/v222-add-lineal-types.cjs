// One-shot UTF-16 LE editor for app/lib/supabase/database.types.ts
// Adds sold_by + cover_width_mm to component_library Row/Insert/Update.
// File style: no semicolons, CRLF endings.
const fs = require('fs');
const P = require('path').join(__dirname, '..', 'app', 'lib', 'supabase', 'database.types.ts');
let raw = fs.readFileSync(P, 'utf16le');
const hadBom = raw.charCodeAt(0) === 0xFEFF;
if (hadBom) raw = raw.slice(1);
const start = raw.indexOf('    component_library: {');
if (start < 0) throw new Error('component_library table not found');
const open = raw.indexOf('{', start);
let depth = 0, end = -1;
for (let j = open; j < raw.length; j++) {
  if (raw[j] === '{') depth++;
  else if (raw[j] === '}') { depth--; if (depth === 0) { end = j; break; } }
}
if (end < 0) throw new Error('block end not found');
let block = raw.slice(start, end + 1);
const before = block;
// Row entries (required-style, no ?)
block = block.replace(/^(\s*)component_type: Database\["public"\]\["Enums"\]\["component_type"\]\r?$/m,
  (m, ind) => m + '\r\n' + ind + 'cover_width_mm: number | null');
block = block.replace(/^(\s*)sku: string \| null\r?$/m,
  (m, ind) => m + '\r\n' + ind + 'sold_by: string | null');
// Insert + Update entries (optional-style) - both occurrences
block = block.replace(/^(\s*)component_type\?: Database\["public"\]\["Enums"\]\["component_type"\]\r?$/gm,
  (m, ind) => m + '\r\n' + ind + 'cover_width_mm?: number | null');
block = block.replace(/^(\s*)sku\?: string \| null\r?$/gm,
  (m, ind) => m + '\r\n' + ind + 'sold_by?: string | null');
if (block === before) throw new Error('no replacements made');
const cov = (block.match(/cover_width_mm/g) || []).length;
const sold = (block.match(/sold_by/g) || []).length;
if (cov !== 3 || sold !== 3) throw new Error(`unexpected counts cover_width_mm=${cov} sold_by=${sold}`);
fs.writeFileSync(P, (hadBom ? '\uFEFF' : '') + raw.slice(0, start) + block + raw.slice(end + 1), 'utf16le');
console.log('OK: component_library types += sold_by + cover_width_mm (Row/Insert/Update)');
