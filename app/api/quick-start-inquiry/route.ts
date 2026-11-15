import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/app/lib/email/send';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';

export const runtime = 'nodejs';
const MAX_TOTAL = 4 * 1024 * 1024;
const TYPES: Record<string, string> = { pdf:'application/pdf', xlsx:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', csv:'text/csv', txt:'text/plain', png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', webp:'image/webp' };
const COUNTS = new Set(['1 to 5','6 to 15','16 to 30','31 to 60','More than 60','I need help counting']);
const clean = (value: FormDataEntryValue | null, max: number) => typeof value === 'string' ? value.trim().slice(0,max).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ') : '';
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[char] || char);
function validBytes(ext: string, buffer: Buffer) {
  if (ext === 'pdf') return buffer.subarray(0,5).toString() === '%PDF-';
  if (ext === 'xlsx') return buffer.subarray(0,2).toString() === 'PK';
  if (ext === 'png') return buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (ext === 'jpg' || ext === 'jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8;
  if (ext === 'webp') return buffer.subarray(0,4).toString() === 'RIFF' && buffer.subarray(8,12).toString() === 'WEBP';
  if (ext === 'csv' || ext === 'txt') return !buffer.includes(0);
  return false;
}
export async function POST(req: NextRequest) {
  const ip = getClientIP(req.headers);
  if (!await checkRateLimit(`public-quick-start:${ip}`, 4, 60 * 60 * 1000)) return NextResponse.json({error:'Too many enquiries. Please try again later.'}, {status:429});
  if (Number(req.headers.get('content-length') || 0) > MAX_TOTAL + 512000) return NextResponse.json({error:'Files are too large (4 MB total).'}, {status:413});
  let data: FormData;
  try { data = await req.formData(); }
  catch { return NextResponse.json({error:'Unable to read the enquiry.'}, {status:400}); }
  const name = clean(data.get('name'),160);
  const email = clean(data.get('email'),320).toLowerCase();
  const business = clean(data.get('businessName'),180);
  const count = clean(data.get('componentCount'),35);
  const systems = clean(data.get('systems'),1500);
  const details = clean(data.get('details'),3000);
  const workspace = clean(data.get('workspace'),80);
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || !COUNTS.has(count) || data.get('consent') !== 'yes') return NextResponse.json({error:'Enter your name, email and approximate component count, and confirm your sharing permission.'}, {status:400});
  if (workspace && !/^[a-z0-9-]{1,80}$/.test(workspace)) return NextResponse.json({error:'Invalid workspace reference.'}, {status:400});
  const files = data.getAll('files').filter((part): part is File => part instanceof File);
  if (files.length > 5 || files.reduce((sum,f) => sum + f.size,0) > MAX_TOTAL) return NextResponse.json({error:'Choose up to 5 files, 4 MB total.'}, {status:413});
  const attachments: {filename:string;content:Buffer}[] = [];
  for (const file of files) {
    if (file.size <= 0 || file.size > MAX_TOTAL) return NextResponse.json({error:'Empty or oversized file.'}, {status:400});
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const buffer = Buffer.from(await file.arrayBuffer());
    if (!TYPES[ext] || !validBytes(ext, buffer)) return NextResponse.json({error:'Unsupported file. Use PDF, XLSX, CSV, TXT, JPG, PNG or WebP.'}, {status:400});
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,120) || `pricing.${ext}`;
    attachments.push({filename:safeName,content:buffer});
  }
  const rows: [string,string][] = [
    ['Contact',name], ['Email',email], ['Business',business || 'Not provided'],
    ['Approximate Smart Components',count], ['Work and roofing systems',systems || 'Not provided'],
    ['Pricing details',details || 'Not provided'], ['Workspace slug (unverified)',workspace || 'Not provided'],
    ['Attached files',attachments.map(a=>a.filename).join(', ') || 'None'],
  ];
  const html = `<div style="font-family:Arial,sans-serif;max-width:720px;margin:auto;color:#1b2634"><h2>Quick Start pricing setup enquiry</h2><p>This is a <strong>request for review only</strong>. No payment has been requested or collected.</p><table style="border-collapse:collapse;width:100%">${rows.map(([label,value])=>`<tr><th style="text-align:left;vertical-align:top;border-bottom:1px solid #ddd;padding:12px 8px">${escapeHtml(label)}</th><td style="border-bottom:1px solid #ddd;padding:12px 8px;white-space:pre-wrap">${escapeHtml(value)}</td></tr>`).join('')}</table><p>Reply to this email to clarify requirements and agree the final price. Send a secure Stripe payment link only after approval.</p></div>`;
  const sent = await sendEmail({to:'info@quote-core.com',subject:`Quick Start enquiry: ${(business || name).replace(/[\r\n]/g, ' ')}`,replyTo:email,
    text:`Quick Start pricing setup enquiry. NO PAYMENT.\n\n${rows.map(([k,v])=>`${k}: ${v}`).join('\n\n')}`,html,attachments,tags:[{name:'type',value:'quick-start-inquiry'}]});
  if (!sent.ok) return NextResponse.json({error:'We could not send your enquiry. Please try again later or contact our team.'}, {status:503});
  return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
}
