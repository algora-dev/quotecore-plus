import type { NextRequest } from 'next/server';
import { assertSameOrigin,readSmallJson,demoJson,demoErrorResponse } from '@/app/lib/demo/http';
import { readDemoCustomer } from '@/app/lib/demo/customer.server';
import { isRecord } from '@/app/lib/demo/model';
import { DemoError } from '@/app/lib/demo/errors';
import { checkRateLimit } from '@/app/lib/security/rateLimit';
export const runtime='nodejs';
export async function POST(request:NextRequest){try{assertSameOrigin(request);const body=await readSmallJson(request);
 if(!isRecord(body)||typeof body.token!=='string'||!['accepted','declined'].includes(String(body.choice)))throw new DemoError('Choose a demo response.');
 const document=await readDemoCustomer(body.token);
 if(!await checkRateLimit(`demo:respond:${document.claims.sessionId}`,10,60_000,{failClosed:true}))throw new DemoError('Please wait before trying again.',429);
 if(document.quote.status==='accepted'||document.quote.status==='declined')return demoJson({status:document.quote.status});
 // Deliberately does NOT invoke the production accept/decline workflow, emails,
 // supplier orders or follow-ups. The ONLY mutation is this scoped demo row.
 const choice=body.choice as 'accepted'|'declined';
 const update=await document.db.from('quotes').update({status:choice,...(choice==='accepted'?{accepted_at:new Date().toISOString()}:{declined_at:new Date().toISOString()})})
 .eq('id',document.claims.quoteId).eq('company_id',document.companyId).in('status',['draft','confirmed','sent']).select('status').maybeSingle();
 if(update.error)throw new DemoError('The demo response could not be saved.',503);if(!update.data)throw new DemoError('This demo document changed. Refresh before responding.',409);
 const responseAt=new Date().toISOString();
 const outbound=await document.db.from('outbound_messages').select('id').eq('company_id',document.companyId).eq('related_quote_id',document.claims.quoteId).order('created_at',{ascending:false}).limit(1).maybeSingle();
 await document.db.from('outbound_messages').update({status:choice,replied_at:responseAt}).eq('company_id',document.companyId).eq('related_quote_id',document.claims.quoteId).is('replied_at',null);
 if(outbound.data?.id) await document.db.from('outbound_message_replies').insert({company_id:document.companyId,message_id:outbound.data.id,action:choice==='accepted'?'accept':'decline',body:`Fictional demo customer ${choice} the quote.`,created_at:responseAt} as never);
 await document.db.from('alerts').insert({company_id:document.companyId,quote_id:document.claims.quoteId,alert_type:choice==='accepted'?'quote_accepted':'quote_declined',title:choice==='accepted'?'Demo customer accepted your quote':'Demo customer declined your quote',message:`Your fictional demo customer ${choice} the quote. The quote status has updated.`});
 return demoJson({status:update.data.status});
 }catch(error){return demoErrorResponse(error);}}
