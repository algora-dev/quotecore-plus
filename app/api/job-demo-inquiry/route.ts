import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/app/lib/email/send';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';

export const runtime = 'nodejs';
const MAX_TOTAL = 10 * 1024 * 1024;
const MAX_FILES = 8;
const EXTENSIONS = new Set(['pdf','xlsx','csv','txt','png','jpg','jpeg','webp']);
const FLOWS = new Set(['','measured','provided']);
const DURATIONS = new Set(['','About 10 minutes','10 to 20 minutes','20 to 30 minutes','30 to 40 minutes','40 minutes to 1 hour','Over 1 hour']);
function clean(value:FormDataEntryValue|null,max:number) { return typeof value==='string'?value.trim().slice(0,max).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,' '):''; }
function escapeHtml(v:string) { return v.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]||c)); }
function validBytes(ext:string,b:Buffer) {
  if (ext==='pdf') return b.subarray(0,5).toString()==='%PDF-';
  if (ext==='xlsx') return b.subarray(0,2).toString()==='PK';
  if (ext==='png') return b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (ext==='jpg'||ext==='jpeg') return b[0]===255&&b[1]===216;
  if (ext==='webp') return b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP';
  return (ext==='csv'||ext==='txt')&&!b.includes(0);
}
export async function POST(req:NextRequest) {
  if (!await checkRateLimit(`public-job-demo:${getClientIP(req.headers)}`,4,60*60*1000)) return NextResponse.json({error:'Too many submissions. Please try again later.'},{status:429});
  const size=Number(req.headers.get('content-length')||0);
  if (size>MAX_TOTAL+512000) return NextResponse.json({error:'Files are too large. Use up to 8 files, 10 MB total.'},{status:413});
  let data:FormData;
  try { data=await req.formData(); } catch { return NextResponse.json({error:'Could not read the form.'},{status:400}); }
  const name=clean(data.get('name'),160), email=clean(data.get('email'),320).toLowerCase();
  const flow=clean(data.get('measurementFlow'),20),method=clean(data.get('method'),120);
  const measurements=clean(data.get('measurements'),4000), address=clean(data.get('address'),350);
  const pricingProcess=clean(data.get('pricingProcess'),4000),duration=clean(data.get('duration'),45);
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || data.get('consent')!=='yes') return NextResponse.json({error:'Enter your name and a valid email and confirm permission to share this job.'},{status:400});
  if (!FLOWS.has(flow)||!DURATIONS.has(duration)) return NextResponse.json({error:'Invalid measurement or timing choice.'},{status:400});
  const files=data.getAll('files').filter((part):part is File=>part instanceof File);
  if (files.length>MAX_FILES||files.reduce((sum,f)=>sum+f.size,0)>MAX_TOTAL) return NextResponse.json({error:'Choose up to 8 files, 10 MB total.'},{status:413});
  if (!files.length&&!measurements&&!pricingProcess) return NextResponse.json({error:'Attach a job document or describe the job in a few words.'},{status:400});
  const attachments:{filename:string;content:Buffer}[]=[];
  for (const file of files) {
    const ext=file.name.split('.').pop()?.toLowerCase()||'';
    if (!EXTENSIONS.has(ext)||file.size<=0||file.size>MAX_TOTAL) return NextResponse.json({error:'Unsupported or oversized file.'},{status:400});
    const bytes=Buffer.from(await file.arrayBuffer());
    if (!validBytes(ext,bytes)) return NextResponse.json({error:'One of the files is not a supported PDF, image, spreadsheet or text document.'},{status:400});
    attachments.push({filename:file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120)||`job.${ext}`,content:bytes});
  }
  const rows:[string,string][]=[['Name',name],['Email',email],['How measurements were obtained',flow||'Not specified'],['Measurement method or source',method||'Not provided'],['Job measurements',measurements||'Attached or not provided'],['Job address',address||'Not provided'],['How they quoted',pricingProcess||'Not provided'],['Approximate time',duration||'Not provided'],['Attachments',attachments.map(x=>x.filename).join(', ')||'None']];
  const html=`<div style="font-family:Arial,sans-serif;max-width:720px;color:#172638"><h2>Personalized job demo submission</h2><p>Free limited-time demonstration request. No payment or meeting booked.</p><table style="border-collapse:collapse">${rows.map(([label,value])=>`<tr><th style="text-align:left;vertical-align:top;padding:9px;border-bottom:1px solid #ddd">${escapeHtml(label)}</th><td style="padding:9px;white-space:pre-wrap;border-bottom:1px solid #ddd">${escapeHtml(value)}</td></tr>`).join('')}</table><p>Review the quote and documents. Email the sender if information is missing, otherwise send a link to the personalized recording.</p></div>`;
  const sent=await sendEmail({to:'info@quote-core.com',subject:`Job demo request: ${name.replace(/[\r\n]/g,' ')}`,replyTo:email,html,text:`New personalized job demo request\n\n${rows.map(([label,value])=>`${label}: ${value}`).join('\n\n')}`,attachments,tags:[{name:'type',value:'job-demo-inquiry'}]});
  if (!sent.ok) return NextResponse.json({error:'We could not send your job details. Please try again later or contact our team.'},{status:503});
  return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
