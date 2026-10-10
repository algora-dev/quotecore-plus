import { searchInstallationPlans } from '../core/installationSearch';
import { fingerprint } from '../core/math';
import { optimisePortfolio } from '../core/portfolioSearch';
import { PortfolioCandidates, selectPlanPortfolio, type PortfolioResult } from '../core/portfolio';
import { optimiseAlternative, optimiseLayouts } from '../core/solver';
import { validateDraft } from '../core/editing';
import { searchSalvage } from '../core/salvage';
import type { Solution } from '../core/types';
import { WORKER_PROTOCOL, CALCULATION_LIMIT_MS, requestFingerprint, solutionFingerprint,
  type CalculationStage, type CheckedPlan, type CheckedPortfolio, type WorkerMessage, type WorkerRequest } from './protocol';
/** No timers are relied on inside the worker. Cooperative checks bound loops;
 * the UI's separate watchdog handles an uninterruptible routine. */
export function runWorkerCalculation(input:WorkerRequest,send:(message:WorkerMessage)=>void):void {
  const id=input?.id??'unknown';const post=(m:Omit<WorkerMessage,'protocol'|'id'>):void=>send({...m,protocol:WORKER_PROTOCOL,id} as WorkerMessage);
  let stage:CalculationStage='starting-worker';
  const started=performance.now(),limit=Number.isFinite(input.limitMs)?Math.max(1,Math.min(120_000,input.limitMs)):CALCULATION_LIMIT_MS;
  const cancelled=():boolean=>{if(performance.now()-started>=limit){const e=new Error('Calculation time limit reached. Only a previously checked complete plan may be retained.');e.name='CalculationLimit';throw e;}return false;};
  const onStage=(s:CalculationStage):void=>{cancelled();if(stage!==s){stage=s;post({kind:'stage',stage} as WorkerMessage);}};
  const onProgress=(completed:number,total:number):void=>{cancelled();post({kind:'progress',completed,total,stage} as WorkerMessage);};
  const checked=(s:Solution):CheckedPlan=>{
    cancelled();const checks=validateDraft({schemaVersion:1,...input.request,solution:s});cancelled();
    const error=checks.find(i=>i.severity==='error');
    if(error||s.status==='invalid')throw new Error(`No complete checked plan: ${error?.message??'physical validation failed'}`);
    return {solution:s,checks,requestFingerprint:requestFingerprint(input.request),solutionFingerprint:solutionFingerprint(s)};
  };
  try {
    if(input.protocol!==WORKER_PROTOCOL)throw new Error('Worker/page version mismatch. Reload the updated app and resume the saved review.');
    const hooks={onProgress,onStage,shouldCancel:cancelled};
    const checkedPortfolio=(result:PortfolioResult):CheckedPortfolio=>({report:result.report,reportFingerprint:fingerprint(result.report),plans:result.plans.map(checked)});
    if(input.installation){
      const result=searchInstallationPlans(input.request,input.installation,hooks);
      onStage('final-validation');const plans=result.plans.map(checked);
      onStage('returning-result');post({kind:'installation-result',result,plans,reportFingerprint:fingerprint(result.report)} as WorkerMessage);
    }else if(input.portfolio){
      const result=optimisePortfolio(input.request,input.portfolio,hooks);
      onStage('final-validation');const portfolio=checkedPortfolio(result);
      onStage('returning-result');post({kind:'portfolio-result',portfolio} as WorkerMessage);
    }else if(input.salvage){
      onStage('physical-validation');const result=searchSalvage(input.request,input.salvage.base,hooks);
      onStage('final-validation');const plan=result.solution?checked(result.solution):undefined;
      onStage('returning-result');post({kind:'salvage-result',result,plan} as WorkerMessage);
    }else if(input.alternative){
      const result=optimiseAlternative(input.request,input.alternative,hooks);
      onStage('final-validation');const plan=result.solution?checked(result.solution):undefined;
      onStage('returning-result');post({kind:'alternative-result',result,plan} as WorkerMessage);
    }else{
      let best=Infinity;const retained=new PortfolioCandidates();
      const layouts=optimiseLayouts(input.request,{...hooks,onPortfolioCandidate:s=>retained.add(s),onCheckedCandidate:s=>{
        if(s.metrics.newMaterialMm2>=best)return;
        // Some search candidates fail draft-level canonical checks. They are not
        // fallbacks; keep searching without exporting or trusting them.
        try{const plan=checked(s);best=s.metrics.newMaterialMm2;post({kind:'checked-plan',plan} as WorkerMessage);}
        catch(error){if(error instanceof Error&&error.name==='CalculationLimit')throw error;}
      }});
      onStage('final-validation');if(!layouts.length)throw new Error('No complete plan was produced. Export the reviewed draft for diagnosis.');
      const plan=checked(layouts[0]);
      onStage('comparing-plans');
      // Reuse already-computed checked candidates: no second full scan is needed
      // to show lower-material plans rejected solely for workflow preferences.
      const result=selectPlanPortfolio(input.request,plan.solution,[...layouts,...retained.solutions()],
        s=>validateDraft({schemaVersion:1,...input.request,solution:s}),
        {candidateCount:retained.count,status:'cached',budgetReached:plan.solution.globalDonorSearch?.budgetReached??false,
          variantsTried:plan.solution.globalDonorSearch?.variantsTried??0,variantsPlanned:plan.solution.globalDonorSearch?.variantsPlanned??0});
      const portfolio=checkedPortfolio(result);
      onStage('returning-result');post({kind:'result',plan,portfolio} as WorkerMessage);
    }
  }catch(error){post({kind:'error',code:error instanceof Error&&error.name==='CalculationLimit'?'CALCULATION_LIMIT':'WORKER_ERROR',message:error instanceof Error?error.message:String(error)} as WorkerMessage);}
}
