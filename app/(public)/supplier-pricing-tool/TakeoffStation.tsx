// In-tool digital takeoff station. COPIED workstation component (the copy
// lives in this folder as TakeoffWorkstation.tsx, recoloured to the supplier
// pricing tool palette) - the user never leaves the tool. Upload mode forces
// the real calibration flow (point-to-point on a known dimension) before any
// measuring. Finished measurements map into the shared Measurement Set.

'use client';

import dynamic from 'next/dynamic';
import type { DemoFinishPayload } from './TakeoffWorkstation';
import type { GroupKey, MeasurementSet } from './types';
import { emptyMeasurementSet, GROUP_DEFS, makeId } from './types';

const Workstation = dynamic(
  () => import('./TakeoffWorkstation').then(mod => ({ default: mod.TakeoffWorkstation })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-[60vh] rounded-xl bg-slate-900 flex items-center justify-center">
        <div className="text-white text-sm">Loading measuring station...</div>
      </div>
    ),
  },
);

/** Component -> measurement group. Primary match is the component NAME
 *  (placeholder components carry no semantic field), semantic is fallback. */
function componentToGroup(name: string, semantic: string | null): GroupKey | null {
  const key = `${name} ${semantic ?? ''}`.toLowerCase();
  if (key.includes('ridge') && !key.includes('barge')) return 'ridges';
  if (key.includes('hip') && !key.includes('valley')) return 'hips';
  if (key.includes('valley')) return 'valleys';
  if (key.includes('barge')) return 'barges';
  // Downpipes are POINT-measured (counted) - their own group, never folded
  // into spouting (that caused 2x spouting entries).
  if (key.includes('downpipe')) return 'downpipes';
  if (key.includes('spout') || key.includes('gutter')) return 'spouting';
  return null;
}

/** Map workstation output -> Measurement Set. Workstation values are final
 *  (pitch already applied where relevant), so entryPath = 'measure' with no
 *  further conversion downstream. Roof areas keep their individual names and
 *  pitches so different products can be applied per area downstream.
 *  2026-08-30 fix: components that DON'T match a standard roofing group (e.g.
 *  custom components the user created in the takeoff stage) are no longer
 *  dropped - they map into customComponents so they flow through to the
 *  custom step and the output. */
function mapTakeoffPayload(p: DemoFinishPayload): MeasurementSet {
  const set = emptyMeasurementSet();
  set.entryPath = 'measure';
  set.groups.roofAreas.entries = p.roofAreas.map(ra => ({
    id: makeId('e'),
    label: ra.name || 'Roof Area',
    value: ra.area,
    quantity: 1,
    pitchDegrees: ra.pitch || undefined,
  }));
  for (const cg of p.componentGroups) {
    const key = componentToGroup(cg.name, cg.semantic);
    if (!key) {
      // Custom/unmatched component -> custom component (self-priced by the
      // user on the custom step; quantities carried from the measurements).
      const basis = cg.measurementType === 'area' ? 'area' : cg.measurementType === 'quantity' || cg.measurementType === 'point' ? 'count' : 'lineal';
      const qty = cg.measurements.reduce((s, m) => s + m.value, 0) || cg.total || cg.count;
      if (qty > 0 && cg.name) {
        set.customComponents.push({
          id: makeId('cc'),
          name: cg.name,
          basis,
          quantity: Math.round(qty * 1000) / 1000,
          unitPrice: 0,
          labourRate: 0,
        });
      }
      continue;
    }
    for (const m of cg.measurements) {
      set.groups[key].entries.push({ id: makeId('e'), label: '', value: m.value, quantity: 1 });
    }
  }
  for (const def of GROUP_DEFS) {
    if (def.key === 'roofAreas') continue;
    set.groups[def.key].entries = set.groups[def.key].entries.map((e, i) => ({
      ...e,
      label: e.label || `${def.singular} ${i + 1}`,
    }));
  }
  // TEMPORARY DEBUG (Shaun's troubleshooting round): log everything captured
  // at the takeoff boundary so we can verify persistence + downstream maths.
  if (typeof console !== 'undefined') {
    console.log('[supplier-tool] takeoff payload:', JSON.stringify(p, null, 2));
    console.log('[supplier-tool] mapped measurement set:', GROUP_DEFS.map(d => ({
      group: d.key,
      entries: set.groups[d.key].entries.map(e => ({ label: e.label, value: e.value, pitch: e.pitchDegrees ?? null })),
    })).filter(g => g.entries.length > 0));
  }
  return set;
}

/** Stage slug written to the URL hash so the user always knows where they are. */
export function stageSlug(step: number, entryMode: string | null, groupKey: string | null): string {
  if (step <= 1) return '#start';
  if (step === 2) return entryMode === 'measure' ? '#digital-takeoff' : '#measurements';
  return groupKey ? `#products-${groupKey}` : '#output';
}

/** Placeholder measurement components shown in the takeoff sidebar. These
 *  are measurement buckets only - real supplier products get applied to the
 *  measured groups in the pricing steps, per the product plan. */
const PLACEHOLDER_COMPONENTS = [
  { id: 'ph-ridge', name: 'Ridge', measurement_type: 'lineal', is_system: true, collection_id: 'tool-builtin' },
  { id: 'ph-hip', name: 'Hip', measurement_type: 'lineal', is_system: true, collection_id: 'tool-builtin' },
  { id: 'ph-valley', name: 'Valley', measurement_type: 'lineal', is_system: true, collection_id: 'tool-builtin' },
  { id: 'ph-barge', name: 'Barge', measurement_type: 'lineal', is_system: true, collection_id: 'tool-builtin' },
  { id: 'ph-spouting', name: 'Spouting', measurement_type: 'lineal', is_system: true, collection_id: 'tool-builtin' },
  { id: 'ph-downpipe', name: 'Downpipes', measurement_type: 'point', is_system: true, collection_id: 'tool-builtin' },
] as never;

export function TakeoffStation({ planUrl, onFinish }: {
  planUrl: string;
  onFinish: (set: MeasurementSet) => void;
}) {
  return (
    <div className="w-[125%] -ml-[12.5%] space-y-3">
      <Workstation
        workspaceSlug="supplier-demo"
        quote={{
          id: 'supplier-tool',
          quote_number: 'SUP-1',
          measurement_system: 'metric',
        } as never}
        planUrl={planUrl}
        components={PLACEHOLDER_COMPONENTS}
        collections={[]}
        hydrationData={null}
        demoMode="upload"
        preferredLengthUnit="meters"
        onFinish={(payload: DemoFinishPayload) => onFinish(mapTakeoffPayload(payload))}
      />
    </div>
  );
}
