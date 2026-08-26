// In-tool digital takeoff station. Borrows the workstation component the
// takeoff demo uses (same Fabric canvas + measuring UX) - the user never
// leaves the supplier pricing tool. Finished measurements map into the
// shared Measurement Set and flow into the same pricing steps.

'use client';

import dynamic from 'next/dynamic';
import type { DemoFinishPayload } from '@/app/(marketing)/takeoff-demo/DemoWorkstation';
import { DEMO_QUOTE, DEMO_COMPONENTS, DEMO_COLLECTIONS } from '@/app/(marketing)/takeoff-demo/demo-data/baseline';
import type { GroupKey, MeasurementSet } from './types';
import { emptyMeasurementSet, GROUP_DEFS, makeId } from './types';

const Workstation = dynamic(
  () => import('@/app/(marketing)/takeoff-demo/DemoWorkstation').then(mod => ({ default: mod.DemoWorkstation })),
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
  // Default labels for unlabelled entries
  for (const def of GROUP_DEFS) {
    if (def.key === 'roofAreas') continue;
    set.groups[def.key].entries = set.groups[def.key].entries.map((e, i) => ({
      ...e,
      label: e.label || `${def.singular} ${i + 1}`,
    }));
  }
  return set;
}

export function TakeoffStation({ planUrl, onFinish }: {
  planUrl: string;
  onFinish: (set: MeasurementSet) => void;
}) {
  return (
    <div className="space-y-3">
      <Workstation
        workspaceSlug="supplier-demo"
        quote={DEMO_QUOTE as never}
        planUrl={planUrl}
        components={DEMO_COMPONENTS}
        collections={DEMO_COLLECTIONS}
        hydrationData={null}
        demoMode="manual"
        onFinish={(payload: DemoFinishPayload) => onFinish(mapTakeoffPayload(payload))}
      />
    </div>
  );
}
