import { choice, ensure, id, ids, integer, list, record } from './validation';
export const ACTIONS=['analyze_documents','prepare_measurements','prepare_estimate','prepare_quote','propose_memory','activate_memory','send_quote','configure_followups','delete_source','change_permissions'] as const;
export type Action=typeof ACTIONS[number];
export type AgentPolicy={companyId:string;version:number;mode:'manual'|'on_demand'|'assisted'|'intelligent';enabledActions:Action[];modelIds:string[];jobBudgetMicros:number;companyBudgetMicros:number;maxAttempts:number;maxTaskMs:number};
export function parsePolicy(v:unknown):AgentPolicy {
  const r=record(v,'policy',['companyId','version','mode','enabledActions','modelIds','jobBudgetMicros','companyBudgetMicros','maxAttempts','maxTaskMs']);
  const enabledActions=list(r.enabledActions,'enabledActions',(x,f)=>choice(x,f,ACTIONS),ACTIONS.length);
  ensure(new Set(enabledActions).size===enabledActions.length,'duplicate action');
  return {companyId:id(r.companyId,'companyId'),version:integer(r.version,'version',1),mode:choice(r.mode,'mode',['manual','on_demand','assisted','intelligent'] as const),enabledActions,modelIds:ids(r.modelIds,'modelIds'),jobBudgetMicros:integer(r.jobBudgetMicros,'jobBudgetMicros'),companyBudgetMicros:integer(r.companyBudgetMicros,'companyBudgetMicros'),maxAttempts:integer(r.maxAttempts,'maxAttempts',1,10),maxTaskMs:integer(r.maxTaskMs,'maxTaskMs',1,3600000)};
}
export function disabledPolicy(companyId:string):AgentPolicy {return parsePolicy({companyId,version:1,mode:'manual',enabledActions:[],modelIds:[],jobBudgetMicros:0,companyBudgetMicros:0,maxAttempts:1,maxTaskMs:60000});}
