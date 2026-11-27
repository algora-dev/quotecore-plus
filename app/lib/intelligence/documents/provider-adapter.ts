import { ensure, hash, id, integer } from '../contracts/validation';
import type { IntelligenceProvider, ProviderRequest, ProviderResult } from '../policy/model-routing';
import { LIMITS } from './pages';

/** Explicit trusted transport port, not a registered production client. Transport must use
 * configured provider credentials, hard abort/response limits, no tools, no automatic retries,
 * and a trusted usage ledger. It must not derive settlement from generated model JSON. */
export interface DocumentTransport {
  send(request:{providerModel:string;requestKey:string;sourceJson:string;maxOutputTokens:number;signal:AbortSignal}):Promise<{requestId:string;outputJson:string;actualMicros:number|null}>;
}
export type ProviderMapping = { registryId:string; providerModel:string };
/** Default-off adapter for a future reviewed provider transport. No credentials or endpoint
 * defaults. requestKey is correlation metadata, NOT a provider idempotency guarantee. */
export class DocumentProviderAdapter implements IntelligenceProvider {
  constructor(private readonly transport:DocumentTransport,private readonly mappings:readonly ProviderMapping[],private readonly enabled=false){}
  async execute(request:ProviderRequest):Promise<ProviderResult>{
    ensure(this.enabled===true&&request.task==='extract_text','document provider disabled/task');
    hash(request.inputHash,'request hash');id(request.modelId,'model registry id');
    integer(request.maxOutputTokens,'output tokens',1,LIMITS.outputTokens);
    ensure(typeof request.input==='string'&&Buffer.byteLength(request.input,'utf8')<=100000,'provider request bytes');
    const matches=this.mappings.filter(m=>m.registryId===request.modelId);ensure(matches.length===1,'provider mapping');
    const providerModel=id(matches[0].providerModel,'provider model');
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),LIMITS.providerMs);
    try{
      const response=await this.transport.send({providerModel,requestKey:request.inputHash,sourceJson:request.input,maxOutputTokens:request.maxOutputTokens,signal:controller.signal});
      const actualMicros=response.actualMicros===null?null:integer(response.actualMicros,'trusted settlement');
      const requestId=id(response.requestId,'provider request id');
      // Preserve known usage even if output is malformed or oversized. The worker rejects null.
      let raw:unknown=null;
      if(typeof response.outputJson==='string'&&Buffer.byteLength(response.outputJson,'utf8')<=128000){try{raw=JSON.parse(response.outputJson);}catch{/* invalid model output */}}
      return {raw,actualMicros,requestId};
    }finally{clearTimeout(timer);}
  }
}
