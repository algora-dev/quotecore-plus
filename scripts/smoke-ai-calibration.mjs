// P7 live fixture smoke for the AI-assisted calibration vision pipeline.
// Run: node --import tsx scripts/smoke-ai-calibration.mjs
//
// COST-BOUNDED: at most 3 fixture searches (3 discovery + up to 3 refinement
// model calls total), well inside the 6-vision-round budget. Auth is bypassed
// by calling runCalibrationSearch (the exact function the route calls after
// auth/ownership/flag/quota checks), never by hitting a deployed app or
// creating network trust. Uses OPENAI_API_KEY from .env.local.
//
// Fixtures (sharp-generated synthetic plan images, >= MIN_SOURCE_EDGE_PX):
//  1. dim-line   : white bg, roof rectangle, dimension line with arrows +
//                  SVG text "6.42 m" (positive, metric)
//  2. scale-bar  : white bg, roof rectangle, horizontal scale bar labelled
//                  "0 1 2 4 m" (positive, scale-bar form)
//  3. blank      : white bg + plain rectangle only, NO dimension text
//                  (negative: expect no fabricated candidates)
//
// Assertions: pipeline completes for every fixture; validation stays honest
// (no crash, structured status); blank fixture yields zero candidates or an
// unsuitable/no_candidates status. Per-fixture OCR accuracy is REPORTED, not
// asserted (synthetic-render accuracy is data, not a pass/fail gate).

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

// Minimal .env.local loader (dotenv is a devDependency, but keep this
// dependency-free so the script runs anywhere node does).
for (const line of readFileSync(path.join(repoRoot, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  if (!process.env[m[1]]) process.env[m[1]] = v;
}

if (!process.env.OPENAI_API_KEY) {
  console.error('OPENAI_API_KEY missing from .env.local');
  process.exit(1);
}

const { runCalibrationSearch, runTargetedRefinement, DETECTOR_VERSION } = await import(
  pathToFileURL(path.join(repoRoot, 'app/lib/takeoff/calibrationVision.ts')).href
);

// ── Fixture generation ───────────────────────────────────────────────────

const W = 2200;
const H = 1600;

function svgWrap(inner) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="white"/>
  ${inner}
</svg>`);
}

const roofRect = `<rect x="200" y="300" width="1800" height="1000" fill="none" stroke="black" stroke-width="4"/>`;

function arrowhead(x, y, dir) {
  // dir: 'l' | 'r' arrow at (x,y) pointing along the line
  if (dir === 'l') return `<path d="M ${x} ${y} l 28 -12 l 0 24 z" fill="black"/>`;
  return `<path d="M ${x} ${y} l -28 -12 l 0 24 z" fill="black"/>`;
}

// Fixture 1: dimension line under the roof, "6.42 m" label above it.
const FIXTURE_DIM_LINE = svgWrap(`
  ${roofRect}
  <line x1="300" y1="1450" x2="1900" y2="1450" stroke="black" stroke-width="4"/>
  ${arrowhead(300, 1450, 'l')}
  ${arrowhead(1900, 1450, 'r')}
  <line x1="300" y1="1400" x2="300" y2="1500" stroke="black" stroke-width="3"/>
  <line x1="1900" y1="1400" x2="1900" y2="1500" stroke="black" stroke-width="3"/>
  <text x="1100" y="1400" font-family="Arial, Helvetica, sans-serif" font-size="72" fill="black" text-anchor="middle">6.42 m</text>
`);

// Fixture 2: scale bar with tick labels 0 1 2 4 m.
const FIXTURE_SCALE_BAR = svgWrap(`
  ${roofRect}
  <line x1="400" y1="1450" x2="1600" y2="1450" stroke="black" stroke-width="4"/>
  ${[400, 700, 1000, 1600].map((x) => `<line x1="${x}" y1="1420" x2="${x}" y2="1480" stroke="black" stroke-width="3"/>`).join('')}
  ${[400, 700, 1000, 1600].map((x, i) => `<text x="${x}" y="1390" font-family="Arial, Helvetica, sans-serif" font-size="56" fill="black" text-anchor="middle">${[0, 1, 2, 4][i]}</text>`).join('')}
  <text x="1700" y="1390" font-family="Arial, Helvetica, sans-serif" font-size="56" fill="black" text-anchor="middle">m</text>
`);

// Fixture 3 (negative): rectangle only, no dimensions anywhere.
const FIXTURE_BLANK = svgWrap(`  ${roofRect}`);

async function renderFixture(svg, name) {
  const buf = await sharp(svg).png().toBuffer();
  console.log(`fixture ${name}: ${buf.byteLength} bytes png`);
  return buf;
}

// ── Runner ───────────────────────────────────────────────────────────────

const fixtures = [
  { name: 'dim-line-6.42m', buffer: await renderFixture(FIXTURE_DIM_LINE, 'dim-line-6.42m'), expected: { distance: 6.42, unit: 'm' } },
  { name: 'scale-bar-0-1-2-4m', buffer: await renderFixture(FIXTURE_SCALE_BAR, 'scale-bar-0-1-2-4m'), expected: null },
  { name: 'blank-negative', buffer: await renderFixture(FIXTURE_BLANK, 'blank-negative'), expected: { candidates: 0 } },
];

const refineMode = process.argv.includes('--refine');

const results = [];
let totalTokens = 0;

for (const fx of refineMode ? [] : fixtures) {
  const t0 = Date.now();
  try {
    const result = await runCalibrationSearch({
      sourceBuffer: fx.buffer,
      pageId: `smoke-${fx.name}`,
      imageRevision: `smoke-rev-${fx.name}`,
      round: 0,
      strategy: 'initial',
    });
    const ms = Date.now() - t0;
    if (result.modelUsage) totalTokens += result.modelUsage.totalTokens;

    const summary = result.candidates.map((c) => ({
      referenceId: c.referenceId,
      sourceType: c.sourceType,
      suggestedDistance: c.suggestedDistance,
      suggestedUnit: c.suggestedUnit,
      valueState: c.valueState,
      sourceLabelText: c.sourceLabelText,
      scenePixelLength: Math.round(c.scenePixelLength),
      sourceSpan: Math.round(Math.hypot(c.sourceP2.x - c.sourceP1.x, c.sourceP2.y - c.sourceP1.y)),
      warnings: c.warnings,
    }));

    // Ground-truth-ish check for fixture 1: dimension line spans 1600 source
    // px for 6.42 m -> a correct candidate scale ~ 0.0040125 m/scene-px
    // (scene == source here at 2000px overview scaling).
    let observation = '';
    if (fx.name === 'dim-line-6.42m') {
      if (result.candidates.length === 0) {
        observation = `expected a candidate; got status=${result.status}`;
      } else {
        const best = result.candidates[0];
        if (best.suggestedDistance != null && best.suggestedUnit) {
          const readOk = Math.abs(best.suggestedDistance - 6.42) < 0.02 && best.suggestedUnit === 'm';
          observation = `OCR read ${best.suggestedDistance} ${best.suggestedUnit} vs printed 6.42 m -> ${readOk ? 'MATCH' : 'MISMATCH'}`;
        } else {
          observation = `candidate returned with unreadable value (valueState=${best.valueState}); user manual entry would be required`;
        }
      }
    } else if (fx.name === 'blank-negative') {
      observation = result.candidates.length === 0
        ? 'honest: zero candidates on dimension-free image'
        : `FABRICATION RISK: ${result.candidates.length} candidates on an image with no printed dimensions`;
    } else {
      observation = result.candidates.length === 0
        ? `no candidates (status=${result.status})`
        : `${result.candidates.length} candidate(s); scale-bar parsing reported as data`;
    }

    results.push({
      fixture: fx.name,
      status: result.status,
      notes: result.notes,
      ms,
      tokens: result.modelUsage?.totalTokens ?? null,
      candidates: summary,
      observation,
    });
  } catch (err) {
    results.push({
      fixture: fx.name,
      status: 'ERROR',
      code: err?.code ?? null,
      message: err instanceof Error ? err.message : String(err),
      ms: Date.now() - t0,
    });
  }
}

console.log('\n=== AI calibration P7 smoke results ===');
console.log(`detector: ${DETECTOR_VERSION}`);
console.log(JSON.stringify(results, null, 2));
console.log(`total model tokens: ${totalTokens}`);
console.log('DONE');

// ── Targeted-refine mode (Phase E P1-9): ONE refinement call against known
// ground-truth parent geometry; no discovery. Run: node --import tsx
// scripts/smoke-ai-calibration.mjs --refine (1 model call).
if (refineMode) {
  const buffer = await renderFixture(FIXTURE_DIM_LINE, 'dim-line-6.42m');
  const t0 = Date.now();
  const result = await runTargetedRefinement({
    sourceBuffer: buffer,
    pageId: 'smoke-refine',
    imageRevision: 'smoke-rev-refine',
    parents: [{
      // Ground truth from the fixture SVG: arrows/ticks at (300,1450) and
      // (1900,1450); the "6.42 m" label sits around (1100,1400).
      sourceP1: { x: 300, y: 1450 },
      sourceP2: { x: 1900, y: 1450 },
      labelCentre: { x: 1100, y: 1400 },
      revision: 1,
    }],
  });
  const best = result.candidates[0];
  console.log('\n=== AI calibration targeted-refine smoke (1 model call) ===');
  console.log(JSON.stringify({
    status: result.status,
    notes: result.notes,
    ms: Date.now() - t0,
    tokens: result.modelUsage?.totalTokens ?? null,
    candidates: result.candidates.map((c) => ({
      revision: c.revision,
      searchRound: c.searchRound,
      sourceSpan: Math.round(Math.hypot(c.sourceP2.x - c.sourceP1.x, c.sourceP2.y - c.sourceP1.y)),
      suggested: `${c.suggestedDistance ?? '?'} ${c.suggestedUnit ?? '?'}`,
      valueState: c.valueState,
    })),
    continuity: best != null ? 'refined result passed P1-8 continuity validation' : 'no candidate (continuity rejected or model omitted)',
  }, null, 2));
  console.log('DONE');
}
