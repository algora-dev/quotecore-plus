import { NextRequest, NextResponse } from 'next/server';
import { resolveFreeToolsTier } from '@/app/lib/free-tools/resolveTier';
import { getClientIP } from '@/app/lib/security/rateLimit';
import { docRateLimitKey, RATE_LIMIT_WINDOW_MS } from '@/app/lib/free-tools/tiers';
import { consumeFreeToolsQuota } from '@/app/lib/free-tools/consumeQuota';
export const runtime='nodejs';
const headers={'Cache-Control':'private, no-store'};
/** Consumes one generation. GET/account-status is the non-consuming lookup.
 * Quotes, invoices and POs share a bucket. Reprinting is a client output action,
 * not another call here. A lost response can still consume a credit: no auto retry. */
export async function POST(req:NextRequest) {
  let body:unknown;
  try {body=await req.json();}catch{return NextResponse.json({error:'Invalid JSON body'},{status:400,headers});}
  const tool=(body as {tool?:unknown}|null)?.tool;
  if (!['quote','invoice','order'].includes(String(tool)))return NextResponse.json({error:'Choose a supported document type.'},{status:400,headers});
  const resolved=await resolveFreeToolsTier(req.headers.get('authorization'));
  const max=resolved.limits.docPerDay;
  if(max===null)return NextResponse.json({allowed:true,remaining:null,tier:resolved.tier,limit:null,canRemoveBranding:resolved.canRemoveBranding},{headers});
  const subject=resolved.userId?{userId:resolved.userId}:{ip:getClientIP(req.headers)};
  const result=await consumeFreeToolsQuota(docRateLimitKey(subject),max,RATE_LIMIT_WINDOW_MS);
  if(result==='unavailable')return NextResponse.json({allowed:false,error:'We could not check your allowance. Your quote is still here. Please try again shortly.'},{status:503,headers});
  if(result==='limited')return NextResponse.json({allowed:false,remaining:0,remainingIsExact:true,tier:resolved.tier,limit:max,
    message:resolved.tier===1?`Your ${max} guest documents for this 24-hour allowance have been used. A free account gives you 10 documents and 3 AI drafts per day, without QuoteCore+ branding.`:`Your ${max} free documents for this 24-hour allowance have been used. You can keep editing, or explore the paid QuoteCore+ app.`},
    {status:429,headers});
  // Preserve the legacy response shape for the other generators; do NOT display
  // this upper bound as a remaining count. The quote V2 client reads daily caps.
  return NextResponse.json({allowed:true,remaining:max,remainingIsExact:false,tier:resolved.tier,limit:max,canRemoveBranding:resolved.canRemoveBranding},{headers});
}
