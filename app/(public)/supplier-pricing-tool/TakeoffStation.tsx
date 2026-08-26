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

const SEMANTIC_TO_GROUP: Record<string, GroupKey> = {
  ridge: 'ridges',
  hip: 'hips',
  valley: 'valleys',
  barge: 'barges',
  spouting: 'spouting',
  gutter: 'spouting',
};

/** Map workstation output -> Measurement Set. Workstation values are final
 *  (pitch already applied where relevant), so entryPath = 'measure' with no
 *  further conversion downstream. */
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
    const key = SEMANTIC_TO_GROUP[cg.semantic ?? ''];
    if (!key) continue;
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
  return set;
}

/** Stage header for the takeoff step - clearer than the step counter alone. */
export function TakeoffStageHeader({ planName }: { planName: string }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-2.5">
        <span className="rounded-full bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white">Digital Takeoff</span>
        <span className="text-sm font-semibold text-slate-900">Measure your plan</span>
        <span className="hidden md:inline text-xs text-slate-400 truncate max-w-[240px]">{planName}</span>
      </div>
      <span className="text-xs text-slate-400">Calibrate first, then draw areas and lines</span>
    </div>
  );
}

export function TakeoffStation({ planUrl, planName, onFinish }: {
  planUrl: string;
  planName: string;
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
        components={[]}
        collections={[]}
        hydrationData={null}
        demoMode="upload"
        preferredLengthUnit="meters"
        onFinish={(payload: DemoFinishPayload) => onFinish(mapTakeoffPayload(payload))}
      />
    </div>
  );
}
