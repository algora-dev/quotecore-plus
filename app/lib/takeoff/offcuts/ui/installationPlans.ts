import type { Solution, SolveRequest } from '../core/types';
import { installationGuides } from '../core/installationPlan';
import { planSignature } from '../core/diagnostics';
import { quantitySummary } from '../core/quantities';
import { escapeHtml as esc } from './svg';
import { icon } from './icons';
export function installationPanel(r:SolveRequest,current:Solution,saved:Solution[],disabled:boolean):string{
  const names=new Map(r.faces.map(f=>[f.id,f.name])),id=planSignature(current),options=saved.filter(s=>!!s.installationPlan);
  const q=quantitySummary(current),base=current.installationPlan?saved.find(s=>planSignature(s)===current.installationPlan!.referenceLayoutId):undefined;
  const old=base?quantitySummary(base):null,delta=old?q.purchasedLinealM-old.purchasedLinealM:0;
  const guides=installationGuides(r,current),anchored=guides.filter(g=>g.anchorId);
  return `<section class="qc-installation-plans" id="qc-installation-plans" aria-label="Alternative installation plans">
    <strong>Donors and starting points</strong><p class="qc-muted">Try generating cuts from the opposite areas. A different setout may use more material. Keeps this plan unchanged.</p>
    ${options.length?`<div class="qc-portfolio-cards">${options.map(s=>{const n=quantitySummary(s);return `<button class="qc-portfolio-option" data-action="choose-portfolio-plan" data-index="${saved.indexOf(s)}" aria-pressed="${planSignature(s)===id}" ${disabled?'disabled':''}><strong>${esc(s.layoutLabel??'Alternative installation')}</strong><span>${n.newSheetCount} sheets · ${n.purchasedLinealM.toFixed(2)} lm</span><small>${s.installationPlan!.kind==='reversed-donors'?'Donors: '+esc(s.installationPlan!.donorFaceIds.map(x=>names.get(x)??x).join(' + ')):'Fresh barge starts, existing donor arrangement'}</small></button>`;}).join('')}</div>`:''}
    <button class="qc-compare-plans" data-action="installation-search" ${disabled||saved.length>=12||current.salvage||current.placements.some(p=>p.manual)?'disabled':''}>Try different donors & starts ${icon('arrow')}</button>
    ${current.installationPlan?.reuseEndTrimMm?`<p><strong>${current.installationPlan.reuseEndTrimMm} mm trimming room checked</strong> at the length ends of assigned reversed-receiver pieces. Keep the marked setout; this does not certify arbitrary grid shifts.</p>`:''}
    ${old?`<p class="qc-installation-delta"><strong>${Math.abs(delta).toFixed(2)} lm ${delta>=0?'extra':'less'} · ${(Math.abs(delta)*r.profile.coverMm/1000).toFixed(2)} m² ${delta>=0?'extra':'less'}</strong> than the plan this option was based on. Review the actual cutting sequence before choosing.</p>`:''}
    <details class="qc-installation-guide" ${current.installationPlan?'open':''}><summary>Starting points and fresh sheets</summary>
      <p>Sheet marks are cover boundaries, not physical overhang. New sheets are purchased full-width; coloured shapes show their installed portions.</p>
      ${guides.map(g=>`<div class="qc-installation-face"><strong>${esc(g.name)} · ${g.freshCount} new / ${g.reuseCount} reused</strong><p>${esc(g.start)}. ${esc(g.setout)}</p><small>${g.freshLengths.map(x=>`${x.count} × ${(x.lengthMm/1000).toFixed(3)} m`).join('; ')||'No new sheets.'}${g.firstCoverMm!==null?` · edge cover shown ${Math.round(g.firstCoverMm)} mm`:''}</small>${g.transitionDemandIds.length?`<p>${g.transitionDemandIds.length} fresh transition-cut sheet${g.transitionDemandIds.length===1?'':'s'} included. Do not rely on those transition pieces forming an ideal triangle.</p>`:''}</div>`).join('')}
      <p><strong>No upper-valley start.</strong> Establish a clean cut line from a practical lower boundary. Keep pieces long enough to retrim; a short piece cannot be stretched.</p>
      ${anchored.some(g=>g.setout.includes('both sides'))?'<p>Junction markers establish setout on both sides. They do not reverse the side lap. The actual profile must permit the proposed laying sequence.</p>':''}
      <p class="qc-muted">Fixed purchased parents and receiver grids remain assumptions of valley phase checks. Arbitrary changes to site setout are not certified. Profile and site review is still required.</p>
      <button data-action="export-installation-guide">Export starting-point guide</button>
    </details>
  </section>`;
}
export function noInstallationDialog():string{return `<dialog class="qc-result-dialog" data-installation-dialog aria-labelledby="qc-installation-title"><h2 id="qc-installation-title">No checked alternative start found</h2><p>No distinct donor reversal or barge-start arrangement passed the complete checks in this search. Your selected plan and saved options are unchanged.</p><p class="qc-muted">This was a bounded search. It does not prove that every reversed arrangement is impossible.</p><button class="primary" data-action="dismiss-installation-result" autofocus>Keep current plan</button></dialog>`;}
export const installationStyles=`.qc-installation-plans{border:1px solid var(--of-border,#e1e5eb);border-radius:12px;padding:12px;margin:14px 0}.qc-installation-plans p{font-size:12px;line-height:1.55}.qc-installation-face{margin:10px 0;padding:9px 0;border-top:1px solid var(--of-border,#e1e5eb)}.qc-installation-face>strong{font-size:12px}.qc-installation-guide>summary{font-size:12px;font-weight:600;cursor:pointer;padding:10px 0}.qc-installation-guide small{font-size:11px;color:var(--of-text-secondary)}.qc-installation-delta{padding:8px;background:var(--of-surface-accent,#fff5ed)}`;
