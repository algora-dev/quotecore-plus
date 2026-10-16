import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { loadAccess } from '@/app/lib/smart-assistant/v2/runtime.server';
import { readSession } from '@/app/lib/smart-assistant/v2/session.server';
import { activeGuideStep } from './guide';
import { readActiveDemoContext } from './context';
import { mutateDemoGuide } from './progress';
import { acknowledge } from './model';

/** Only called with the real committed ActionView, never a client event. */
export async function demoAssistantCommitted(companyId:string,action:{status:string;actionKind:string|null;target:{kind:string;id:string}|null}):Promise<void>{
 try{if(action.status!=='committed'||!action.target)return;const context=await readActiveDemoContext(companyId);if(!context)return;
   await mutateDemoGuide(context.sessionId,previous=>{
     // Both the initial create and the confirmed edit currently commit through
     // draft_create. Same-target detection must therefore happen FIRST; the old
     // order made assistant.edited unreachable and stranded the guide on step 2.
     if(action.actionKind==='draft_create'&&previous.assistant_quote_id===action.target!.id&&previous.acknowledgements['assistant.created'])return acknowledge(previous,'assistant.edited',action.target!.id);
     if(action.actionKind==='draft_create')return acknowledge({...previous,assistant_quote_id:action.target!.id},'assistant.created',action.target!.id);
     if(previous.assistant_quote_id===action.target!.id)return acknowledge(previous,'assistant.edited',action.target!.id);
     return previous;
   });
 }catch{console.warn('[demo] committed assistant action; guide refresh pending');}
}

/**
 * A final Assistant turn unlocks Finish only when the real, stored response card
 * from THAT run surfaced the seeded accepted quote and the quote is still
 * accepted with no material order. Assistant prose is intentionally not trusted
 * as completion evidence.
 */
export async function demoAssistantFoundResult(
  companyId:string, client:SupabaseClient, conversationId:string, runId:string,
):Promise<void>{
 try{
   const context=await readActiveDemoContext(companyId); if(!context)return;
   if(activeGuideStep(context.tutorialState)?.event!=='assistant.found'||context.tutorialState.assistant_found_ready_at)return;
   const expected=context.tutorialState.seed.accepted_without_order; if(!expected)return;
   const access=await loadAccess(client); if(access.companyId!==companyId)return;
   const session=await readSession(client,access,conversationId);
   const surfaced=session.cards.some(card=>{
     if(card.runId!==runId)return false;
     if(card.content.kind==='records')return card.content.options.some(option=>option.kind==='quote'&&option.id===expected);
     if(card.content.kind==='attention')return card.content.groups.some(group=>group.items.some(item=>item.kind==='quote'&&item.id===expected));
     return false;
   });
   if(!surfaced)return;
   // Re-check the business fact at the moment the helper unlocks. The demo seed
   // is deterministic, but visitors can freely explore and may create an order.
   const admin=createAdminClient();
   const [quote,order]=await Promise.all([
     admin.from('quotes').select('id,status').eq('id',expected).eq('company_id',companyId).maybeSingle(),
     admin.from('material_orders').select('id').eq('quote_id',expected).eq('company_id',companyId).limit(1).maybeSingle(),
   ]);
   if(quote.error||order.error||quote.data?.status!=='accepted'||order.data)return;
   await mutateDemoGuide(context.sessionId,previous=>{
     if(previous.acknowledgements['assistant.found']||previous.assistant_found_ready_at||activeGuideStep(previous)?.event!=='assistant.found')return previous;
     return {...previous,assistant_found_ready_at:new Date().toISOString(),assistant_found_record_ids:[expected]};
   });
 }catch{console.warn('[demo] assistant result found; guide refresh pending');}
}

/** Invoked only after the existing V2 navigation endpoint validates card/target. */
export async function demoAssistantNavigated(companyId:string,recordId:string):Promise<void>{
 try{
   const context=await readActiveDemoContext(companyId); if(!context)return;
   // Only a quote verified from the final Assistant response can complete the
   // lesson. Clicking an unrelated order/invoice card must never count.
   if(!context.tutorialState.assistant_found_record_ids?.includes(recordId))return;
   await mutateDemoGuide(context.sessionId,previous=>previous.assistant_found_record_ids?.includes(recordId)&&activeGuideStep(previous)?.event==='assistant.found'
     ?acknowledge(previous,'assistant.found',recordId):previous);
 }catch{console.warn('[demo] assistant navigation; guide refresh pending');}
}
