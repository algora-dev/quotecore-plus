/** Optional second-step search: preserve Recommended, retain preference-rejected
 * physical candidates, and compare complete source/destination arrangements. */
import type { Solution, SolveRequest } from './types';
import type { SearchHooks } from './solver';
import { validateSolution, optimiseLayouts } from './solver';
import { validateDraft } from './editing';
import { searchGlobalBanks } from './globalBanks';
import { PortfolioCandidates, PORTFOLIO_POLICY, selectPlanPortfolio, type PortfolioResult, type PortfolioSearchOptions } from './portfolio';

class PortfolioDeadline extends Error { constructor(){super('Comparison search budget reached.');this.name='PortfolioDeadline';} }
export function optimisePortfolio(request:SolveRequest,options:PortfolioSearchOptions,hooks:SearchHooks={}):PortfolioResult {
  const reference=options.previous;
  if(reference.salvage||reference.placements.some(p=>p.manual)||reference.objective&&reference.objective!=='recommended')throw new Error('Compare from the unchanged Recommended plan, not a manually edited or salvage variant.');
  const validate=(s:Solution)=>validateDraft({schemaVersion:1,...request,solution:s});
  if(validate(reference).some(i=>i.severity==='error'))throw new Error('The reference is stale or fails physical checks. Recalculate Recommended first.');
  const effort=options.maxMilliseconds??PORTFOLIO_POLICY.defaultSearchMilliseconds;
  if(!Number.isFinite(effort)||effort<0||effort>PORTFOLIO_POLICY.maximumSearchMilliseconds)throw new Error('Comparison effort must be between zero and 25 seconds.');
  const attempt=options.attempt??0;
  if(!Number.isInteger(attempt)||attempt<0||attempt>10000)throw new Error('Invalid comparison attempt.');
  const started=performance.now(),clock=hooks.now??(()=>performance.now()),began=clock();
  const elapsed=()=>Math.max(performance.now()-started,clock()-began);
  const pool=new PortfolioCandidates();
  for(const s of (options.saved??[]).slice(0,12))pool.add(s);
  let bounded=false,tried=0,planned=0;
  const check=()=>{if(hooks.shouldCancel?.())throw new Error('Offcut search cancelled.');if(elapsed()>=effort)throw new PortfolioDeadline();return false;};
  const retain=(s:Solution)=>{pool.add(s);hooks.onPortfolioCandidate?.(s);};
  try{
    check();
    // Save time for a real simpler candidate search; one common request covers
    // both directions of the material/work trade-off without extra user clicks.
    const remaining=Math.max(0,effort-elapsed()),globalMs=Math.min(20_000,Math.max(0,remaining-Math.min(2000,remaining*.15)));
    const global=searchGlobalBanks(request,reference,validateSolution,{...hooks,shouldCancel:check,onPortfolioCandidate:retain,
      portfolioSearch:{milliseconds:globalMs,maximumVariants:PORTFOLIO_POLICY.maximumVariants,attempt},
      planSearch:{objective:'less-material',referenceSolution:reference,attempt}});
    tried+=global.report.variantsTried;planned+=global.report.variantsPlanned;bounded ||= global.report.budgetReached;
    check();hooks.onStage?.('comparing-plans');
    // The old Simpler policy remains available through the API. Here its complete
    // final candidates are retained BEFORE the convenience preference gate.
    const simple=optimiseLayouts(request,{...hooks,portfolioSearch:undefined,shouldCancel:check,onPortfolioCandidate:retain,
      onCheckedCandidate:undefined,planSearch:{objective:'simpler',attempt,referenceSolution:reference}});
    for(const s of simple)pool.add(s);
  }catch(e){if(e instanceof PortfolioDeadline)bounded=true;else throw e;}
  if(hooks.shouldCancel?.())throw new Error('Offcut search cancelled.');hooks.onStage?.('comparing-plans');
  return selectPlanPortfolio(request,reference,pool.solutions(),validate,{candidateCount:pool.count+1,budgetReached:bounded,
    elapsedMs:elapsed(),searchMilliseconds:effort,variantsTried:tried,variantsPlanned:planned,status:bounded?'bounded':'complete'},options.maxPlans??PORTFOLIO_POLICY.maximumPlans);
}
