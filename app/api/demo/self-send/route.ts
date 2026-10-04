import type { NextRequest } from 'next/server';
import { assertSameOrigin,requireDemoRequest,readSmallJson,demoJson,demoErrorResponse } from '@/app/lib/demo/http';
import { isRecord } from '@/app/lib/demo/model';
import { DemoError } from '@/app/lib/demo/errors';
import { requestDemoEmailVerification,confirmDemoEmail } from '@/app/lib/demo/self-send.server';
export const runtime='nodejs';
export async function POST(request:NextRequest){try{assertSameOrigin(request);const {context}=await requireDemoRequest(request);const body=await readSmallJson(request);
 if(!isRecord(body))throw new DemoError('Choose a self-send action.');
 if(body.action==='request'&&Object.keys(body).sort().join(',')==='action,email')return demoJson(await requestDemoEmailVerification(context,body.email));
 if(body.action==='confirm'&&Object.keys(body).sort().join(',')==='action,challenge,code'&&typeof body.challenge==='string'&&typeof body.code==='string')return demoJson(await confirmDemoEmail(context,body.challenge,body.code));
 throw new DemoError('Invalid self-send request.');}catch(error){return demoErrorResponse(error);}}
