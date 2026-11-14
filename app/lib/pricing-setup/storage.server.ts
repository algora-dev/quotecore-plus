import 'server-only';
import type {SupabaseClient} from '@supabase/supabase-js';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { createSupabaseServerClient, requireCompanyContext, requireUser } from '@/app/lib/supabase/server';
import { createHash } from 'node:crypto';
import { draftFromExtraction } from './roofing-rules';
import { pricingDraftSchema, type ExtractedLine, type PricingDraft, type PricingDraftRow, type PricingSession } from './domain';

export async function scopedContext(){
 if(process.env.NEXT_PUBLIC_PRICING_SETUP_ENABLED!=='true')throw Error('Pricing Setup is not enabled for this deployment.');
 const authUser=await requireUser();
 if(authUser.is_anonymous)throw Error('Create a free workspace to use Pricing Setup.');
 const profile=await requireCompanyContext();
 const user=await createSupabaseServerClient();
 return {profile,user,admin:createAdminClient() as unknown as SupabaseClient};
}
export function digest(draft:PricingDraft){return createHash('sha256').update(JSON.stringify(draft)).digest('hex');}
export async function reservePricingCall(kind:'extract'|'voice'|'explain'){
 const {user}=await scopedContext();
 const {data,error}=await (user as unknown as SupabaseClient).rpc('pricing_setup_reserve_call',{p_operation:kind});
 if(error)throw Error('Pricing Setup is not configured. Ask your administrator to apply its migration.');
 if(data!==true)throw Error('Your daily assistant limit has been reached. You can continue reviewing existing items.');
}
export async function insertPricingSession(args:{name:string;kind:string;basis:'unknown'|'purchase'|'selling'|'mixed';items?:ExtractedLine[];draftItems?:{draft:PricingDraft;excerpt:string}[];contextTypes?:string[]}){
 const {profile,admin}=await scopedContext();
 const items=args.draftItems
  ? args.draftItems.slice(0,100).filter(item=>item.draft.name?.trim())
  : (args.items??[]).slice(0,100).filter(item=>item.name&&item.name.trim());
 if(!items.length)throw Error('No pricing items could be identified. Please provide a clearer image or document.');
 const {data:session,error}=await admin.from('pricing_setup_sessions').insert({
  company_id:profile.company_id,user_id:profile.id,source_kind:args.kind,source_name:args.name.slice(0,180),
  source_basis:args.basis,extracted_count:items.length,context_types:args.contextTypes??[],
 }).select('id').single();
 if(error||!session)throw Error('Unable to create an import session. Has the pricing setup migration been applied?');
 const rows=items.map((item,i)=>({
  session_id:session.id,company_id:profile.company_id,user_id:profile.id,source_index:i+1,
  source_excerpt:(args.draftItems?(item as {excerpt:string}).excerpt:(item as ExtractedLine).excerpt??(item as ExtractedLine).name).slice(0,1200),
  draft_data:pricingDraftSchema.parse(args.draftItems?(item as {draft:PricingDraft}).draft:draftFromExtraction(item as ExtractedLine,args.basis)),status:'candidate',
 }));
 const {error:insertError}=await admin.from('pricing_setup_drafts').insert(rows);
 if(insertError){await admin.from('pricing_setup_sessions').delete().eq('id',session.id).eq('user_id',profile.id);throw Error('Unable to stage extracted items.');}
 return {sessionId:session.id,count:items.length};
}
export async function listPricingSessions():Promise<PricingSession[]>{
 const {profile,admin}=await scopedContext();
 const {data,error}=await admin.from('pricing_setup_sessions').select('id,source_name,source_kind,source_basis,extracted_count,created_at')
  .eq('user_id',profile.id).eq('company_id',profile.company_id).order('created_at',{ascending:false}).limit(12);
 if(error)throw Error('Unable to load pricing sessions.');
 const sessions=(data??[]) as PricingSession[];
 if(!sessions.length)return sessions;
 const {data:rows,error:rowsError}=await admin.from('pricing_setup_drafts').select('session_id,status')
  .eq('user_id',profile.id).eq('company_id',profile.company_id).in('session_id',sessions.map(s=>s.id));
 if(rowsError)throw Error('Unable to load pricing sessions.');
 const counts=new Map<string,number>();
 for(const row of rows??[])if(row.status!=='saved')counts.set(row.session_id,(counts.get(row.session_id)??0)+1);
 return sessions.map(s=>({...s,remaining:counts.get(s.id)??0}));
}
export async function loadPricingSession(sessionId:string):Promise<{session:PricingSession;drafts:PricingDraftRow[]}>{
 const {profile,admin}=await scopedContext();
 const {data:session,error}=await admin.from('pricing_setup_sessions').select('*').eq('id',sessionId).eq('company_id',profile.company_id).eq('user_id',profile.id).maybeSingle();
 if(error||!session)throw Error('Pricing import not found for this workspace.');
 const {data:drafts,error:rowsError}=await admin.from('pricing_setup_drafts').select('id,source_index,source_excerpt,status,draft_data,confirmed_at,component_id')
  .eq('session_id',sessionId).eq('user_id',profile.id).eq('company_id',profile.company_id).order('source_index',{ascending:true});
 if(rowsError)throw Error('Unable to load imported items.');
 return {session:session as PricingSession,drafts:(drafts??[]).map(row=>({...row,draft_data:pricingDraftSchema.parse(row.draft_data)})) as PricingDraftRow[]};
}
