// Parent-model takeoff station v2 (cladding / flooring). Same workstation,
// trade-aware via quote.trade. Sidebar buckets = areas created NAME-ONLY
// (no drawing); three placeholder components (Wall Area / Wall Length /
// Wall Item) attach per bucket and carry the measurements. Payload maps
// into the v2 ParentJob: buckets from areas, components per
// (bucket, component) pair via the measurement's area stamp.

'use client';

import dynamic from 'next/dynamic';
import type { DemoFinishPayload } from './TakeoffWorkstation';
import type { ParentJob, ParentBasis } from './types';
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

/** The three generic placeholder components - measurement buckets only;
 *  real products get applied per component at the next step. */
const PLACEHOLDER_COMPONENTS = [
  { id: 'ph-wall-area', name: 'Area', measurement_type: 'area', is_system: true, collection_id: 'tool-builtin' },
  { id: 'ph-wall-length', name: 'Single Length', measurement_type: 'lineal', is_system: true, collection_id: 'tool-builtin' },
  { id: 'ph-wall-item', name: 'Single Item', measurement_type: 'quantity', is_system: true, collection_id: 'tool-builtin' },
] as never;

function basisForMeasurementType(mt: string | undefined): ParentBasis {
  const t = (mt ?? '').toLowerCase();
  if (t === 'area' || t === 'irregular_area' || t.includes('lxh') || t.includes('length_x_height')) return 'area';
  if (t === 'quantity' || t === 'point') return 'point';
  return 'lineal';
}

/** Map workstation output -> ParentJob v2. Buckets come from the payload's
 *  areas (name only - drawn geometry ignored); each component group is split
 *  into per-bucket components using each measurement's quoteRoofAreaId
 *  (the bucket active at draw time). Values are final (LxH freestyle
 *  entries already length x height, metric). */
function mapParentPayload(p: DemoFinishPayload): ParentJob {
  const job = emptyParentJob();

  // Buckets from areas (workstation areas created name-only for these trades).
  const bucketByAreaId = new Map<string, string>();
  for (const ra of p.roofAreas) {
    const bucket = { id: makeId('bucket'), name: ra.name || 'Bucket' };
    job.parents.push(bucket);
    bucketByAreaId.set(ra.id, bucket.id);
  }
  const defaultBucketId = job.parents[0]?.id ?? null;

  for (const cg of p.componentGroups) {
    if (!cg.name) continue;
    // Split this component's measurements per bucket.
    const byBucket = new Map<string, typeof cg.measurements>();
    for (const m of cg.measurements) {
      const bucketId = (m.quoteRoofAreaId && bucketByAreaId.get(m.quoteRoofAreaId)) || defaultBucketId;
      if (!bucketId) continue;
      const list = byBucket.get(bucketId) ?? [];
      list.push(m);
      byBucket.set(bucketId, list);
    }
    for (const [bucketId, measurements] of byBucket) {
      const basis = basisForMeasurementType(cg.measurementType);
      const comp = { id: makeId('comp'), parentId: bucketId, name: cg.name, basis };
      let count = 0;
      measurements.forEach(m => {
        if (!(m.value > 0)) return;
        count++;
        job.entries.push({
          id: makeId('pe'),
          componentId: comp.id,
          label: `${cg.name} ${count}`,
          value: Math.round(m.value * 1000) / 1000,
          quantity: 1,
        });
      });
      if (count > 0) job.components.push(comp);
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
        components={PLACEHOLDER_COMPONENTS}
        collections={[]}
        hydrationData={null}
        demoMode="upload"
        preferredLengthUnit="meters"
        onFinish={(payload: DemoFinishPayload) => onFinish(mapParentPayload(payload))}
      />
    </div>
  );
}
