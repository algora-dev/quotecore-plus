import type { Solution, WorkflowMetric } from '../core/types';
import type { PortfolioChoice, PortfolioReport } from '../core/portfolio';
import { planSignature } from '../core/diagnostics';
import { recommendedFor, comparisonCard } from './alternativePlans';
import { escapeHtml as esc } from './svg';
import { icon } from './icons';
const number=(v:number)=>v.toFixed(2);
export function choiceTitle(choice:PortfolioChoice):string {
  return choice.roles.includes('recommended')?'Recommended':choice.roles.includes('least-material')?'Least material':
    choice.roles.includes('simplest')?'Simplest cuts':choice.roles.includes('fewer-sheets')?'Fewer new sheets':'Different cutting plan';
}
const workLabels:[WorkflowMetric,string][]=[['sourceRelationships','material transfer'],['splitSets','split cut set'],['reuseRuns','separate reuse run'],
  ['recutRuns','recut run'],['freshCutRuns','fresh cutting run'],['fillerSeparators','filler group'],['primaryOperations','new cutting operation'],['stockLengthGroups','stock-length group']];
function workText(c:PortfolioChoice):string[] {
  return workLabels.flatMap(([k,label])=>c.workflowDelta[k]?[`${Math.abs(c.workflowDelta[k])} ${c.workflowDelta[k]>0?'more':'fewer'} ${label}${Math.abs(c.workflowDelta[k])===1?'':'s'}`]:[]);
}
function summary(c:PortfolioChoice):string {
  if(c.roles.includes('recommended'))return 'Kept as your original comparison point.';
  const words=workText(c),higher=words.filter(w=>w.includes(' more ')),lower=words.filter(w=>w.includes(' fewer '));
  return [...higher,...lower].slice(0,2).join(' · ')||'Similar grouped cutting work.';
}
function card(c:PortfolioChoice,index:number,active:boolean,disabled:boolean):string {
  const difference=c.savedCoverM2>.005?`${number(c.savedCoverM2)} m² less`:c.savedCoverM2<-.005?`${number(-c.savedCoverM2)} m² extra`:'Same material';
  const badges=c.roles.filter(r=>r==='simplest'&&!c.roles.includes('recommended')?false:(r==='simplest'||r==='least-material')&&r!==c.roles[0]);
  return `<button class="qc-portfolio-option" data-action="choose-portfolio-plan" data-index="${index}" aria-pressed="${active}" ${disabled?'disabled':''}>
    <span class="qc-portfolio-heading"><strong>${esc(choiceTitle(c))}</strong><span aria-hidden="true">${active?'✓':''}</span></span>
    <span>${c.newSheets} sheets · ${number(c.linealM)} lm</span><small>${c.roles.includes('recommended')?badges.map(b=>b==='simplest'?'Also simplest found':'Also lowest material found').join(' · ')||'Original plan':difference+' than Recommended'}</small>
  </button>`;
}
function tradeOff(c:PortfolioChoice,faceNames:Map<string,string>):string {
  if(c.roles.includes('recommended'))return '';
  const direction=c.savedCoverM2>=0?'less':'extra',words=workText(c);
  return `<div class="qc-plan-comparison" role="status" aria-label="Compared with Recommended">
    <small>Compared with Recommended</small><strong class="qc-comparison-amount">${number(Math.abs(c.savedCoverM2))} m² ${direction} · ${number(Math.abs(c.savedLinealM))} lm ${direction}</strong>
    <p>${esc(summary(c))}</p><p>${c.changedFaceIds.length} faces changed. Compare the coloured source areas before choosing.</p>
    <details class="qc-work-changes"><summary>Cutting and source details</summary><p>${esc(words.join(' · ')||'No tracked work changes.')}</p>
    <p><strong>Where the cuts come from</strong></p>${c.sourceRoutes.map(route=>`<p>${esc(route.fromFaceIds.map(id=>faceNames.get(id)??id).join(' + '))}${route.recut?' via '+esc(faceNames.get(route.cutOnFaceId)??route.cutOnFaceId):''} → ${esc(faceNames.get(route.toFaceId)??route.toFaceId)} · ${route.count} reused sheet${route.count===1?'':'s'}</p>`).join('')}
    ${c.warnings.map(w=>`<p>${esc(w)}</p>`).join('')}<small>Workflow counts are guides, not labour-hour estimates. All offered options pass the same physical checks.</small></details>
  </div>`;
}
export function portfolioChoices(current:Solution,saved:Solution[],selectedIndex:number,disabled:boolean,report:PortfolioReport|null,faces:Array<{id:string;name:string}>=[]):string {
  const reference=recommendedFor(current,saved),id=planSignature(current),indices=new Map(saved.map((s,i)=>[planSignature(s),i]));
  const choices=report?.choices.filter(c=>indices.has(c.layoutId))??[];
  const currentChoice=choices.find(c=>c.layoutId===id);
  const visible=choices.slice(0,3),more=choices.slice(3);
  const menu=saved.length>1?`<label class="qc-field">Saved cut plan<select data-plan-index aria-label="Choose saved cut plan" ${disabled?'disabled':''}>${saved.map((s,i)=>{
    const choice=choices.find(c=>c.layoutId===planSignature(s));return `<option value="${i}" ${i===selectedIndex?'selected':''}>${esc(choice?choiceTitle(choice):s.layoutLabel??'Saved plan')}${s.engineVersion!=='2.23'?` · V${esc(s.engineVersion??'older')}`:''}</option>`;
  }).join('')}</select></label>`:'';
  return `<section class="qc-plan-variants qc-portfolio" id="qc-plan-choice" aria-label="Compare cutting plans">
    <div class="qc-portfolio-title"><strong>${choices.length>1?'Choose your cutting plan':esc(current.layoutLabel??'Recommended')}</strong>${choices.length>1?`<small>${choices.length} checked options</small>`:''}</div>
    ${choices.length>1?`<div class="qc-portfolio-cards">${visible.map(c=>card(c,indices.get(c.layoutId)!,id===c.layoutId,disabled)).join('')}</div>`:'<p class="qc-muted">Best balance found so far. Other physically checked options can be compared without changing this plan.</p>'}
    ${more.length?`<details class="qc-more-plans" ${more.some(c=>c.layoutId===id)?'open':''}><summary>${more.length} more checked option${more.length===1?'':'s'}</summary><div class="qc-portfolio-cards">${more.map(c=>card(c,indices.get(c.layoutId)!,id===c.layoutId,disabled)).join('')}</div></details>`:''}
    ${menu}
    ${currentChoice?tradeOff(currentChoice,new Map(faces.map(f=>[f.id,f.name]))):reference&&id!==planSignature(reference)&&!current.salvage?comparisonCard(reference,current):''}
    <button class="qc-compare-plans" data-action="compare-plans" ${disabled||!reference||saved.length>=12?'disabled':''}>${report?.status==='complete'||report?.status==='bounded'?'Search again for options':'Compare more cutting plans'} ${icon('arrow')}</button>
    <p class="qc-muted">Optional search, usually up to 20–25 seconds plus final checks. Keeps your current plan selected. Physical fit rules are unchanged.</p>
    ${report?`<p class="qc-muted qc-portfolio-limit">${report.status==='cached'?'Options retained from the first calculation.':report.budgetReached?'Search limit reached; complete checked options were kept.':'Comparison search completed.'} “Least material” and “simplest” refer to this bounded set, not a guaranteed optimum. One plan may be both.</p>`:''}
    ${!reference?'<p class="qc-muted">Recalculate Recommended before comparing alternatives.</p>':''}
    ${saved.length>=12?'<p class="qc-muted">Saved-plan limit reached. Export the plans you want to keep.</p>':''}
  </section>`;
}
export function noPortfolioDialog():string {
  return `<dialog class="qc-result-dialog" data-portfolio-dialog aria-labelledby="qc-portfolio-result-title"><h2 id="qc-portfolio-result-title">No additional distinct plan found</h2>
    <p>The checked options did not offer a useful different arrangement within this search. Your current plan and measurements are unchanged.</p>
    <p class="qc-muted">This is a bounded search, not proof that every alternative was tried. Incorrect fits, laps or reused pieces are never offered.</p>
    <button class="primary" data-action="dismiss-portfolio-result" autofocus>Keep current plan</button></dialog>`;
}
export const portfolioStyles=`
.qc-portfolio-title{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:10px 0}
.qc-portfolio-title small{font-size:11px;color:var(--of-text-secondary)}
.qc-portfolio-cards{display:grid;gap:7px}.qc-portfolio-option{display:grid;text-align:left;height:auto;white-space:normal;padding:10px 12px;gap:3px;width:100%;line-height:1.4}
.qc-portfolio-heading{display:flex;justify-content:space-between;gap:8px}.qc-portfolio-option>span:nth-child(2){font-size:12px;font-weight:400}.qc-portfolio-option small{font-size:11px;font-weight:400;color:var(--of-text-secondary)}
.qc-portfolio-option[aria-pressed=true]{border:2px solid var(--of-border-active,#e85b18);background:var(--of-surface-accent,#fff5ed);padding:9px 11px}
.qc-portfolio-option:focus-visible{outline:2px solid var(--of-border-active,#e85b18);outline-offset:2px}.qc-compare-plans{width:100%;margin:10px 0 2px;display:flex;align-items:center;justify-content:space-between}
.qc-more-plans{margin:8px 0}.qc-more-plans summary{cursor:pointer;font-size:12px;padding:5px 0}.qc-portfolio .qc-field{margin:10px 0}.qc-portfolio-limit{font-size:11px}
@media(forced-colors:active){.qc-portfolio-option[aria-pressed=true]{border:2px solid Highlight;outline:1px solid Highlight}}
`;
