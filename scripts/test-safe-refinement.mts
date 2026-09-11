// Offline (zero-cost) regression tests for the Safe Refinement Phase A fixes:
// 1. undirected collinear merge (all four endpoint-order permutations merge)
// 2. snap endpoint-movement guard (8px max displacement)
// 3. T-junction-aware connectivity
// Run: node --experimental-strip-types scripts/test-safe-refinement.mts
import { filterAngleValid, validateConnectivity } from '../app/lib/takeoff/scan-engine.ts';
import { mergeArtificialCollinearSplits } from '../app/lib/takeoff/scanPostprocess.ts';

const L = (id: string, x1: number, y1: number, x2: number, y2: number) =>
  ({ id, start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, confidence: 0.5 });

let pass = 0, fail = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' - ' + detail : ''}`);
};

// ── 1. Undirected collinear merge: four endpoint-order permutations ──
// Two collinear segments meeting at (200,100): left (100,100)-(200,100) and
// right (200,100)-(300,100). All four orderings must merge identically.
const outline = [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }, { x: 0, y: 300 }];
const perms: Array<[string, { start: { x: number; y: number }, end: { x: number; y: number } }, { start: { x: number; y: number }, end: { x: number; y: number } }]> = [
  ['A-in B-out', L('A', 100, 100, 200, 100), L('B', 200, 100, 300, 100)],
  ['A-in B-in', L('A', 100, 100, 200, 100), L('B', 300, 100, 200, 100)],
  ['A-out B-out', L('A', 200, 100, 100, 100), L('B', 200, 100, 300, 100)],
  ['A-out B-in', L('A', 200, 100, 100, 100), L('B', 300, 100, 200, 100)],
];
for (const [name, a, b] of perms) {
  const { lines, merges } = mergeArtificialCollinearSplits([a, b], outline);
  check(`collinear merge [${name}]`, merges.length === 1 && lines.length === 1
    && lines[0].start.x === 100 && lines[0].end.x === 300);
}
// Negative: 5-degree bend does not merge
{
  const { merges } = mergeArtificialCollinearSplits(
    [L('A', 100, 100, 200, 100), L('B', 200, 100, 300, 108)], outline);
  check('collinear merge rejects 5-degree bend', merges.length === 0);
}
// Negative: real third branch at the join prevents merge
{
  const { merges } = mergeArtificialCollinearSplits(
    [L('A', 100, 100, 200, 100), L('B', 200, 100, 300, 100), L('C', 200, 100, 200, 200)], outline);
  check('collinear merge respects third branch', merges.length === 0);
}

// ── 2. Snap endpoint-movement guard ──
{
  // Short noisy near-45 line: endpoints move a few px -> snaps.
  const short = [L('S1', 70, 156, 130, 100)];
  const { valid } = filterAngleValid(short);
  // snapped to exactly 45deg (dx=59, dy=-42 -> angle ~44.6 -> snap moves ends < 8px)
  const s = valid[0];
  const snapped = Math.abs(Math.abs((s.end.y - s.start.y) / (s.end.x - s.start.x)) - 1) < 0.001;
  const moved = Math.hypot(s.start.x - 70, s.start.y - 156);
  check('short noisy near-canonical line snaps', snapped, `moved=${moved.toFixed(1)}px`);
}
{
  // Long line 4 degrees off vertical: rotation about midpoint would move each
  // endpoint ~28px -> guard must leave the original geometry untouched.
  const long = [L('L1', 205, 500, 233, 100)]; // ~4.1 deg off 90
  const { valid } = filterAngleValid(long);
  const l = valid[0];
  check('long off-canonical line kept unsnapped (movement > 8px)',
    l.start.x === 205 && l.start.y === 500 && l.end.x === 233 && l.end.y === 100);
}
{
  // Already-canonical line unchanged
  const exact = [L('E1', 50, 50, 350, 50)];
  const { valid } = filterAngleValid(exact);
  check('canonical line unchanged', valid[0].start.x === 50 && valid[0].end.x === 350);
}

// ── 3. T-junction-aware connectivity ──
{
  // Short spur ending at the MIDDLE of a long ridge = connected (T-junction)
  const { connected, floating } = validateConnectivity(
    [L('R1', 50, 200, 750, 200), L('T1', 400, 200, 400, 130)], outline);
  check('T-junction spur is connected', connected.some(l => l.id === 'T1') && !floating.some(l => l.id === 'T1'));
}
{
  // Isolated short line >10px from everything = still floating
  const { floating } = validateConnectivity([L('F1', 100, 40, 160, 40)], outline);
  check('isolated line remains floating', floating.some(l => l.id === 'F1'));
}
{
  // Endpoint-to-endpoint connection still works
  const { connected } = validateConnectivity(
    [L('A', 50, 250, 150, 250), L('B', 150, 250, 250, 250)], outline);
  check('endpoint-to-endpoint still connected', connected.length === 2);
}

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
