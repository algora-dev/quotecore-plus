import type { Draft, Point, Region, Ring } from '../core/types';
import { centroid, projection, validateRing } from '../core/math';
import { bandRing, boundarySegments, fromRing, unionAll, pointInRegion, bounds } from '../core/regions';
import { demandPointToScene } from '../core/material';
import { placedRegion } from '../core/solver';
import type { CoverageRegion } from '../core/partition';
import { materialPlan, reuseGroups } from '../core/plan';
// Material-source colours are a domain legend, not interface branding.
export const PALETTE = ['#B63D0A', '#087443', '#7c52ae', '#218b6b', '#b64974', '#79752c', '#3865bc', '#ae582f'];
export const escapeHtml = (text: unknown): string => String(text ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!));
const n = (v: number): string => Number.isFinite(v) ? v.toFixed(3) : '0';
export const points = (r: Point[]): string => r.map(p => `${n(p.x)},${n(p.y)}`).join(' ');
export const path = (r: Point[]): string => r.length ? `M${r.map(p => `${n(p.x)} ${n(p.y)}`).join('L')}Z` : '';
const regionFillPath = (r: Region, map: (p: Point) => Point): string => r.map(b => path(bandRing(b).map(map))).join('');
const regionOutlinePath = (r: Region, map: (p: Point) => Point): string => boundarySegments(r).map(e => { const a=map(e.a),b=map(e.b);return `M${n(a.x)} ${n(a.y)}L${n(b.x)} ${n(b.y)}`; }).join('');
/** A concave face's centroid may lie in a valley cut-out. Keep labels and the
 * water arrow inside real roof material instead of pointing from another face. */
export function interiorAnchor(polygon: Ring): Point {
  if (validateRing(polygon)) return centroid(polygon);
  const region = fromRing(polygon), b = bounds(region), center = centroid(polygon);
  const candidates: Point[] = [center];
  for (let i = 1; i < 16; i++) for (let j = 1; j < 16; j++) candidates.push({ x: b.minX + (b.maxX - b.minX) * i / 16, y: b.minY + (b.maxY - b.minY) * j / 16 });
  for (const band of region) candidates.push({ x: (band.x0 + band.x1) / 2, y: (band.top0 + band.top1 + band.bottom0 + band.bottom1) / 4 });
  let best = candidates[0], score = -Infinity;
  for (const p of candidates) if (pointInRegion(region, p)) {
    const clearance = Math.min(...polygon.map((a, i) => projection(p, a, polygon[(i + 1) % polygon.length]).distance));
    const value = clearance - Math.hypot(p.x - center.x, p.y - center.y) * .05;
    if (value > score) { score = value; best = p; }
  }
  return best;
}
function containedArrow(polygon: Ring, start: Point, direction: Point, length: number): Point {
  if (validateRing(polygon)) return { x: start.x + direction.x * length, y: start.y + direction.y * length };
  const region = fromRing(polygon); let allowed = length;
  for (let attempt = 0; attempt < 16; attempt++) {
    if ([.25, .5, .75, 1].every(t => pointInRegion(region, { x: start.x + direction.x * allowed * t, y: start.y + direction.y * allowed * t }))) break;
    allowed *= .8;
  }
  return { x: start.x + direction.x * allowed, y: start.y + direction.y * allowed };
}
export interface RenderOptions {
  phase: 'faces' | 'solution'; selectedFaceId?: string; selectedOffcutId?: string;
  showSheets?: boolean; showSources?: boolean; showEnvelope?: boolean;
  editPieces?: boolean; selectedGroupId?: string;
  print?: boolean; viewBox?: string; pendingPolygon?: Point[];
  hiddenFaceIds?: ReadonlySet<string>;
  coverage?: CoverageRegion[]; focusedDiagnosticId?: string;
  sceneUnitsPerPixel?: number;
}
export function renderSvg(draft: Draft, options: RenderOptions): string {
  const {roof,faces,solution:s} = draft, colors = new Map(faces.map((f,i)=>[f.id,PALETTE[i%PALETTE.length]]));
  const bankFace = (id: string, rootBankId?: string): string => {
    const banks = s?.bankLayout?.materialBanks;
    return (rootBankId ? banks?.find(b => b.id === rootBankId) : banks?.find(b => b.faceIds.includes(id)))?.faceIds[0] ?? id;
  };
  const color = (id: string): string => colors.get(bankFace(id)) ?? PALETTE[0];
  const lapColor = (id: string): string => {
    const reuse=s?.placements.find(p=>p.kind==='reuse' && s.demands.find(d=>d.id===p.demandId)?.faceId===id);
    return color(bankFace(id,s?.offcuts.find(o=>o.id===reuse?.offcutId)?.rootBankId));
  };
  const px = options.print ? 1 : options.sceneUnitsPerPixel ?? 1;
  const hidden = (id: string): boolean => options.phase === 'faces' && !options.print && !!options.hiddenFaceIds?.has(id);
  const ids = new Map(faces.map((f,i)=>[f.id,i]));
  const plan = s ? materialPlan(faces, s) : [];
  let shapes = '';
  // Export excludes signed plan URLs. A reviewer may attach their source plan
  // separately; external image URLs must never leak in downloadable drawings.
  if (!options.print && roof.imageUrl && /^(https?:|blob:|data:image\/)/.test(roof.imageUrl)) shapes += `<image href="${escapeHtml(roof.imageUrl)}" x="0" y="0" width="${roof.sceneWidth}" height="${roof.sceneHeight}" preserveAspectRatio="none" opacity="0.82"/>`;
  for (const outline of roof.outlines) shapes += `<polygon points="${points(outline.polygon)}" fill="#f3f5f7" fill-opacity="${roof.imageUrl ? '.05' : '.65'}" stroke="#253443" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
  for (const edge of roof.edges) shapes += `<line x1="${n(edge.a.x)}" y1="${n(edge.a.y)}" x2="${n(edge.b.x)}" y2="${n(edge.b.y)}" stroke="${edge.kind==='valley'?'#a96c23':edge.kind==='broken_hip'?'#d36f25':'#697784'}" stroke-width="1.2" vector-effect="non-scaling-stroke"${edge.kind==='spouting'?' stroke-dasharray="6 4"':''}/>`;
  for (const f of faces) {
    if (hidden(f.id)) continue;
    if (options.phase === 'faces') shapes += `<polygon data-face="${escapeHtml(f.id)}" points="${points(f.polygon)}" fill="#FF6B35" fill-opacity="${options.selectedFaceId===f.id?'.22':'.10'}" stroke="${options.selectedFaceId===f.id?'#B63D0A':'#825000'}" stroke-width="${options.selectedFaceId===f.id?3:1.5}" vector-effect="non-scaling-stroke"/>`;
  }
  if (s && options.phase === 'solution') {
    const demands = new Map(s.demands.map(d=>[d.id,d]));
    if (options.showEnvelope) for (const d of s.demands) if (s.placements.some(p=>p.demandId===d.id&&p.kind==='new')) shapes += `<path d="${regionFillPath(d.blank,p=>demandPointToScene(p,d))}" fill="${color(d.faceId)}" fill-opacity=".06" stroke="${color(d.faceId)}" stroke-width=".6" vector-effect="non-scaling-stroke"/>`;
    // Group fresh cover by source face. Reuse keeps physical IDs for editing,
    // while same-colour hatching provides the source-group visual relationship.
    for (const p of s.placements) {
      if (p.kind === 'reuse' && !options.editPieces && s.status !== 'invalid') continue;
      const d=demands.get(p.demandId); if(!d)continue;
      const o=s.offcuts.find(o=>o.id===p.offcutId), sourceFace=bankFace(o?.sourceFaceId??d.faceId,o?.rootBankId);
      const map=(q:Point)=>demandPointToScene(q,d), selected=o?.id===options.selectedOffcutId;
      const fill=p.kind==='reuse'?`url(#hatch-${ids.get(sourceFace)??0})`:color(sourceFace);
      const label=p.kind==='reuse'?`${o?.id} → ${d.id}`:`New material: ${d.id}`;
      // An invalid moved piece is rendered in its actual transformed position,
      // not disguised as the required target polygon.
      const invalid = s.issues.some(i => i.severity === 'error' && i.objectId === d.id);
      const region=p.kind==='reuse'&&invalid?placedRegion(s,p):d.cover;
      shapes += `<g ${p.kind==='reuse'?`data-offcut="${escapeHtml(o?.id)}" data-demand="${escapeHtml(d.id)}"`:`data-demand="${escapeHtml(d.id)}"`} class="${p.kind==='reuse'?'qc-reuse':''}"><title>${escapeHtml(label)}</title><path d="${regionFillPath(region,map)}" fill="${fill}" fill-opacity="${p.kind==='reuse'?'.60':'.25'}"/>`;
      if(p.kind==='reuse'||options.showSheets)shapes+=`<path d="${regionOutlinePath(region,map)}" fill="none" stroke="${selected?'#122c3c':color(sourceFace)}" stroke-width="${selected?3:1.1}" vector-effect="non-scaling-stroke"${p.kind==='reuse'?' stroke-dasharray="5 3"':''}/>`;
      shapes+='</g>';
    }
    if (!options.editPieces && s.status !== 'invalid') for (const group of reuseGroups(s)) {
      // Union real cover cells in scene space. This removes lane boundaries from
      // normal view without turning absent/split pieces into fictitious triangles.
      const region = unionAll(group.demandIds.flatMap(id => {
        const d = demands.get(id)!;
        return d.cover.map(b => {
          const ring = bandRing(b).map(p => demandPointToScene(p, d));
          const clean = ring.filter((p, i) => Math.hypot(p.x - ring[(i + ring.length - 1) % ring.length].x, p.y - ring[(i + ring.length - 1) % ring.length].y) > 1e-7);
          return clean.length >= 3 ? fromRing(clean) : [];
        });
      }));
      const selected = options.selectedGroupId === group.id;
      const groupSource = bankFace(group.sourceFaceId, group.rootBankId);
      const sourceName = faces.find(f => f.id === group.sourceFaceId)?.name ?? group.sourceFaceId;
      shapes += `<g data-group="${escapeHtml(group.id)}" class="qc-reuse"><title>${escapeHtml(sourceName)} offcuts · ${group.sheetCount} sheets · drag this set to another face</title><path d="${regionFillPath(region, p => p)}" fill="url(#hatch-${ids.get(groupSource) ?? 0})" fill-opacity=".70"/><path d="${regionOutlinePath(region, p => p)}" fill="none" stroke="${selected ? '#122c3c' : color(groupSource)}" stroke-width="${selected ? 3 : 1.6}" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/></g>`;
      if (options.showSheets) for (const id of group.demandIds) {
        const d = demands.get(id)!;
        shapes += `<path d="${regionOutlinePath(d.cover, p => demandPointToScene(p, d))}" fill="none" stroke="${color(groupSource)}" stroke-width=".7" vector-effect="non-scaling-stroke" pointer-events="none"/>`;
      }
    }
    for (const f of faces) shapes += `<polygon data-plan-face="${escapeHtml(f.id)}" points="${points(f.polygon)}" fill="none" stroke="#334e5a" stroke-width="1.3" vector-effect="non-scaling-stroke" pointer-events="stroke"/>`;
    if(options.showSources||options.selectedOffcutId)for(const o of s.offcuts){
      if(!options.showSources&&o.id!==options.selectedOffcutId)continue;
      const d=demands.get(o.sourceDemandId);if(!d)continue;
      const unused=!s.placements.some(p=>p.offcutId===o.id&&p.kind==='reuse');
      shapes+=`<g ${unused?`data-offcut="${escapeHtml(o.id)}" class="qc-reuse"`:'pointer-events="none"'}><title>${escapeHtml(o.id)} — source offcut</title><path d="${regionFillPath(o.region,p=>demandPointToScene(p,d))}" fill="${color(bankFace(o.sourceFaceId, o.rootBankId))}" fill-opacity=".10"/><path d="${regionOutlinePath(o.region,p=>demandPointToScene(p,d))}" fill="none" stroke="${color(bankFace(o.sourceFaceId, o.rootBankId))}" stroke-dasharray="2 3" stroke-width="1.4" vector-effect="non-scaling-stroke"/></g>`;
    }
  }
  const arrowLength=Math.min(roof.sceneWidth,roof.sceneHeight)*0.075;
  for (const f of faces) {
    if (hidden(f.id)) continue;
    const c=interiorAnchor(f.polygon), flow=f.flow;
    const col=lapColor(f.id);
    const row = plan.find(p => p.faceId === f.id);
    const label = row ? row.newCount === row.sheetCount ? `NEW · ${row.sheetCount} sheets` : row.newCount === 0 ? `OFFCUT · ${row.sheetCount} sheets` : `${row.newCount} NEW + ${row.reuseCount} OFFCUT` : '';
    shapes+=`<text ${options.phase==='faces'?`data-face="${escapeHtml(f.id)}"`: ''} x="${n(c.x)}" y="${n(c.y-(row && options.phase==='solution'?26:14)*px)}" text-anchor="middle" font-size="${n(12*px)}" font-family="system-ui,sans-serif" fill="#191B20" font-weight="650" style="paint-order:stroke;stroke:#fff;stroke-width:${n(2.5*px)};stroke-opacity:.75">${escapeHtml(f.name)}</text>`;
    if (row && options.phase === 'solution') shapes += `<text data-plan-face="${escapeHtml(f.id)}" x="${n(c.x)}" y="${n(c.y-11*px)}" text-anchor="middle" font-size="${n(10*px)}" font-family="system-ui,sans-serif" fill="#303641" font-weight="600" style="paint-order:stroke;stroke:#fff;stroke-width:${n(2*px)};stroke-opacity:.6">${escapeHtml(label)}</text>`;
    if(flow){
      // Keep solution arrows beneath the face name/count, not through them.
      // Face-review drag handles retain their original centroid-based geometry.
      const length=options.phase==='solution'?Math.min(arrowLength,36*px):arrowLength;
      const start=options.phase==='solution'&&flow.y<-.05?containedArrow(f.polygon,c,{x:0,y:1},-flow.y*length):c;
      const allowed=options.phase==='solution'&&flow.y<-.05?Math.min(length,(start.y-c.y)/-flow.y):length;
      const end=containedArrow(f.polygon,start,flow,allowed);
      shapes+=`<line data-water-face="${escapeHtml(f.id)}" x1="${n(start.x)}" y1="${n(start.y)}" x2="${n(end.x)}" y2="${n(end.y)}" stroke="#191B20" stroke-width="2" marker-end="url(#water-arrow)" vector-effect="non-scaling-stroke"/>`;
      if(options.phase==='faces'&&!options.print)shapes+=`<circle data-flow="${escapeHtml(f.id)}" cx="${n(end.x)}" cy="${n(end.y)}" r="${n(6*px)}" fill="#fff" stroke="#191B20" stroke-width="2"><title>Drag to change water direction</title></circle>`;
      if(options.phase==='solution'){
        const lap=s?.lapByFace[f.id]??f.lap,u={x:flow.y*lap,y:-flow.x*lap};
        const lapLength=Math.min(arrowLength*.75,28*px),base=containedArrow(f.polygon,c,{x:0,y:1},7*px);
        const a=u.y<-.05?containedArrow(f.polygon,base,{x:0,y:1},-u.y*lapLength):base;
        const allowed=u.y<-.05?Math.min(lapLength,(a.y-base.y)/-u.y):lapLength;
        const b=containedArrow(f.polygon,a,u,allowed);
        shapes+=`<g ${options.print?'':`data-action="flip-lap" data-id="${escapeHtml(f.id)}" role="button" tabindex="0" aria-label="Reverse suggested lap on ${escapeHtml(f.name)} and recalculate" style="cursor:pointer"`}>
          ${options.print?'':`<rect x="${n(Math.min(a.x,b.x)-8)}" y="${n(Math.min(a.y,b.y)-8)}" width="${n(Math.abs(a.x-b.x)+16)}" height="${n(Math.abs(a.y-b.y)+16)}" fill="transparent"/>`}
          <line x1="${n(a.x)}" y1="${n(a.y)}" x2="${n(b.x)}" y2="${n(b.y)}" stroke="${col}" stroke-width="2" marker-end="url(#lap-arrow-${ids.get(f.id)})" vector-effect="non-scaling-stroke"/><text x="${n(b.x+u.x*5)}" y="${n(b.y+u.y*5)}" font-size="${n(9*px)}" fill="${col}" pointer-events="none">LAP</text></g>`;
      }
    }
    if(options.phase==='faces'&&options.selectedFaceId===f.id&&!options.print)f.polygon.forEach((p,i)=>{shapes+=`<circle data-vertex="${i}" data-face-id="${escapeHtml(f.id)}" cx="${n(p.x)}" cy="${n(p.y)}" r="${n(5*px)}" fill="#fff" stroke="#B63D0A" stroke-width="2"/>`;});
  }
  if(options.pendingPolygon?.length)shapes+=`<polyline points="${points(options.pendingPolygon)}" fill="#FF6B35" fill-opacity=".2" stroke="#B63D0A" stroke-dasharray="4 3"/>`;
  for (const issue of options.coverage ?? []) {
    const col = issue.severity === 'error' ? '#C72B3D' : '#825000';
    const band = [...issue.region].sort((a,b)=>(b.x1-b.x0)*((b.bottom0-b.top0)+(b.bottom1-b.top1))-(a.x1-a.x0)*((a.bottom0-a.top0)+(a.bottom1-a.top1)))[0];
    if (!band) continue;
    const c = { x:(band.x0+band.x1)/2, y:(band.top0+band.top1+band.bottom0+band.bottom1)/4 };
    const selected = issue.id === options.focusedDiagnosticId;
    const label = `${issue.kind === 'gap' ? 'Uncovered roof' : issue.kind === 'outside' ? 'Outside roof' : 'Overlap'} · ${(issue.areaMm2/1e6).toFixed(4)} m²`;
    shapes += `<g data-coverage="${escapeHtml(issue.id)}"><title>${escapeHtml(label)}</title><path d="${regionFillPath(issue.region,p=>p)}" fill="${col}" fill-opacity=".24" pointer-events="none"/><path d="${regionOutlinePath(issue.region,p=>p)}" fill="none" stroke="${col}" stroke-width="${selected?3:2}" stroke-dasharray="4 3" vector-effect="non-scaling-stroke" pointer-events="none"/><g ${options.print ? '' : `data-action="focus-issue" data-id="${escapeHtml(issue.id)}" role="button" tabindex="0" aria-label="Show ${escapeHtml(label)}" style="cursor:pointer"`}><circle cx="${n(c.x)}" cy="${n(c.y)}" r="${n(10*px)}" fill="#fff" stroke="${col}" stroke-width="2" vector-effect="non-scaling-stroke"/><text x="${n(c.x)}" y="${n(c.y+4*px)}" text-anchor="middle" font-family="system-ui" font-size="${n(13*px)}" font-weight="700" fill="${col}" pointer-events="none">!</text></g></g>`;
  }
  const defs=faces.map((f,i)=>`<pattern id="hatch-${i}" patternUnits="userSpaceOnUse" width="8" height="8"><rect width="8" height="8" fill="${color(f.id)}" fill-opacity=".12"/><path d="M0 0L8 8M8 0L0 8" stroke="${color(f.id)}" stroke-width="1"/></pattern><marker id="lap-arrow-${i}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="${lapColor(f.id)}"/></marker>`).join('');
  const hasReviewGaps = !!options.coverage?.length;
  const padding=options.print && hasReviewGaps ? 55 : 30;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="qc-scene" role="${options.print ? 'img' : 'group'}" aria-label="Roof faces and offcut review" viewBox="${options.viewBox??`${-padding} ${-padding} ${roof.sceneWidth+padding*2} ${roof.sceneHeight+padding*2}`}" style="background:#fff;touch-action:none;user-select:none;width:100%;height:100%"><defs><marker id="water-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#191B20"/></marker>${defs}</defs>${shapes}${options.print?`<text x="16" y="${roof.sceneHeight+20}" font-family="system-ui" font-size="12" fill="#B63D0A">DRAFT CUT / REUSE PLAN — VERIFY PROFILE AND SITE LENGTHS — NOT AN ORDER</text>${hasReviewGaps ? `<text x="16" y="${roof.sceneHeight+40}" font-family="system-ui" font-size="11" fill="#825000">AMBER AREAS: drawing discrepancies remain; no missing area was filled by this plan.</text>` : ''}`:''}</svg>`;
}
