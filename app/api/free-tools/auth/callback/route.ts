import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { authCookieOptions } from '@/app/lib/supabase/cookie-config';
export const runtime='nodejs';
/** Dedicated free-document return. Destination is fixed: no open redirect and no
 * customer content/tokens copied into the quote URL. Works with PKCE code or a
 * configured email token-hash template. Do not replace the app's auth routes. */
export async function GET(req:NextRequest) {
  const input=req.nextUrl, destination=new URL('/free-quote-generator',input.origin);
  const id=input.searchParams.get('resume');
  if(id&&/^[a-f0-9-]{32,64}$/.test(id))destination.searchParams.set('qc_resume',id);
  const response=NextResponse.redirect(destination);
  response.headers.set('Cache-Control','private, no-store');
  response.headers.set('Referrer-Policy','no-referrer');
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const fail=()=>{destination.searchParams.set('qc_auth_error','verification');const failed=NextResponse.redirect(destination);failed.headers.set('Cache-Control','private, no-store');failed.headers.set('Referrer-Policy','no-referrer');return failed;};
  if(!url||!key)return fail();
  const client=createServerClient(url,key,{cookieOptions:authCookieOptions(input.hostname),cookies:{
    getAll(){return req.cookies.getAll();},
    setAll(cookies){cookies.forEach(({name,value,options})=>response.cookies.set(name,value,options));},
  }});
  try {
    const code=input.searchParams.get('code'),hash=input.searchParams.get('token_hash');
    const result=code?await client.auth.exchangeCodeForSession(code):hash&&input.searchParams.get('type')==='email'?await client.auth.verifyOtp({type:'email',token_hash:hash}):null;
    if(!result||result.error)return fail();
    return response;
  } catch {return fail();}
}
