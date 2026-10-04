import type { NextRequest } from 'next/server';
import { assertSameOrigin,requireDemoRequest,demoJson,demoErrorResponse } from '@/app/lib/demo/http';
import { demoCustomerToken } from '@/app/lib/demo/customer.server';
import { recordDemoEventBestEffort } from '@/app/lib/demo/progress';
export const runtime='nodejs';
export async function POST(request:NextRequest){try{assertSameOrigin(request);const {context}=await requireDemoRequest(request);
 const token=await demoCustomerToken(context);await recordDemoEventBestEffort(context.companyId,'quote.previewed',context.tutorialState.seed.guided_roof_job);
 return demoJson({href:`/demo/quote/${token}`});}catch(error){return demoErrorResponse(error);}}
