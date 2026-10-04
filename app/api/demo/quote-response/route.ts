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
 return demoJson({status:update.data.status});
 }catch(error){return demoErrorResponse(error);}}
