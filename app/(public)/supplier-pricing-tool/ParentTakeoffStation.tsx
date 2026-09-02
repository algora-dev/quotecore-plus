// Parent-model takeoff station (cladding / flooring). Same workstation,
// trade-aware via quote.trade (getTradeLabels drives labels + no pitch
// gating). Components are created in-session by the user - each component
// IS a parent area group (one product type). Payload maps into a ParentJob:
// area / length-x-height components -> parents + entries; lineal / count
// components -> custom components (trims etc.).

'use client';

import dynamic from 'next/dynamic';
import type { DemoFinishPayload } from './TakeoffWorkstation';
import type { ParentJob } from './types';
import { emptyParentJob, makeId } from './types';
import type { Trade } from './tradeConfig';

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

/** Component measurement types that produce wall/floor AREAS. */
function isAreaType(mt: string | undefined): boolean {
  const t = (mt ?? '').toLowerCase();
  return t === 'area'
    || t === 'irregular_area'
    || t.includes('lxh')
    || t.includes('length_x_height');
}

/** Map workstation output -> ParentJob. Measurement values are final m2
 *  (length x height freestyle entries are already multiplied + metric). */
function mapParentPayload(p: DemoFinishPayload): ParentJob {
  const job = emptyParentJob();
  for (const cg of p.componentGroups) {
    if (!cg.name) continue;
    const mt = (cg.measurementType ?? '').toLowerCase();
    if (isAreaType(cg.measurementType)) {
      const parent = { id: makeId('parent'), name: cg.name };
      job.parents.push(parent);
      cg.measurements.forEach((m, i) => {
        if (!(m.value > 0)) return;
        job.entries.push({
          id: makeId('pe'),
          parentId: parent.id,
          label: `${cg.name} ${i + 1}`,
          value: Math.round(m.value * 1000) / 1000,
          quantity: 1,
        });
      });
      // skip empty parents (component created but never measured)
      if (!job.entries.some(e => e.parentId === parent.id)) {
        job.parents = job.parents.filter(x => x.id !== parent.id);
      }
    } else {
      // Trims / counts -> custom components (self-priced on the custom step)
      const basis = mt === 'quantity' || mt === 'point' ? 'count' : 'lineal';
      const qty = cg.measurements.reduce((s, m) => s + m.value, 0) || cg.total || cg.count;
      if (qty > 0) {
        job.customComponents.push({
          id: makeId('cc'),
          name: cg.name,
          basis: basis as 'count' | 'lineal',
          quantity: Math.round(qty * 1000) / 1000,
          unitPrice: 0,
          labourRate: 0,
        });
      }
    }
  }
  return job;
}

export function ParentTakeoffStation({ trade, planUrl, onFinish }: {
  trade: Trade;
  planUrl: string;
  onFinish: (job: ParentJob) => void;
}) {
  return (
    <div className="w-[125%] -ml-[12.5%] space-y-3">
      <Workstation
        workspaceSlug="supplier-demo"
        quote={{
          id: 'supplier-tool',
          quote_number: 'SUP-1',
          measurement_system: 'metric',
          trade,
        } as never}
        planUrl={planUrl}
        components={[]}
        collections={[]}
        hydrationData={null}
        demoMode="upload"
        preferredLengthUnit="meters"
        onFinish={(payload: DemoFinishPayload) => onFinish(mapParentPayload(payload))}
      />
    </div>
  );
}
