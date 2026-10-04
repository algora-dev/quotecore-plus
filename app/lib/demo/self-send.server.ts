import 'server-only';
import { randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { getResendClient } from '@/app/lib/email/client';
import { checkRateLimit } from '@/app/lib/security/rateLimit';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { consumeDemoResource, demoBudgetConfig } from './budget';
import { demoCustomerToken, demoTokenKey } from './customer.server';
import { signDemoToken, verifyDemoToken } from './tokens';
import { demoHmac } from './identity';
import { DemoError } from './errors';
import { recordDemoEventBestEffort } from './progress';
import type { ActiveDemoContext } from './model';
function enabled(context:ActiveDemoContext):string{
 if(process.env.DEMO_SELF_SEND_ENABLED!=='true')throw new DemoError('Self-send is switched off. You can still open the customer preview.',503,'demo_send_off');
 if(context.tutorialState.chapter!=='customer-quote'||!context.tutorialState.acknowledgements['takeoff.saved'])throw new DemoError('Self-send belongs to the customer-quote guide chapter.',403);
 const configured=process.env.DEMO_PUBLIC_ORIGIN;let origin:URL;
 try{origin=new URL(configured??'');}catch{throw new DemoError('The public demo origin has not been configured.',503);}
 if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw new DemoError('A secure public demo origin is required.',503);
 return origin.origin;
}
function emailAddress(value:unknown):string{
 if(typeof value!=='string')throw new DemoError('Enter your email address.');const email=value.trim().toLowerCase();
 if(email.length>254||! /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(email))throw new DemoError('Enter a valid email address.');return email;
}
async function deliver(to:string,subject:string,html:string,text:string,idempotencyKey:string):Promise<void>{
 const client=getResendClient();if(!client)throw new DemoError('Email delivery is not configured on this deployment.',503);
 if(!await checkRateLimit('demo:mail:global',60,3_600_000,{failClosed:true}))throw new DemoError('Demo delivery is temporarily at capacity.',429);
 // Deliberate, narrow exception to normal demo egress suppression. All caller
 // content is constructed here; never accept user HTML, subject, sender or link.
 const result=await client.emails.send({from:'QuoteCore+ Demo <info@quote-core.com>',to,subject,html,text,replyTo:'info@quote-core.com',tags:[{name:'purpose',value:'requested-demo-only'}]},{idempotencyKey});
 if(result.error||!result.data?.id)throw new DemoError('The delivery provider did not confirm acceptance. This allowance remains reserved; no background retry was scheduled.',502,'demo_delivery_unconfirmed');
}
export async function requestDemoEmailVerification(context:ActiveDemoContext,value:unknown){
 enabled(context);await demoCustomerToken(context);const email=emailAddress(value);const id=randomUUID();
 if(!await checkRateLimit(`demo:mail:recipient:${demoHmac(email)}`,3,86_400_000,{failClosed:true}))throw new DemoError('Please wait before requesting another verification for this address.',429);
 await consumeDemoResource(context,'email-verifications',1,3);
 const code=String(randomInt(0,1_000_000)).padStart(6,'0');const expires=Math.min(Date.now()+10*60_000,Date.parse(context.expiresAt));
 const hash=demoHmac(`verify:${id}:${email}:${code}`);
 const db=createAdminClient();const stored=await db.from('demo_usage').insert({id,demo_session_id:context.sessionId,ip_hmac:context.ipHmac,action_type:'email-verification',action_variant:hash,reservation_credits:0,status:'reserved'});
 if(stored.error)throw new DemoError('Could not initialize email verification.',503);
 await deliver(email,'QuoteCore+ Demo — verify your requested self-send',`<h1>QuoteCore+ Demo</h1><p>You requested a fictional demo quote. Enter this code in the demo to confirm this is your email:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px">${code}</p><p>It expires in 10 minutes. If you did not request this, ignore it. No marketing subscription has been created.</p>`,`QuoteCore+ Demo. Your requested self-send verification code is ${code}. It expires in 10 minutes. Ignore this message if you did not request it. This is not marketing consent.`,`qcp-demo-verify-${id}`);
 // Address is returned only inside this authenticated visitor's signed challenge;
 // the DB retains a keyed digest, not the raw address or verification code.
 return {challenge:signDemoToken({v:1,purpose:'verify-email',id,sessionId:context.sessionId,email,expires},demoTokenKey()),expires};
}
export async function confirmDemoEmail(context:ActiveDemoContext,challenge:string,code:string){
 const origin=enabled(context);const claim=verifyDemoToken(challenge,demoTokenKey());
 if(!claim||claim.purpose!=='verify-email'||claim.sessionId!==context.sessionId||typeof claim.id!=='string'||typeof claim.email!=='string'||!/^\d{6}$/.test(code))throw new DemoError('The verification expired or is invalid. Request a fresh code.',400);
 if(!await checkRateLimit(`demo:verify-attempt:${claim.id}`,5,600_000,{failClosed:true}))throw new DemoError('Too many code attempts. Request a fresh verification.',429);
 const db=createAdminClient();const usage=await db.from('demo_usage').select('action_variant,status').eq('id',claim.id).eq('demo_session_id',context.sessionId).eq('action_type','email-verification').maybeSingle();
 if(usage.error||!usage.data||usage.data.status!=='reserved')throw new DemoError('This verification has already been used or is unavailable.',409);
 const expected=Buffer.from(usage.data.action_variant??'');const actual=Buffer.from(demoHmac(`verify:${claim.id}:${claim.email}:${code}`));
 if(expected.length!==actual.length||!timingSafeEqual(expected,actual))throw new DemoError('That code did not match. Please check the email.');
 const claimed=await db.from('demo_usage').update({status:'settled',settled_at:new Date().toISOString()}).eq('id',claim.id).eq('status','reserved').select('id').maybeSingle();
 if(claimed.error||!claimed.data)throw new DemoError('This verification was already used in another request.',409);
 await consumeDemoResource(context,'quote-sends',1,demoBudgetConfig().sends);
 const token=await demoCustomerToken(context);const href=`${origin}/demo/quote/${token}`;
 await deliver(claim.email,'QuoteCore+ Demo — NOT A REAL QUOTE',`<h1>DEMO — NOT A REAL QUOTE</h1><p>You requested this fictional QuoteCore+ demonstration. No contract, order or payment is involved.</p><p><a href="${href}">Open your demo customer quote</a></p><p>The link expires when this demo ends or is reset. The customer response buttons affect only your fictional sandbox.</p><p>This requested delivery is not a marketing subscription.</p>`,`DEMO — NOT A REAL QUOTE. You requested this fictional QuoteCore+ demonstration. No contract or payment is involved. Open: ${href}\nThe link expires with the demo. No marketing subscription was created.`,`qcp-demo-quote-${claim.id}`);
 await recordDemoEventBestEffort(context.companyId,'email.sent',context.tutorialState.seed.guided_roof_job);
 return {acceptedByProvider:true};
}
