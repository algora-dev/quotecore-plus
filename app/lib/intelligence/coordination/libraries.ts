import { normalizeAssistantCallName } from '../../smart-assistant/workflow-controller/call-names';
import type { LibraryCatalogItem } from '../../smart-assistant/library-workflow/contracts';
import { ensure, id, integer, text, unique } from '../contracts/validation';
import { parseScope, type JobScope } from '../contracts/evidence';
import { digest } from '../policy/approval';
/** Adapter supplies only company-authorized Smart Assistant catalog rows and
 * an epoch from current settings. No raw document can grant library access.
 * Matching is exact across names/call names; a collision always asks. */
export function libraryPreview(scope:JobScope,epoch:number,term:string,catalog:readonly LibraryCatalogItem[],evidenceIds:readonly string[]){
  const s=parseScope(scope);ensure(s.kind==='quote','canonical quote required');integer(epoch,'settings epoch',1);text(term,'profile name',200);ensure(catalog.length<=10000,'catalog size');ensure(evidenceIds.length<=100,'evidence count');evidenceIds.forEach(x=>id(x,'evidence'));unique(evidenceIds,x=>x,'evidence');
  const key=normalizeAssistantCallName(term);ensure(key,'profile name');
  const map=new Map<string,{id:string;name:string;callName:string|null}>();
  for(const row of catalog.filter(x=>x.active===true)){
    id(row.collectionId,'library');text(row.collectionName,'library name',200);if(row.collectionCallName!==null)text(row.collectionCallName,'library call name',80);
    const meta={id:row.collectionId,name:row.collectionName,callName:row.collectionCallName};const prior=map.get(meta.id);ensure(!prior||digest(prior)===digest(meta),'inconsistent library metadata');map.set(meta.id,meta);
  }
  const options=[...map.values()].filter(x=>[x.name,x.callName].some(v=>normalizeAssistantCallName(v)===key)).sort((a,b)=>a.id.localeCompare(b.id));
  const result={scope:s,epoch,term,options,evidenceIds:[...evidenceIds],recommendedId:options.length===1?options[0].id:null,reason:options.length===1?'exact_match':options.length>1?'ambiguous':'no_match',requiresProfileVerification:true as const,writeAuthorized:false as const};
  return {...result,previewDigest:digest(result)};
}
