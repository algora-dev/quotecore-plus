// Offline (zero-cost) validation of the stroke-style classifier.
// Generates synthetic plan snippets (solid, dashed, dotted, faint-solid lines)
// via sharp and checks classifyCandidateStrokeStyles against expectations.
// Run: node --experimental-strip-types scripts/test-stroke-style.mts
import sharp from 'sharp';
import { classifyCandidateStrokeStyles } from '../app/lib/takeoff/strokeStyle.ts';

const W = 600, H = 400;

// Lines (in a 600x400 canvas): x from 40..560
const CASES = [
  { id: 'L1', desc: 'thick solid', start: { x: 40, y: 40 }, end: { x: 560, y: 40 }, stroke: 'solid', expect: 'solid', width: 3, dash: null },
  { id: 'L2', desc: 'thin solid', start: { x: 40, y: 100 }, end: { x: 560, y: 100 }, stroke: 'solid', expect: 'solid', width: 2, dash: null },
  { id: 'L3', desc: 'classic dashed (10,6)', start: { x: 40, y: 160 }, end: { x: 560, y: 160 }, stroke: 'solid', expect: 'dashed', width: 3, dash: '10,6' },
  { id: 'L4', desc: 'dotted (2,6)', start: { x: 40, y: 220 }, end: { x: 560, y: 220 }, stroke: 'solid', expect: 'dashed', width: 3, dash: '2,6' },
  { id: 'L5', desc: 'dashed diagonal', start: { x: 40, y: 380 }, end: { x: 560, y: 260 }, stroke: 'solid', expect: 'dashed', width: 3, dash: '8,7' },
  { id: 'L6', desc: 'long-dash sparse (14,10)', start: { x: 40, y: 320 }, end: { x: 560, y: 320 }, stroke: 'solid', expect: 'dashed', width: 2, dash: '14,10' },
];

const parts = [`<rect width="${W}" height="${H}" fill="white"/>`];
for (const c of CASES) {
  parts.push(`<line x1="${c.start.x}" y1="${c.start.y}" x2="${c.end.x}" y2="${c.end.y}" stroke="black" stroke-width="${c.width}"${c.dash ? ` stroke-dasharray="${c.dash}"` : ''}/>`);
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${parts.join('')}</svg>`;
const buf = await sharp(Buffer.from(svg)).png().toBuffer();

const lines = CASES.map(c => ({ id: c.id, start: c.start, end: c.end, confidence: 0.5 }));
const result = await classifyCandidateStrokeStyles(buf, lines);

let pass = 0, fail = 0;
for (const c of CASES) {
  const e = result.get(c.id);
  const got = e?.style ?? '(none)';
  const ok = got === c.expect;
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${c.id} [${c.desc}] expect=${c.expect} got=${got} duty=${e?.dutyCycle} gapRuns=${e?.gapRuns} medianGap=${e?.medianGapPx} longestGap=${e?.longestGapPx} cv=${e?.gapRegularity}`);
}
console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
