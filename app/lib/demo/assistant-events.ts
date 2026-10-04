import 'server-only';
import { readActiveDemoContext } from './context';
import { mutateDemoGuide, recordDemoEventBestEffort } from './progress';
import { acknowledge } from './model';
/** Only called with the real committed ActionView, never a client event. */
export async function demoAssistantCommitted(companyId:string,action:{status:string;actionKind:string|null;target:{kind:string;id:string}|null}):Promise<void>{
 try{if(action.status!=='committed'||!action.target)return;const context=await readActiveDemoContext(companyId);if(!context)return;
   await mutateDemoGuide(context.sessionId,previous=>{
     if(action.actionKind==='draft_create')return acknowledge({...previous,assistant_quote_id:action.target!.id},'assistant.created',action.target!.id);
     if(previous.assistant_quote_id===action.target!.id)return acknowledge(previous,'assistant.edited',action.target!.id);
     return previous;
   });
 }catch{console.warn('[demo] committed assistant action; guide refresh pending');}
}
/** Invoked only after the existing V2 navigation endpoint validates card/target. */
export async function demoAssistantNavigated(companyId:string,recordId:string):Promise<void>{
 try{const context=await readActiveDemoContext(companyId);if(context?.tutorialState.seed.accepted_without_order===recordId)await recordDemoEventBestEffort(companyId,'assistant.found',recordId);}catch{console.warn('[demo] assistant navigation; guide refresh pending');}
}
