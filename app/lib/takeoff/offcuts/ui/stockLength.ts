import type { Solution, RoofFace } from '../core/types';
import { stockLengthRows } from '../core/stockLength';
import { escapeHtml as esc } from './svg';
/** Same-colour donor cuts remain the same material family. Explain distinct
 * purchase lengths here rather than adding arbitrary new hatch/legend states. */
export function stockLengthDetails(s:Solution,faces:RoofFace[],demandIds?:string[]):string {
  const rows=stockLengthRows(s).filter(r=>!demandIds||demandIds.includes(r.demandId));
  if(!rows.length)return '';
  const groups=new Map<string,{faceId:string;lanes:number[];before:number;after:number;side:string;preserves:string}>();
  for(const r of rows){
    const side=r.upstreamRemovedMm>1e-6&&r.downstreamRemovedMm>1e-6?'both square ends':r.upstreamRemovedMm>1e-6?'square ridge end':'square eave end';
    const preserves=r.upstreamUseful&&r.downstreamUseful?'Top and bottom cuts kept':r.downstreamUseful?'Bottom cuts kept':r.upstreamUseful?'Top cuts kept':'Installed coverage kept';
    const key=JSON.stringify([r.faceId,r.beforeLengthMm,r.afterLengthMm,side,preserves]);
    const row=groups.get(key)??{faceId:r.faceId,lanes:[],before:r.beforeLengthMm,after:r.afterLengthMm,side,preserves};row.lanes.push(r.laneIndex+1);groups.set(key,row);
  }
  const lm=rows.reduce((n,r)=>n+r.savedLinealM,0),m2=rows.reduce((n,r)=>n+r.savedCoverM2,0);
  return `<details class="qc-stock-end-detail"><summary>Shorter stock · same offcuts</summary>
    <p>${rows.length} sheets use shorter blanks: ${lm.toFixed(2)} lm / ${m2.toFixed(2)} m² less than the unrefined bank lengths. Already included in the totals above.</p>
    <p class="qc-muted">Installed shapes, all hip/valley cuts, lap and receiver safety are unchanged. No extra transfers. Follow the distinct length groups below.</p>
    <table class="qc-stock"><thead><tr><th>Source sheets</th><th>Order length</th><th>Why</th></tr></thead><tbody>${[...groups.values()].map(g=>`<tr><td>${esc(faces.find(f=>f.id===g.faceId)?.name??g.faceId)}<small>Sheets ${g.lanes.sort((a,b)=>a-b).join(', ')}</small></td><td>${g.lanes.length} × ${(g.after/1000).toFixed(3)} m<small>Was ${(g.before/1000).toFixed(3)} m</small></td><td>${esc(g.preserves)}<small>Unused ${esc(g.side)} removed</small></td></tr>`).join('')}</tbody></table>
  </details>`;
}
