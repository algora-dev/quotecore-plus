// Offline (zero-cost) validation of island micro-cluster removal.
// Synthetic roof: outline + real internal network + traced annotation boxes.
// Run: node --experimental-strip-types scripts/test-micro-clusters.mts
import { removeIslandMicroClusters } from '../app/lib/takeoff/scanPostprocess.ts';

// Outline: 1000x700 rectangle
const outline = [
  { x: 50, y: 50 }, { x: 1050, y: 50 }, { x: 1050, y: 750 }, { x: 50, y: 750 },
];

const L = (id: string, x1: number, y1: number, x2: number, y2: number) =>
  ({ id, start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, confidence: 0.5 });

const lines = [
  // Real network: long ridge + hips touching the outline / each other
  L('R1', 300, 400, 800, 400),          // long central ridge (kept)
  L('H1', 300, 400, 120, 170),          // hip to outline (kept)
  L('H2', 300, 400, 480, 700),          // hip to outline (kept)
  // Interior annotation box traced as 4 solid segments (island -> removed)
  L('B1', 600, 150, 650, 150),
  L('B2', 650, 150, 650, 190),
  L('B3', 650, 190, 600, 190),
  L('B4', 600, 190, 600, 150),
  // Edge-touching closed box (cycle -> removed)
  L('E1', 990, 100, 1030, 100),
  L('E2', 1030, 100, 1030, 140),
  L('E3', 1030, 140, 990, 140),
  L('E4', 990, 140, 990, 100),
  // Short spur hanging off the real network (kept - anchored to long line)
  L('S1', 500, 400, 530, 430),
];

const { lines: kept, removed } = removeIslandMicroClusters(lines, outline);
const keptIds = new Set(kept.map(l => l.id));

let pass = 0, fail = 0;
const expect = (id: string, shouldBeKept: boolean) => {
  const isKept = keptIds.has(id);
  const ok = isKept === shouldBeKept;
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'} ${id} expect=${shouldBeKept ? 'kept' : 'removed'} got=${isKept ? 'kept' : 'removed'}`);
};
['R1','H1','H2','S1'].forEach(id => expect(id, true));
['B1','B2','B3','B4','E1','E2','E3','E4'].forEach(id => expect(id, false));
console.log(`\nremoval reasons:`);
for (const r of removed) console.log(`  - ${r.reason}`);
console.log(`${pass} pass, ${fail} fail`);
process.exit(fail > 0 ? 1 : 0);
