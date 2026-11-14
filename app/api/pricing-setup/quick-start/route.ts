import {NextRequest,NextResponse} from 'next/server';
import { randomUUID } from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {createAdminClient} from '@/app/lib/supabase/admin';
import {requireCompanyContext,requireUser} from '@/app/lib/supabase/server';
import {requireStripe} from '@/app/lib/billing/stripe';
import {assertDemoExternalAllowed} from '@/app/lib/demo/egress';
export const runtime='nodejs';export const maxDuration=40;
const MAX_FILE=4*1024*1024;
function supported(file:File,bytes:Buffer){
 const ext=file.name.split('.').pop()?.toLowerCase();
 if(ext==='pdf')return bytes.subarray(0,5).toString()==='%PDF-';
 if(ext==='xlsx')return bytes.subarray(0,2).toString()==='PK';
 if(ext==='csv'||ext==='txt')return bytes.indexOf(0)===-1;
 if(ext==='png')return bytes.subarray(0,4).equals(Buffer.from([0x89,0x50,0x4e,0x47]));
 if(ext==='jpg'||ext==='jpeg')return bytes[0]===0xff&&bytes[1]===0xd8;
 if(ext==='webp')return bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';
 return false;
}
function mimeFor(file:File){const ext=file.name.split('.').pop()?.toLowerCase();return ({pdf:'application/pdf',xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',csv:'text/csv',txt:'text/plain',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp'} as Record<string,string>)[ext||'']||'';}
export async function POST(request:NextRequest){
 if(process.env.NEXT_PUBLIC_PRICING_SETUP_ENABLED!=='true')return NextResponse.json({error:'Pricing setup is unavailable.'},{status:404});
 try{
  if(Number(request.headers.get('content-length')||0)>4.3*1024*1024)return NextResponse.json({error:'Files are too large.'},{status:413});
  const authUser=await requireUser();
  if(authUser.is_anonymous)return NextResponse.json({error:'Create a free workspace before purchasing Quick Start.'},{status:403});
  const profile=await requireCompanyContext();await assertDemoExternalAllowed(profile.company_id);
  if(!profile.email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email))throw Error('A valid account email is needed for the setup service.');
  const data=await request.formData();const notes=String(data.get('notes')||'').trim().slice(0,3000);
  const files=data.getAll('files').filter((value):value is File=>value instanceof File);
  if(!notes&&!files.length)return NextResponse.json({error:'Please send at least some pricing details or a file.'},{status:400});
  if(files.length>3||files.reduce((sum,f)=>sum+f.size,0)>4*1024*1024||files.some(f=>f.size<1||f.size>MAX_FILE))
   return NextResponse.json({error:'Upload up to three files, 4 MB total.'},{status:413});
  const checked:{file:File;bytes:Buffer;type:string}[]=[];
  for(const file of files){const bytes=Buffer.from(await file.arrayBuffer());const type=mimeFor(file);
   if(!type||!supported(file,bytes))return NextResponse.json({error:`Unsupported file: ${file.name}`},{status:400});
   checked.push({file,bytes,type});
  }
  const db=createAdminClient() as unknown as SupabaseClient;
  const {data:order,error}=await db.from('pricing_quick_start_orders').insert({
   company_id:profile.company_id,user_id:profile.id,contact_email:profile.email,notes,status:'pending_payment',
  }).select('id').single();
  if(error||!order)throw Error('Unable to create your Quick Start request. Check the database migration.');
  const paths:string[]=[];
  for(const upload of checked){
   const ext=upload.file.name.split('.').pop()?.toLowerCase()||'bin';const path=`${profile.company_id}/${order.id}/${randomUUID()}.${ext}`;
   const {error:uploadError}=await db.storage.from('pricing-quick-start').upload(path,upload.bytes,{contentType:upload.type,upsert:false});
   if(uploadError)throw Error('Unable to securely upload your pricing document. No payment was taken.');
   paths.push(path);
  }
  const {error:pathError}=await db.from('pricing_quick_start_orders').update({file_paths:paths}).eq('id',order.id).eq('company_id',profile.company_id);
  if(pathError)throw Error('Unable to record your uploaded files. No payment was taken.');
  const stripe=requireStripe();const origin=process.env.PRICING_SETUP_APP_BASE_URL||process.env.NEXT_PUBLIC_APP_URL;
  if(!origin)throw Error('Checkout URL is not configured. Set PRICING_SETUP_APP_BASE_URL.');
  const url=new URL(origin);
  if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw Error('Invalid checkout return URL.');
  const {data:company,error:companyError}=await db.from('companies').select('slug').eq('id',profile.company_id).single();
  if(companyError||!company?.slug)throw Error('Unable to identify workspace for checkout return.');
  const returnUrl=`${url.origin}/${encodeURIComponent(company.slug)}/pricing/quick-start`;
  const session=await stripe.checkout.sessions.create({mode:'payment',
   line_items:[{price_data:{currency:'usd',unit_amount:9900,product_data:{name:'QuoteCore+ Quick Start Pricing Setup',description:'Preparation of up to 15 Smart Components from your supplied pricing.'}},quantity:1}],
   customer_email:profile.email,client_reference_id:profile.company_id,
   metadata:{pricing_setup_product:'quick_start',company_id:profile.company_id,order_id:order.id},
   success_url:`${returnUrl}?checkout=success`,
   cancel_url:`${returnUrl}?checkout=cancelled`,
  },{idempotencyKey:`pricing-quick-start-${order.id}`});
  if(!session.url)throw Error('Checkout could not be created. No payment was taken.');
  const {error:sessionError}=await db.from('pricing_quick_start_orders').update({stripe_session_id:session.id}).eq('id',order.id);
  if(sessionError)throw Error('Could not record checkout. Contact support before making another payment.');
  return NextResponse.json({ok:true,url:session.url},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  console.error('[pricing-setup] Quick Start checkout initiation failed',error instanceof Error?error.message:'unknown');
  return NextResponse.json({error:error instanceof Error?error.message:'Unable to start checkout.'},{status:400});
 }
}
