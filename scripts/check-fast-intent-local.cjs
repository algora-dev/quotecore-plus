// Empirical check: does the shipped parseFastIntent match Shaun's exact test messages?
const { readFileSync } = require('fs');
let src = readFileSync('app/lib/smart-assistant/speed/intent.ts', 'utf8');
// Keep only from `const kinds` onward (skips the type definitions entirely).
const start = src.indexOf('const kinds');
if (start < 0) { console.log('ANCHOR NOT FOUND'); process.exit(1); }
let js = src.slice(start)
  .replace('const kinds: Record<string, EntityKind> =', 'const kinds =')
  .replace('export function parseFastIntent(raw: string): FastIntent | null {', 'function parseFastIntent(raw) {')
  .replace('let m: RegExpMatchArray | null;', 'let m;')
  .replace(/as CountRequest\['kind'\]/g, '');
js += '\nmodule.exports = { parseFastIntent };';
const mod = { exports: {} };
new Function('module', 'exports', js)(mod, mod.exports);
const msgs = [
  'Take me to my latest quote',
  "What's the total of my most recent quote?",
  'Which quote is worth the most?',
  'How many quotes did I create this month?',
  "What's the total ridge lineal metres across my quotes?",
  'who was the customer on that one',
  'What can you help me with?',
  'Delete all my draft quotes',
];
for (const m of msgs) {
  let r;
  try { r = JSON.stringify(mod.exports.parseFastIntent(m)); } catch (e) { r = 'ERR ' + e.message; }
  console.log(JSON.stringify(m), '=>', r === undefined ? 'null (model path)' : r);
}
