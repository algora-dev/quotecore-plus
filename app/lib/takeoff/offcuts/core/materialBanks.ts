import type { MaterialBank, RoofFace, SolveRequest } from './types';
import { dot, unit } from './math';
import { area, bounds, fromRing, intersect } from './regions';
import { frameFor, sceneToSurface, sheetCount } from './material';

/** Elevation-oriented SUPPLY families. Grouping does not move vertices, project
 * away hidden faces, join different planes or remove physical sheet demands.
 * Parallel faces can share a common cut-stock length and donate to each other.
 * Pitch and disconnected building boundaries remain real constraints. */
export function buildMaterialBanks(request: SolveRequest): MaterialBank[] {
  const {roof, faces} = request;
  const components = roof.outlines.map(o => ({id:o.id, region:fromRing(o.polygon)}));
  const groups: {key: string; faces: RoofFace[]}[] = [];
  for (const face of [...faces].sort((a,b)=>a.id.localeCompare(b.id))) {
    if (!face.flow || face.pitchDeg === null) throw new Error(`${face.name}: confirm direction and pitch.`);
    const region = fromRing(face.polygon);
    const component = [...components].sort((a,b)=>area(intersect(region,b.region))-area(intersect(region,a.region)))[0];
    const key = component?.id ?? 'reviewed-roof';
    const flow = unit(face.flow);
    // Check EVERY member, not a transitive chain which could group a gradually
    // rotating roof into one false orientation. Two degrees is grouping-only.
    const group = groups.find(g => g.key === key && g.faces.every(f =>
      dot(unit(f.flow!),flow) >= Math.cos(2*Math.PI/180) && Math.abs(f.pitchDeg!-face.pitchDeg!) < 1e-6));
    if (group) group.faces.push(face); else groups.push({key,faces:[face]});
  }
  return groups.map(group => {
    const first = group.faces[0], flow = unit(first.flow!), u = {x:flow.y,y:-flow.x};
    const xs = group.faces.flatMap(f=>f.polygon.map(p=>dot(p,u)*roof.mmPerSceneUnit));
    const length = Math.max(...group.faces.map(f=>{
      const frame=frameFor(f,roof), b=bounds(fromRing(f.polygon.map(p=>sceneToSurface(p,frame))));
      return b.maxY-b.minY;
    }));
    return {id:`bank:${group.faces.map(f=>f.id).join('+')}`, faceIds:group.faces.map(f=>f.id), flow,
      pitchDeg:first.pitchDeg!, cutLengthMm:length, crossMinMm:Math.min(...xs), crossMaxMm:Math.max(...xs)};
  });
}

/** The common bank grid plus apex/step alignments. We never round a real gap
 * down. An extra edge position caused by registration is counted and reported. */
export function bankOffsets(face: RoofFace, bank: MaterialBank, request: SolveRequest): number[] {
  if (face.laneOffsetLocked) return [face.laneOffsetMm];
  const w=request.profile.coverMm, frame=frameFor(face,request.roof);
  const xs=face.polygon.map(p=>sceneToSurface(p,frame).x), min=Math.min(...xs), span=Math.max(...xs)-min;
  const mod=(n:number):number=>{const r=((n%w)+w)%w;return r<1e-6||w-r<1e-6?0:r;};
  const globalMin=Math.min(...face.polygon.map(p=>dot(p,frame.u)*request.roof.mmPerSceneUnit));
  const phases=[face.laneOffsetMm,mod(globalMin-bank.crossMinMm),0,...xs.map(x=>mod(-(x-min)))];
  return phases.filter((p,i,a)=>a.findIndex(q=>Math.abs(p-q)<1e-5)===i)
    .filter(p=>sheetCount(span,w,p)<=sheetCount(span,w)+1).slice(0,8);
}
