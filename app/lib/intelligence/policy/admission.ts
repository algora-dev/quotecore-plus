import { type JobScope,sameScope } from '../contracts/evidence';
import { type Action,type AgentPolicy,parsePolicy } from '../contracts/policy';
import { integer } from '../contracts/validation';
export type AuthoritySnapshot={scope:JobScope;actorId:string;entitled:boolean;revoked:boolean;demo:boolean;permittedActions:readonly Action[];policyVersion:number;jobRevision:number};
export type ActionRequest={scope:JobScope;actorId:string;action:Action;policyVersion:number;jobRevision:number;trigger:'explicit'|'event'};
export type Admission={allowed:true}|{allowed:false;reason:string};
/** Caller must load authority from trusted server state immediately before action. */
export function admit(policyRaw:unknown,authority:AuthoritySnapshot,request:ActionRequest):Admission {
  const p=parsePolicy(policyRaw);const deny=(reason:string):Admission=>({allowed:false,reason});
  if(!sameScope(authority.scope,request.scope)||p.companyId!==request.scope.companyId||authority.actorId!==request.actorId) return deny('scope_or_actor');
  if(authority.entitled!==true||authority.revoked!==false||authority.demo!==false) return deny('access');
  if(p.version!==authority.policyVersion||p.version!==request.policyVersion||authority.jobRevision!==request.jobRevision) return deny('stale_revision');
  if(p.mode==='manual'||(p.mode==='on_demand'&&request.trigger!=='explicit')) return deny('mode');
  if(!p.enabledActions.includes(request.action)||!authority.permittedActions.includes(request.action)) return deny('permission');
  // No outbound or permanent mutations through this first-stage agent policy, even with approval.
  if(!(['analyze_documents','prepare_measurements','prepare_estimate','prepare_quote','propose_memory'] as readonly Action[]).includes(request.action)) return deny('outside_pilot');
  if(p.mode==='assisted'&&request.trigger==='event'&&request.action!=='analyze_documents') return deny('explicit_request_required');
  return {allowed:true};
}
export type Spend={spentMicros:number;reservedMicros:number};
export function canReserve(p:AgentPolicy,job:Spend,company:Spend,amountMicros:number):boolean {
  integer(amountMicros,'amountMicros',1);
  const fits=(s:Spend,cap:number)=>{integer(s.spentMicros,'spent');integer(s.reservedMicros,'reserved');return s.spentMicros<=cap&&s.reservedMicros<=cap-s.spentMicros&&amountMicros<=cap-s.spentMicros-s.reservedMicros;};
  return fits(job,p.jobBudgetMicros)&&fits(company,p.companyBudgetMicros);
}
/** Unknown provider usage retains the full reservation. Actual overage is reported, not hidden. */
export function settleReservation(reservedMicros:number,actualMicros:number|null) {
  integer(reservedMicros,'reservation',1);
  if(actualMicros===null) return {releasedMicros:0,chargedMicros:0,heldMicros:reservedMicros,overageMicros:0};
  integer(actualMicros,'actual');return {releasedMicros:reservedMicros,chargedMicros:actualMicros,heldMicros:0,overageMicros:Math.max(0,actualMicros-reservedMicros)};
}
