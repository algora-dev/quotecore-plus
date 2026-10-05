// Direct probe: does applyAiResults tolerate scan1 (outline-only) data?
import { applyAiResults } from '../app/lib/takeoff/applyAiResults.ts';

const scan1Data = {
  roof_areas: [{ name: 'Main Roof', points: [{ x: 100, y: 100 }, { x: 500, y: 100 }, { x: 500, y: 400 }, { x: 100, y: 400 }], pitch_degrees: 25 }],
  notes: [],
};
const calibrations = [{ id: 'c1', point1: { x: 0, y: 0 }, point2: { x: 100, y: 0 }, pixelDistance: 100, actualDistance: 1, unit: 'meters', scale: 0.01 }];
const systemComponentIds = { ridges: 'r', hips: 'h', valleys: 'v', broken_hips: 'b', barges: 'bg', spouting: 's', uncertain: 'u' };
try {
  const out = applyAiResults({ aiData: scan1Data, calibrations, systemComponentIds, canvasWidth: 1000, canvasHeight: 800 });
  console.log('STAGE1 OK areas:', out.roofAreas.length, 'measurements:', out.measurements.length, 'dropped:', out.droppedCount);
} catch (e) {
  console.error('STAGE1 THREW:', e.message);
}

// Full (scan2+3) shape must still apply components incl. perimeter spouting.
const fullData = {
  ...scan1Data,
  components: {
    ridges: [{ points: [{ x: 100, y: 250 }, { x: 500, y: 250 }], label: 'RIDGE', value_m: 4 }],
    hips: [], valleys: [], broken_hips: [], barges: [], spouting: [], uncertain: [],
  },
};
try {
  const out = applyAiResults({ aiData: fullData, calibrations, systemComponentIds, canvasWidth: 1000, canvasHeight: 800 });
  const byKey = {};
  for (const m of out.measurements) byKey[m.semanticKey] = (byKey[m.semanticKey] ?? 0) + 1;
  console.log('FULL OK areas:', out.roofAreas.length, 'measurements:', out.measurements.length, JSON.stringify(byKey));
} catch (e) {
  console.error('FULL THREW:', e.message);
}
