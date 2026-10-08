/** Uses the existing atomic Postgres rate-limit RPC and existing bucket keys.
 * Unlike the shared boolean helper, distinguishes an outage from exhaustion.
 * No counter/table/schema changes. Never automatically retry a consumption. */
import { createClient } from '@supabase/supabase-js';
export async function consumeFreeToolsQuota(key:string,max:number,windowMs:number):Promise<'allowed'|'limited'|'unavailable'> {
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL,keySecret=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!keySecret)return 'unavailable';
  try {
    const admin=createClient(url,keySecret,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data,error}=await admin.rpc('consume_rate_limit',{p_key:key,p_max:max,p_window_ms:windowMs});
    if(error || typeof data!=='boolean')return 'unavailable';
    return data?'allowed':'limited';
  } catch {return 'unavailable';}
}
