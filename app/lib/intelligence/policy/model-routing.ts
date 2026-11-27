import { type AgentPolicy } from '../contracts/policy';
import { type Spend,canReserve } from './admission';
import { ensure,id,integer,hash } from '../contracts/validation';
export type ModelTask='classify'|'extract_text'|'interpret_drawing'|'reconcile'|'draft_language';
export type ModelCandidate={id:string;provider:string;validatedTasks:readonly ModelTask[];vision:boolean;structuredOutput:boolean;maxInputTokens:number;maxOutputTokens:number;inputMicrosPerMillion:number;outputMicrosPerMillion:number;rateVersion:string;evalVersion:string;enabled:boolean;exceptional:boolean};
export type ModelRequest={task:ModelTask;needsVision:boolean;inputTokensUpperBound:number;outputTokensUpperBound:number;excludeIds:readonly string[];allowEscalation:boolean};
export type Route={model:ModelCandidate;reserveMicros:number};
/** Prices, capability and evaluation status are supplied by a trusted registry. No production defaults. */
export function routeModel(policy:AgentPolicy,models:readonly ModelCandidate[],request:ModelRequest,job:Spend,company:Spend):Route|null {
  if(policy.mode==='manual')return null;
  integer(request.inputTokensUpperBound,'inputTokensUpperBound',1,10000000);integer(request.outputTokensUpperBound,'outputTokensUpperBound',1,10000000);
  if(request.excludeIds.length&&!request.allowEscalation) return null;
  ensure(new Set(models.map(m=>m.id)).size===models.length,'duplicate model IDs');
  const eligible:Route[]=[];
  for(const m of models) {
    if(m.enabled!==true||m.exceptional!==false||!policy.modelIds.includes(m.id)||request.excludeIds.includes(m.id)||m.structuredOutput!==true||!m.validatedTasks.includes(request.task)||(request.needsVision&&m.vision!==true))continue;
    id(m.id,'model id');id(m.provider,'provider');id(m.rateVersion,'rateVersion');id(m.evalVersion,'evalVersion');
    integer(m.maxInputTokens,'maxInputTokens',1);integer(m.maxOutputTokens,'maxOutputTokens',1);
    integer(m.inputMicrosPerMillion,'input rate',1,1000000000);integer(m.outputMicrosPerMillion,'output rate',1,1000000000);
    if(request.inputTokensUpperBound>m.maxInputTokens||request.outputTokensUpperBound>m.maxOutputTokens)continue;
    // Round each side upward; safe arithmetic with validated bounded inputs.
    const inputProduct=m.inputMicrosPerMillion*request.inputTokensUpperBound,outputProduct=m.outputMicrosPerMillion*request.outputTokensUpperBound;
    ensure(Number.isSafeInteger(inputProduct)&&Number.isSafeInteger(outputProduct),'model reservation arithmetic');
    const reserveMicros=Math.ceil(inputProduct/1e6)+Math.ceil(outputProduct/1e6);
    if(canReserve(policy,job,company,reserveMicros))eligible.push({model:m,reserveMicros});
  }
  return eligible.sort((a,b)=>a.reserveMicros-b.reserveMicros||(a.model.id<b.model.id?-1:a.model.id>b.model.id?1:0))[0]||null;
}
export type ProviderRequest={modelId:string;task:ModelTask;inputHash:string;input:string;maxOutputTokens:number};
export type ProviderResult={raw:unknown;actualMicros:number|null;requestId:string};
/** Provider interface only. Real adapter, timeouts, reservations, retries and accounting belong in 1B/2A. */
export interface IntelligenceProvider { execute(request:ProviderRequest):Promise<ProviderResult> }
export class FixtureProvider implements IntelligenceProvider {
  readonly calls:ProviderRequest[]=[];
  constructor(private readonly fixtures:ReadonlyMap<string,ProviderResult>){}
  async execute(request:ProviderRequest):Promise<ProviderResult>{
    hash(request.inputHash,'inputHash');integer(request.maxOutputTokens,'maxOutputTokens',1);this.calls.push({...request});
    const result=this.fixtures.get(request.inputHash);if(!result)throw new Error('No intelligence fixture for input hash');return result;
  }
}
