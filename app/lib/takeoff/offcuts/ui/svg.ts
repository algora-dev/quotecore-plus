import type { Draft, Point, Region } from '../core/types';
import { centroid } from '../core/math';
import { bandRing, boundarySegments } from '../core/regions';
import { demandPointToScene } from '../core/material';
import { placedRegion } from '../core/solver';
export const PALETTE = ['#2277a5', '#d36f25', '#7c52ae', '#218b6b', '#b64974', '#79752c', '#3865bc', '#ae582f'];
export const escapeHtml = (text: unknown): string => String(text ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]!));
const n = (v: number): string => Number.isFinite(v) ? v.toFixed(3) : '0';
export const points = (r: Point[]): string => r.map(p => `${n(p.x)},${n(p.y)}`).join(' ');
export const path = (r: Point[]): string => r.length ? `M${r.map(p => `${n(p.x)} ${n(p.y)}`).join('L')}Z` : '';
const regionFillPath = (r: Region, map: (p: Point) => Point): string => r.map(b => path(bandRing(b).map(map))).join('');
const regionOutlinePath = (r: Region, map: (p: Point) => Point): string => boundarySegments(r).map(e => { const a=map(e.a),b=map(e.b);return `M${n(a.x)} ${n(a.y)}L${n(b.x)} ${n(b.y)}`; }).join('');
export interface RenderOptions {
  phase: 'faces' | 'solution'; selectedFaceId?: string; selectedOffcutId?: string;
  showSheets?: boolean; showSources?: boolean; showEnvelope?: boolean;
  print?: boolean; viewBox?: string; pendingPolygon?: Point[];
}
export function renderSvg(draft: Draft, options: RenderOptions): string {
  const {roof,faces,solution:s} = draft, colors = new Map(faces.map((f,i)=>[f.id,PALETTE[i%PALETTE.length]]));
  const color = (id: string): string => colors.get(id) ?? PALETTE[0];
  const ids = new Map(faces.map((f,i)=>[f.id,i]));
  let shapes = '';
  // Export excludes signed plan URLs. A reviewer may attach their source plan
  // separately; external image URLs must never leak in downloadable drawings.
  if (!options.print && roof.imageUrl && /^(https?:|blob:|data:image\/)/.test(roof.imageUrl)) shapes += `<image href="${escapeHtml(roof.imageUrl)}" x="0" y="0" width="${roof.sceneWidth}" height="${roof.sceneHeight}" preserveAspectRatio="none" opacity="0.82"/>`;
  for (const outline of roof.outlines) shapes += `<polygon points="${points(outline.polygon)}" fill="#f3f5f7" fill-opacity="${roof.imageUrl ? '.05' : '.65'}" stroke="#253443" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
  for (const edge of roof.edges) shapes += `<line x1="${n(edge.a.x)}" y1="${n(edge.a.y)}" x2="${n(edge.b.x)}" y2="${n(edge.b.y)}" stroke="${edge.kind==='valley'?'#a96c23':edge.kind==='broken_hip'?'#d36f25':'#697784'}" stroke-width="1.2" vector-effect="non-scaling-stroke"${edge.kind==='spouting'?' stroke-dasharray="6 4"':''}/>`;
  for (const f of faces) {
    if (options.phase === 'faces') shapes += `<polygon data-face="${escapeHtml(f.id)}" points="${points(f.polygon)}" fill="${f.confirmed?'#7fb6a0':'#dd78ad'}" fill-opacity=".24" stroke="${options.selectedFaceId===f.id?'#912462':'#b05883'}" stroke-width="${options.selectedFaceId===f.id?3:1.5}" vector-effect="non-scaling-stroke"/>`;
  }
  if (s && options.phase === 'solution') {
    const demands = new Map(s.demands.map(d=>[d.id,d]));
    if (options.showEnvelope) for (const d of s.demands) if (s.placements.some(p=>p.demandId===d.id&&p.kind==='new')) shapes += `<path d="${regionFillPath(d.blank,p=>demandPointToScene(p,d))}" fill="${color(d.faceId)}" fill-opacity=".06" stroke="${color(d.faceId)}" stroke-width=".6" vector-effect="non-scaling-stroke"/>`;
    // Group fresh cover by source face. Reuse keeps physical IDs for editing,
    // while same-colour hatching provides the source-group visual relationship.
    for (const p of s.placements) {
      const d=demands.get(p.demandId); if(!d)continue;
      const o=s.offcuts.find(o=>o.id===p.offcutId), sourceFace=o?.sourceFaceId??d.faceId;
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
    if(options.showSources||options.selectedOffcutId)for(const o of s.offcuts){
      if(!options.showSources&&o.id!==options.selectedOffcutId)continue;
      const d=demands.get(o.sourceDemandId);if(!d)continue;
      const unused=!s.placements.some(p=>p.offcutId===o.id&&p.kind==='reuse');
      shapes+=`<g ${unused?`data-offcut="${escapeHtml(o.id)}" class="qc-reuse"`:'pointer-events="none"'}><title>${escapeHtml(o.id)} — source offcut</title><path d="${regionFillPath(o.region,p=>demandPointToScene(p,d))}" fill="${color(o.sourceFaceId)}" fill-opacity=".10"/><path d="${regionOutlinePath(o.region,p=>demandPointToScene(p,d))}" fill="none" stroke="${color(o.sourceFaceId)}" stroke-dasharray="2 3" stroke-width="1.4" vector-effect="non-scaling-stroke"/></g>`;
    }
  }
  const arrowLength=Math.min(roof.sceneWidth,roof.sceneHeight)*0.075;
  for (const f of faces) {
    const c=centroid(f.polygon), col=color(f.id), flow=f.flow;
    shapes+=`<text x="${n(c.x)}" y="${n(c.y-14)}" text-anchor="middle" font-size="13" font-family="system-ui,sans-serif" fill="#1c3040" font-weight="650" pointer-events="none">${escapeHtml(f.name)}</text>`;
    if(flow){
      const end={x:c.x+flow.x*arrowLength,y:c.y+flow.y*arrowLength};
      shapes+=`<line x1="${n(c.x)}" y1="${n(c.y)}" x2="${n(end.x)}" y2="${n(end.y)}" stroke="#203b51" stroke-width="2" marker-end="url(#water-arrow)" vector-effect="non-scaling-stroke"/>`;
      if(options.phase==='faces'&&!options.print)shapes+=`<circle data-flow="${escapeHtml(f.id)}" cx="${n(end.x)}" cy="${n(end.y)}" r="6" fill="#fff" stroke="#203b51" stroke-width="2"><title>Drag to change water direction</title></circle>`;
      if(options.phase==='solution'){
        const lap=s?.lapByFace[f.id]??f.lap,u={x:flow.y*lap,y:-flow.x*lap};
        shapes+=`<line x1="${n(c.x)}" y1="${n(c.y+7)}" x2="${n(c.x+u.x*arrowLength*.75)}" y2="${n(c.y+7+u.y*arrowLength*.75)}" stroke="${col}" stroke-width="2" marker-end="url(#lap-arrow-${ids.get(f.id)})" vector-effect="non-scaling-stroke"/><text x="${n(c.x+u.x*arrowLength*.8)}" y="${n(c.y+7+u.y*arrowLength*.8)}" font-size="9" fill="${col}" pointer-events="none">LAP</text>`;
      }
    }
    if(options.phase==='faces'&&options.selectedFaceId===f.id&&!options.print)f.polygon.forEach((p,i)=>{shapes+=`<circle data-vertex="${i}" data-face-id="${escapeHtml(f.id)}" cx="${n(p.x)}" cy="${n(p.y)}" r="5" fill="#fff" stroke="#912462" stroke-width="2"/>`;});
  }
  if(options.pendingPolygon?.length)shapes+=`<polyline points="${points(options.pendingPolygon)}" fill="#dd78ad" fill-opacity=".2" stroke="#912462" stroke-dasharray="4 3"/>`;
  const defs=faces.map((f,i)=>`<pattern id="hatch-${i}" patternUnits="userSpaceOnUse" width="8" height="8"><rect width="8" height="8" fill="${color(f.id)}" fill-opacity=".12"/><path d="M0 0L8 8M8 0L0 8" stroke="${color(f.id)}" stroke-width="1"/></pattern><marker id="lap-arrow-${i}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="${color(f.id)}"/></marker>`).join('');
  const padding=30;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="qc-scene" role="img" aria-label="Roof faces and offcut review" viewBox="${options.viewBox??`${-padding} ${-padding} ${roof.sceneWidth+padding*2} ${roof.sceneHeight+padding*2}`}" style="background:#fff;touch-action:none;user-select:none;width:100%;height:100%"><defs><marker id="water-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#203b51"/></marker>${defs}</defs>${shapes}${options.print?`<text x="16" y="${roof.sceneHeight+20}" font-family="system-ui" font-size="12" fill="#a44231">PROTOTYPE — REVIEW REQUIRED — NOT AN ORDER/CUT LIST</text>`:''}</svg>`;
}
