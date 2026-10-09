import type { Solution, WorkflowMetric } from '../core/types';
import { alternativeReference } from '../core/alternatives';
import { planQuality, planSignature, workflowQuality, comparePlans } from '../core/diagnostics';
import { simplerAssessment } from '../core/simplerPolicy';
import { lessMaterialAssessment } from '../core/lessMaterialPolicy';
import { reuseDepth } from '../core/reuseDepth';
import { escapeHtml as esc } from './svg';
import { icon } from './icons';
export type AlternativeObjective = 'simpler'|'less-material';
const name=(s:Solution)=>s.salvage?s.layoutLabel??'More reuse':s.objective==='simpler'?'Simpler cuts':s.objective==='less-material'?'Less material':s.objective==='recommended'||!s.objective?'Recommended':s.layoutLabel??'Cut plan';
const short=(n:number)=>n.toFixed(2);
function signed(n:number,suffix:string):string {return `${Math.abs(n)<.005?'0.00':(n>0?'+':'−')+short(Math.abs(n))} ${suffix}`;}
export function recommendedFor(current:Solution,saved:Solution[]):Solution|null {
  try{return alternativeReference(current,saved,'simpler');}catch{return null;}
}
/** Older plans are still viewable. Only a compatible, currently qualifying
 * alternative hides the search button. Never delete historical plans here. */
export function hasQualifyingAlternative(saved:Solution[],reference:Solution|null,objective:AlternativeObjective):boolean {
  if(!reference)return false;
  return saved.some(s=>{
    if(s.salvage||s.objective!==objective||s.status==='invalid'||s.sourceRevision!==reference.sourceRevision||s.facesRevision!==reference.facesRevision||
      s.comparison?.previousLayoutId!==(reference.layoutId??planSignature(reference))||s.decisionTrace?.historic)return false;
    try{return objective==='simpler'?simplerAssessment(reference,s,reference.profile).accepted:lessMaterialAssessment(reference,s,reference.profile).accepted;}
    catch{return false;}
  });
}
const descriptions:Record<string,string>={recommended:'Best balance of material use and cutting simplicity.',
  simpler:'Easier cutting, with a limited material increase.',
  'less-material':'Less purchased material, with a limited increase in cutting work.'};
export function comparisonCard(reference:Solution,s:Solution):string {
  const a=planQuality(reference),b=planQuality(s),width=s.profile.coverMm+s.profile.leftLapMm+s.profile.rightLapMm;
  const deltaLineals=(b.suppliedMm2-a.suppliedMm2)/width/1000,deltaCover=deltaLineals*s.profile.coverMm/1000;
  const deltaSheets=b.newSheets-a.newSheets;
  const changes=comparePlans(reference,s,s.objective==='simpler'?'simpler':'less-material').changedFaceIds.length;
  const wa=workflowQuality(reference,a),wb=workflowQuality(s,b);
  const metrics:[WorkflowMetric,string][]=[['sourceRelationships','material transfer'],['splitSets','split cut set'],
    ['reuseRuns','separate reuse run'],['recutRuns','recut run'],['fillerSeparators','filler group'],
    ['freshCutRuns','fresh cutting run'],['primaryOperations','new cutting operation'],['stockLengthGroups','stock-length group']];
  const more:string[]=[],fewer:string[]=[];
  for(const [key,label]of metrics){const d=wb[key]-wa[key];if(d)(d>0?more:fewer).push(`${Math.abs(d)} ${d>0?'more':'fewer'} ${label}${Math.abs(d)===1?'':'s'}`);}
  const depth=(p:Solution)=>Math.max(0,...reuseDepth(p).values());
  const depthDelta=depth(s)-depth(reference);
  if(depthDelta>0)more.unshift(`${depthDelta} more reuse generation${depthDelta===1?'':'s'}`);
  const points=[...more,...fewer];
  const primary=points.slice(0,2).join(' · ');
  const details=points.length>2?`<details class="qc-work-changes"><summary>All cutting changes</summary><p>${esc(points.join(' · '))}.</p><small>Grouped workflow comparison, not an estimate of labour hours.</small></details>`:'';
  return `<div class="qc-plan-comparison" role="status" aria-label="Compared with Recommended">
    <small>Compared with Recommended</small><strong class="qc-comparison-amount">${signed(deltaCover,'m²')} · ${signed(deltaLineals,'lm')}</strong>
    <p class="qc-comparison-work">${deltaSheets>0?'+':deltaSheets<0?'−':''}${Math.abs(deltaSheets)} new sheet${Math.abs(deltaSheets)===1?'':'s'} · ${changes} face${changes===1?'':'s'} changed</p>
    <p>${esc(primary||(deltaCover<0?'Similar grouped cutting work.':'Cutting workflow remains similar.'))}${primary?'.':''}</p>${details}</div>`;
}
export function planChoices(current:Solution,saved:Solution[],selectedIndex:number,disabled:boolean):string {
  const reference=recommendedFor(current,saved),isReference=!!reference&&planSignature(current)===planSignature(reference);
  const simpler=hasQualifyingAlternative(saved,reference,'simpler'),material=hasQualifyingAlternative(saved,reference,'less-material');
  const disabledAttr=disabled||!reference||saved.length>=12?'disabled':'';
  const label=(s:Solution)=>name(s)+(s.engineVersion!=='2.21'?` (saved V${s.engineVersion??'older'})`:'');
  return `<section class="qc-plan-variants" id="qc-plan-choice" aria-label="Cut plan choices">
    ${saved.length>1?`<label class="qc-field">Cut plan<select data-plan-index aria-label="Choose saved cut plan" ${disabled?'disabled':''}>${saved.map((s,i)=>`<option value="${i}" ${i===selectedIndex?'selected':''}>${esc(label(s))}</option>`).join('')}</select></label>`:`<p class="qc-choice-title">${esc(label(current))}</p>`}
    <p class="qc-muted qc-choice-description">${esc(current.salvage?'Optional filler reuse. Retain the source cuts and follow the stated cut-first sequence.':descriptions[current.objective??'recommended']??'Saved cutting plan.')}</p>
    ${reference&&!isReference&&!current.salvage?comparisonCard(reference,current):''}
    ${!simpler||!material?`<div class="qc-alternative-options">
      ${!simpler?`<button data-action="alternative-menu" ${disabledAttr}><span>Try simpler cuts ${icon('arrow')}</span><small>Less cutting work; at most 3% extra material, capped at 10 m².</small></button>`:''}
      ${!material?`<button data-action="alternative-material" ${disabledAttr}><span>Try less material ${icon('arrow')}</span><small>Worthwhile material savings without a much busier cut plan.</small></button>`:''}
      </div>`:''}
    ${!reference?'<p class="qc-muted">Recalculate Recommended for these reviewed shapes before requesting alternatives.</p>':!simpler||!material?'<p class="qc-muted qc-alternative-anchor">Both searches keep Recommended unchanged.</p>':''}
    ${saved.length>=12?'<p class="qc-muted">Saved-plan limit reached. Export the plan you want to keep.</p>':''}
  </section>`;
}
export function noAlternativeDialog(objective:AlternativeObjective,current:Solution|null):string {
  const title=objective==='simpler'?'No worthwhile simpler option found':'No worthwhile material-saving option found';
  const body=objective==='simpler'?'We looked for an easier cutting plan without adding too much material. None of the options we checked was worth the trade-off.':
    'We looked for a material saving worth the extra cutting work. None of the options we checked met that balance. Smaller savings need almost unchanged cutting work.';
  const recommended=current?.objective==='recommended'||!current?.objective;
  return `<dialog class="qc-result-dialog" aria-labelledby="qc-result-title" aria-describedby="qc-result-description">
    <h2 id="qc-result-title">${title}</h2><p id="qc-result-description">${body} Your ${recommended?'recommended':'current'} plan is unchanged.</p>
    <p class="qc-muted">This was a limited search, not proof that no other option exists. You can try again.</p>
    <button class="primary" data-action="dismiss-alternative-result" autofocus>Keep ${recommended?'recommended':'current'} plan</button></dialog>`;
}
