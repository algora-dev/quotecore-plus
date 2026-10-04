import type { RoofFace, Solution } from '../core/types';
import { salvageEligibility, salvagePhysicalFingerprint, type SalvageGroup, type SalvageResult, type SalvageSearchReport } from '../core/salvageModel';
import { escapeHtml as esc } from './svg';
import { icon } from './icons';
const fmt=(n:number)=>n.toFixed(2);
const baseName=(s:Solution)=>s.salvage?s.layoutLabel??'More reuse':s.objective==='simpler'?'Simpler cuts':s.objective==='less-material'?'Less material':'Recommended';
export function salvageOffer(s:Solution,saved:Solution[],disabled:boolean):string {
  if(s.salvage)return '';
  const existing=saved.find(p=>p.salvage?.basePhysicalFingerprint===salvagePhysicalFingerprint(s));
  if(existing)return `<section class="qc-salvage-offer"><b>Extra reuse version saved</b><p>Your original is unchanged. Choose “${esc(baseName(existing))}” in the cut-plan selector to compare.</p></section>`;
  if(!salvageEligibility(s).eligible)return '';
  return `<section class="qc-salvage-offer" id="qc-more-reuse"><b>Check unused cuts against fillers</b><p>Look for a worthwhile batch that could replace new straight sheets. You’ll see the source, trimming and cut-first sequence before choosing.</p>
    <button class="qc-wide" data-action="salvage-search" ${disabled||saved.length>=12?'disabled':''}>Check for more reuse ${icon('arrow')}</button><small>Optional. Keeps this plan unchanged. Fit and savings are not yet confirmed.</small></section>`;
}
export function salvageGroupHtml(g:SalvageGroup,faces:RoofFace[],selectable=false):string {
  const name=(id:string)=>esc(faces.find(f=>f.id===id)?.name??id),first=g.replacements[0],lengths=[...new Set(g.replacements.map(r=>(r.finishedLengthMm/1000).toFixed(3)))];
  const from=[...new Set(g.replacements.map(r=>r.sourceLaneIndex+1))].join(', '),to=g.replacements.map(r=>r.destinationLaneIndex+1).join(', ');
  return `<article class="qc-salvage-group"><strong>${name(g.destinationFaceId)} · ${g.savedSheets} salvaged fillers</strong>
    <p>Retain cuts from <b>${name(g.sourceFaceId)}</b>, sheets ${esc(from)}. Replace new filler positions ${esc(to)}.</p>
    <p class="qc-salvage-sequence"><b>Cut first:</b> ${g.prerequisiteFaceIds.map(name).join(' → ')} → then finish these fillers on ${name(g.destinationFaceId)}.</p>
    <p>Keep the metal face-up. ${first.rotation===180?'Turn end-for-end as approved for this profile.':'Keep the recorded sheet orientation.'} Trim the angled ends square to ${lengths.length===1?lengths[0]+' m':'the lengths below'}; shorten only, never join pieces to gain length.</p>
    <p><b>Save ${fmt(g.savedCoverAreaM2)} m² · ${fmt(g.savedLinealM)} lm · ${g.savedSheets} new sheets</b></p>
    <details><summary>Sheet-by-sheet instructions</summary><div class="qc-salvage-table"><table class="qc-stock"><thead><tr><th>Source sheet</th><th>Filler position</th><th>Finish length</th></tr></thead><tbody>${g.replacements.map(r=>`<tr><td>${r.sourceLaneIndex+1}</td><td>${r.destinationLaneIndex+1}</td><td>${(r.finishedLengthMm/1000).toFixed(3)} m</td></tr>`).join('')}</tbody></table></div>
      <p>Lap on the receiving face: ${first.destinationLap===1?'left to right':'right to left'}, looking up from its spouting. Use ${first.coverMm} mm effective cover. Keep the source grid and cuts as planned; changed site setout requires rechecking these pieces.</p></details>
    ${selectable?`<button data-action="salvage-locate" data-id="${esc(g.replacements[0].demandId)}">Show fillers on plan</button>`:''}</article>`;
}
export function salvageSummary(s:Solution,faces:RoofFace[],preview:boolean,viewingBase=false):string {
  const c=s.salvage;if(!c)return '';
  return `<section class="qc-salvage-summary" id="qc-salvage-comparison" aria-label="Extra reuse comparison"><h3>${preview?'Extra reuse - preview only':'Extra reuse selected'}</h3>
    <p>Compared with <b>${esc(c.baseLabel)}</b></p><strong class="qc-comparison-amount">−${fmt(c.savedCoverAreaM2)} m² · −${fmt(c.savedLinealM)} lm</strong>
    <p>${c.savedSheets} fewer new sheets. ${c.groups.length} filler run${c.groups.length===1?'':'s'} changed. The rest of the cut plan is unchanged.</p>
    ${preview?`<div class="qc-actions"><button data-action="salvage-view-base" aria-pressed="${viewingBase}">Original plan</button><button data-action="salvage-view-candidate" aria-pressed="${!viewingBase}">Extra reuse preview</button></div>
    <p class="qc-muted">${viewingBase?'Showing the original on the canvas.':'Showing the optional reuse on the canvas.'} Nothing has been selected or saved yet.</p>`:''}
    ${c.groups.map(g=>salvageGroupHtml(g,faces,true)).join('')}
    <p class="qc-muted">Finish the listed source cuts first and retain the pieces. Review this extra sequencing before removing the new fillers from your purchase list. Draft quantities-not a manufacturer-approved order.</p>
    ${preview?'<div class="qc-actions"><button data-action="salvage-keep">Keep original</button><button class="primary" data-action="salvage-accept">Use this version</button></div>':'<button data-action="salvage-export">Export reuse instructions</button>'}</section>`;
}
export function salvageResultDialog(result:SalvageResult,faces:RoofFace[]):string {
  const c=result.solution?.salvage;
  return `<dialog class="qc-result-dialog" aria-labelledby="qc-salvage-title" aria-describedby="qc-salvage-description"><h2 id="qc-salvage-title">${c?'A filler reuse option is ready to review':'No worthwhile filler reuse found'}</h2>
    <p id="qc-salvage-description">${c?`Potential saving: <b>${fmt(c.savedCoverAreaM2)} m² · ${fmt(c.savedLinealM)} lm · ${c.savedSheets} new sheets</b>. ${c.groups.length} filler run${c.groups.length===1?'':'s'} would change. This adds a cut-first dependency-review it on the plan before choosing.`:'We checked unused cuts against non-donor straight fillers. No sizeable, compatible batch qualified in this limited search. Your current plan is unchanged.'}</p>
    ${c?`<p>Retain cuts from ${[...new Set(c.groups.map(g=>g.sourceFaceId))].map(id=>esc(faces.find(f=>f.id===id)?.name??id)).join(' / ')} before finishing the receiving fillers.</p>`:'<p class="qc-muted">This does not prove every leftover is unusable. The check does not replace main-bank donors, self-fill stock or valley starters.</p>'}
    <div class="qc-actions"><button data-action="salvage-keep" autofocus>${c?'Keep original':'Keep current plan'}</button>${c?'<button class="primary" data-action="salvage-review">Review on plan</button>':''}</div></dialog>`;
}
export function salvageReportText(s:Solution,faces:RoofFace[]):string {
  const c=s.salvage;if(!c)throw new Error('Select a more-reuse version first.');const name=(id:string)=>faces.find(f=>f.id===id)?.name??id;
  const lines=['OPTIONAL FILLER REUSE - DRAFT',`Original plan: ${c.baseLabel} (${c.baseLayoutId})`,`Selected plan: ${s.layoutId}`,`Effective cover: ${s.profile.coverMm} mm`,
    `Removed purchases: ${c.savedSheets} sheets; ${fmt(c.savedLinealM)} lm; ${fmt(c.savedCoverAreaM2)} m²`,
    'Keep the original source grids, cutting order and profile/lap rules. Do not turn sheets face-down. Verify site lengths before ordering.',''];
  for(const g of c.groups){lines.push(`${name(g.sourceFaceId)} → ${name(g.destinationFaceId)}`,`Cut first: ${g.prerequisiteFaceIds.map(name).join(' → ')}; then finish ${name(g.destinationFaceId)} fillers.`);
    for(const r of g.replacements)lines.push(`Retain ${r.offcutId} from ${name(r.sourceFaceId)} sheet ${r.sourceLaneIndex+1} (parent ${r.rootDemandId}); ${r.rotation===180?'turn end-for-end, face-up':'keep orientation'}; trim square to ${(r.finishedLengthMm/1000).toFixed(3)} m; install at ${name(g.destinationFaceId)} position ${r.destinationLaneIndex+1}; lap ${r.destinationLap===1?'left to right':'right to left'} looking upslope from spouting.`);
    lines.push('');}
  return lines.join('\n');
}
export function salvageNoResultReport(result:SalvageResult):SalvageSearchReport{return result.report;}
