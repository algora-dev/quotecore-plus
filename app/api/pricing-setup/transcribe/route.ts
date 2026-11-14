import { NextRequest,NextResponse } from 'next/server';
import { reservePricingCall } from '@/app/lib/pricing-setup/storage.server';
export const runtime='nodejs';export const maxDuration=30;
export async function POST(request:NextRequest){
 if(process.env.NEXT_PUBLIC_PRICING_SETUP_ENABLED!=='true')return NextResponse.json({error:'Pricing setup is unavailable.'},{status:404});
 try{
  if(Number(request.headers.get('content-length')||0)>4*1024*1024)return NextResponse.json({error:'Recording too large.'},{status:413});
  const form=await request.formData();const audio=form.get('audio');
  if(!(audio instanceof File)||audio.size===0||audio.size>3.5*1024*1024)return NextResponse.json({error:'Record a shorter voice note.'},{status:400});
  if(!/^(audio\/(webm|ogg|mp4|mpeg|wav|x-m4a|m4a)|video\/webm)$/.test(audio.type))return NextResponse.json({error:'Unsupported audio format.'},{status:400});
  const key=process.env.OPENAI_API_KEY;
  if(!key)return NextResponse.json({error:'Voice transcription is not configured.'},{status:503});
  await reservePricingCall('voice');
  const upstream=new FormData();upstream.append('file',audio, audio.name || (audio.type==='audio/mp4' ? 'pricing-voice.m4a' : 'pricing-voice.webm'));upstream.append('model','gpt-4o-mini-transcribe');
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),25000);let response:Response;
  try{response=await fetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${key}`},body:upstream,signal:controller.signal});}
  finally{clearTimeout(timer);}
  if(!response.ok)throw Error('Voice transcription failed. You can type your pricing instead.');
  const json=await response.json() as {text?:string};
  return NextResponse.json({text:(json.text??'').slice(0,20000)},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Transcription failed.'},{status:400});}
}
