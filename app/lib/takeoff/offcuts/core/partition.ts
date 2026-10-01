import type { Issue, Region, RoofFace, RoofInput } from './types';
import { projection, validateRing } from './math';
import { area, bandRing, components, fromRing, intersect, subtract, unionAll } from './regions';
import { drawingToleranceMm, minimumWidth } from './reviewGeometry';
import { draftingPolicy } from './drafting';

export interface CoverageRegion {
  id: string;
  kind: 'gap' | 'outside' | 'overlap' | 'outline-overlap';
  region: Region; faceIds: string[];
  areaMm2: number; widthMm: number;
  severity: 'error' | 'warning';
  /** Tiny bounded drafting discrepancy: retained in diagnostics, quiet by default. */
  quiet?: boolean;
}
export interface PartitionReport {
  issues: Issue[]; regions: CoverageRegion[];
  toleranceMm: number; toleranceAreaMm2: number;
}
/** Does not change the roof, trim the perimeter, silently delete a face or add
 * material. Full polygons participate even when hidden in the review UI. */
export function analysePartition(roof: RoofInput, faces: RoofFace[]): PartitionReport {
  const issues: Issue[] = [], regions: CoverageRegion[] = [];
  const result: PartitionReport = { issues, regions, toleranceMm: drawingToleranceMm(roof), toleranceAreaMm2: 0 };
  for (const o of roof.outlines) {
    const invalid = validateRing(o.polygon);
    if (invalid) issues.push({ severity: 'error', code: 'INVALID_POLYGON', objectId: o.id, message: `${o.name}: ${invalid}` });
  }
  for (const f of faces) {
    const invalid = validateRing(f.polygon);
    if (invalid) issues.push({ severity: 'error', code: 'INVALID_POLYGON', faceId: f.id, message: `${f.name}: ${invalid}` });
  }
  if (issues.length) return result;
  try {
    const os = roof.outlines.map(o => fromRing(o.polygon)), fs = faces.map(f => fromRing(f.polygon));
    const total = unionAll(os), covered = unionAll(fs), numericalArea = Math.max(1e-7, area(total) * 1e-10);
    const scale = Number.isFinite(roof.mmPerSceneUnit) && roof.mmPerSceneUnit > 0 ? roof.mmPerSceneUnit : 1;
    const totalMm2 = area(total) * scale ** 2;
    const policy = draftingPolicy(roof);
    result.toleranceAreaMm2 = result.toleranceMm ? Math.min(policy.totalAreaMm2, totalMm2 * policy.fraction) : 0;
    const collect = (kind: CoverageRegion['kind'], region: Region, faceIds: string[] = []): void => {
      // Split into actual connected problem zones so "Show" can focus the
      // specific missing sliver rather than fit the entire building.
      for (const part of components(region)) {
        if (area(part) <= numericalArea) continue;
        regions.push({ id: `coverage-${regions.length + 1}`, kind, region: part, faceIds,
          areaMm2: area(part) * scale ** 2, widthMm: minimumWidth(part.flatMap(bandRing)) * scale, severity: 'error' });
      }
    };
    collect('gap', subtract(total, covered));
    collect('outside', subtract(covered, total));
    for (let i = 0; i < fs.length; i++) for (let j = i + 1; j < fs.length; j++) collect('overlap', intersect(fs[i], fs[j]), [faces[i].id, faces[j].id]);
    for (let i = 0; i < os.length; i++) for (let j = i + 1; j < os.length; j++) collect('outline-overlap', intersect(os[i], os[j]));
    // Classify LOCAL discrepancies first. A missing large face must not turn
    // every unrelated 1 mm overshoot red (the previous all-or-nothing budget).
    // Straight-strip width is exact. Bent strips additionally use a bounded
    // boundary-distance sample, with strict per-zone AND aggregate area caps.
    const references = [...roof.outlines.map(o=>o.polygon), ...faces.map(f=>f.polygon)];
    const distanceToBoundary = (p: {x:number;y:number}): number => Math.min(...references.flatMap(r=>r.map((a,i)=>projection(p,a,r[(i+1)%r.length]).distance)));
    for (const r of regions) {
      if(r.kind==='outline-overlap') continue;
      let drift=0;
      for(const band of r.region) for(const tx of [0,.25,.5,.75,1]) for(const ty of [0,.25,.5,.75,1]) {
        const x=band.x0+(band.x1-band.x0)*tx, top=band.top0+(band.top1-band.top0)*tx, bottom=band.bottom0+(band.bottom1-band.bottom0)*tx;
        drift=Math.max(drift,distanceToBoundary({x,y:top+(bottom-top)*ty})*scale*2);
      }
      r.widthMm=Math.min(r.widthMm,drift);
    }
    let remaining = result.toleranceAreaMm2;
    for (const r of [...regions].sort((a,b)=>a.areaMm2-b.areaMm2)) {
      if(r.kind==='outline-overlap'||!result.toleranceMm)continue;
      const pts=r.region.flatMap(bandRing), maxExtent=pts.length?Math.hypot(Math.max(...pts.map(p=>p.x))-Math.min(...pts.map(p=>p.x)),Math.max(...pts.map(p=>p.y))-Math.min(...pts.map(p=>p.y)))*scale:0;
      const micro=r.areaMm2<=Math.min(2500,result.toleranceAreaMm2*.1)&&maxExtent<=result.toleranceMm*3;
      if((micro||r.widthMm<=result.toleranceMm+1e-5)&&r.areaMm2<=policy.maxAreaMm2&&r.areaMm2<=remaining+1e-5){
        r.severity='warning';r.quiet=micro;remaining-=r.areaMm2;
      }
    }
    for (const r of regions) {
      const names = r.faceIds.map(id => faces.find(f => f.id === id)?.name ?? id).join(' / ');
      const size = `${(r.areaMm2 / 1e6).toFixed(4)} m²`;
      const kindText = r.kind === 'gap' ? 'Uncovered roof' : r.kind === 'outside' ? 'Face outside the roof outline' : r.kind === 'overlap' ? `Overlapping faces (${names})` : 'Overlapping roof outlines';
      const code = r.severity === 'warning' ? 'DRAWING_SLIVER' : r.kind === 'gap' ? 'UNCOVERED_ROOF' : r.kind === 'outside' ? 'FACE_OUTSIDE_ROOF' : r.kind === 'overlap' ? 'FACE_OVERLAP' : 'OUTLINE_OVERLAP';
      issues.push({ severity: r.severity, code, faceId: r.faceIds[0], objectId: r.id,
        message: r.severity === 'warning'
          ? `${kindText}: narrow drawing discrepancy (${size}, ${r.widthMm.toFixed(1)} mm wide). Shown in amber; accepted for draft review only. It has not been filled, removed or added to the material plan.`
          : `${kindText}: ${size}. Use Show on plan to inspect the highlighted region${r.kind === 'outline-overlap' ? ' and select only the actual roof perimeter' : ', then restore, join or adjust the faces'}.` });
    }
  } catch (error) { issues.push({ severity: 'error', code: 'INVALID_POLYGON', message: error instanceof Error ? error.message : String(error) }); }
  return result;
}
export function validatePartition(roof: RoofInput, faces: RoofFace[]): Issue[] { return analysePartition(roof, faces).issues; }
