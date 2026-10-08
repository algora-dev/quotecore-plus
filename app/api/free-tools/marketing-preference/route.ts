import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resolveFreeToolsTier } from '@/app/lib/free-tools/resolveTier';
import { checkRateLimit } from '@/app/lib/security/rateLimit';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store'};
/** Explicit opt-in preference only; does not subscribe anyone to a campaign.
 * Stored in a namespaced Auth app_metadata field, not an entitlement field.
 * The future email integration must honour withdrawals and suppression lists. */
export async function POST(req:NextRequest){
  const caller=await resolveFreeToolsTier(req.headers.get('authorization'));
  if(!caller.userId||!caller.canRemoveBranding)return NextResponse.json({error:'Confirm your email before saving this preference.'},{status:401,headers});
  let body:unknown;try{body=await req.json();}catch{return NextResponse.json({error:'Invalid request.'},{status:400,headers});}
  const subscribed=(body as {subscribed?:unknown}|null)?.subscribed;
  if(typeof subscribed!=='boolean')return NextResponse.json({error:'Choose an email preference.'},{status:400,headers});
  if(!await checkRateLimit(`free-tools-preference:${caller.userId}`,10,60*60*1000,{failClosed:true}))return NextResponse.json({error:'Please try again later.'},{status:429,headers});
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return NextResponse.json({error:'Preferences are temporarily unavailable.'},{status:503,headers});
  try{
    const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
    const {error}=await admin.auth.admin.updateUserById(caller.userId,{app_metadata:{free_tools_marketing:{
      subscribed,source:'free-quote-generator',textVersion:'free-tools-email-v2-20261008',recordedAt:new Date().toISOString(),
      text:'Email me QuoteCore+ tips and product updates. Optional; unsubscribe anytime.',
    }}});
    if(error)return NextResponse.json({error:'Your account is ready, but the email preference was not saved.'},{status:503,headers});
    return NextResponse.json({saved:true,subscribed},{headers});
  }catch{return NextResponse.json({error:'Your account is ready, but the email preference was not saved.'},{status:503,headers});}
}
