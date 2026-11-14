import { NextRequest,NextResponse } from 'next/server';
import { reservePricingCall,insertPricingSession } from '@/app/lib/pricing-setup/storage.server';
import { csvToRows,xlsxToRows } from '@/app/lib/pricing-setup/parse-spreadsheet';
import { extractDocumentLines } from '@/app/lib/pricing-setup/extract.server';
import type {ExtractedLine} from '@/app/lib/pricing-setup/domain';
export const runtime='nodejs';export const maxDuration=60;
const MAX_BYTES=4*1024*1024;
function typeOfFile(name:string,bytes:Buffer):'csv'|'xlsx'|'pdf'|'image'|'text'|null{
 const ext=name.split('.').pop()?.toLowerCase();
 if(ext==='pdf'&&bytes.subarray(0,5).toString()==='%PDF-')return 'pdf';
 if(['png','jpg','jpeg','webp'].includes(ext??'')){
  if(bytes.subarray(0,4).equals(Buffer.from([0x89,0x50,0x4e,0x47]))&&ext==='png')return 'image';
  if(bytes[0]===0xff&&bytes[1]===0xd8&&['jpg','jpeg'].includes(ext??''))return 'image';
  if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'&&ext==='webp')return 'image';
 }
 if(ext==='xlsx'&&bytes[0]===0x50&&bytes[1]===0x4b)return 'xlsx';
 if(ext==='csv'&&bytes.indexOf(0)===-1)return 'csv';
 if(ext==='txt'&&bytes.indexOf(0)===-1)return 'text';
 return null;
}
export async function POST(request:NextRequest){
 if(process.env.NEXT_PUBLIC_PRICING_SETUP_ENABLED!=='true')return NextResponse.json({error:'Pricing setup is unavailable.'},{status:404});
 try{
  const length=Number(request.headers.get('content-length')||0);
  if(length>MAX_BYTES+60000)return NextResponse.json({error:'Maximum upload size is 4 MB.'},{status:413});
  const form=await request.formData();
  const file=form.get('file');const text=String(form.get('text')||'').trim();
  const basis=String(form.get('basis')||'unknown');
  if(!['purchase','selling','mixed','unknown'].includes(basis))return NextResponse.json({error:'Invalid price context.'},{status:400});
  const rawContext=String(form.get('context_types')||'[]');
  let contextTypes:string[]=[];
  try { const parsed:unknown=JSON.parse(rawContext);if(!Array.isArray(parsed))throw Error('Invalid selection.');contextTypes=parsed; }
  catch { return NextResponse.json({error:'Invalid pricing-context selection.'},{status:400}); }
  if(contextTypes.length>4||contextTypes.some(kind=>typeof kind!=='string'||!['purchase','selling','labour','mixed'].includes(kind))||
    new Set(contextTypes).size!==contextTypes.length||(contextTypes.includes('mixed')&&contextTypes.length>1))
    return NextResponse.json({error:'Select valid price types, or leave the optional choices blank.'},{status:400});
  const effectiveBasis=contextTypes.length===0?basis:
    contextTypes.length===1&&['purchase','selling'].includes(contextTypes[0])?contextTypes[0]:'mixed';
  if(file instanceof File&&text)return NextResponse.json({error:'Submit a file or text, not both.'},{status:400});
  if(!(file instanceof File)&&(!text||text.length>20000))return NextResponse.json({error:'Enter a description of your pricing (up to 20,000 characters).'},{status:400});
  let items:ExtractedLine[];let kind:string;let sourceName:string;
  // Reserve authenticated daily quota before performing any provider call or ingestion.
  await reservePricingCall('extract');
  if(file instanceof File){
   if(file.size<1||file.size>MAX_BYTES)return NextResponse.json({error:'File must be between 1 byte and 4 MB.'},{status:413});
   const bytes=Buffer.from(await file.arrayBuffer());
   const fileKind=typeOfFile(file.name,bytes);
   if(!fileKind)return NextResponse.json({error:'Use CSV, XLSX, TXT, PDF, PNG, JPEG or WebP files.'},{status:400});
   kind=fileKind;sourceName=file.name;
   if(fileKind==='csv')items=csvToRows(bytes.toString('utf8'));
   else if(fileKind==='xlsx')items=await xlsxToRows(bytes);
   else if(fileKind==='text')items=await extractDocumentLines({kind:'text',name:file.name,text:bytes.toString('utf8'),sourceBasis:effectiveBasis,contextTypes});
   else items=await extractDocumentLines({kind:fileKind==='pdf'?'pdf':'image',name:file.name,mime:file.name.toLowerCase().endsWith('.png')?'image/png':file.name.toLowerCase().endsWith('.webp')?'image/webp':'image/jpeg',bytes,sourceBasis:effectiveBasis,contextTypes});
  }else{
   kind=form.get('voice')==='true'?'voice':'text';sourceName=kind==='voice'?'Spoken pricing':'Typed pricing';
   items=await extractDocumentLines({kind:'text',name:sourceName,text,sourceBasis:effectiveBasis,contextTypes});
  }
  const result=await insertPricingSession({name:sourceName,kind,basis:effectiveBasis as 'unknown'|'purchase'|'selling'|'mixed',items,contextTypes});
  return NextResponse.json({ok:true,...result},{headers:{'Cache-Control':'no-store'}});
 }catch(error){
  const message=error instanceof Error?error.message:'Import failed.';
  const status=/limit|quota/.test(message.toLowerCase())?429:/not configured|migration/.test(message.toLowerCase())?503:400;
  return NextResponse.json({error:message},{status,headers:{'Cache-Control':'no-store'}});
 }
}
