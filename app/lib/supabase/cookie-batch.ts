import type { CookieOptions } from '@supabase/ssr';
export type CookieChange = {name:string;value:string;options:CookieOptions};
type ResponseWithCookies = {cookies:{set:(cookie:CookieOptions & {name:string;value:string})=>unknown};headers:{set:(name:string,value:string)=>unknown}};
/** Keep every chunk/removal from every SDK batch, including when a redirect or
 * demo request rewrite constructs a different NextResponse later in the request. */
export function createAuthCookieBatch(){
 const pending=new Map<string,CookieChange>(),headers=new Map<string,string>();
 return {
  record(changes:CookieChange[],sdkHeaders?:Record<string,string>){
   for(const cookie of changes)pending.set(`${cookie.name}|${cookie.options.domain??''}|${cookie.options.path??'/'}`,cookie);
   for(const name of ['cache-control','expires','pragma']){
    const value=Object.entries(sdkHeaders??{}).find(([key])=>key.toLowerCase()===name)?.[1];if(value)headers.set(name,value);
   }
   if(changes.length){headers.set('cache-control','private, no-store, max-age=0');headers.set('pragma','no-cache');headers.set('expires','0');}
  },
  apply<T extends ResponseWithCookies>(response:T):T{
   for(const {name,value,options} of pending.values())response.cookies.set({name,value,...options});
   for(const [name,value] of headers)response.headers.set(name,value);
   return response;
  },
 };
}
export function temporaryAuthFailure(error:{name?:string;status?:number}|null|undefined):boolean{
 return !!error&&(error.name==='AuthRetryableFetchError'||error.status===0||typeof error.status==='number'&&error.status>=500);
}
