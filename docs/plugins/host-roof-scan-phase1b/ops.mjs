import { randomUUID } from 'node:crypto';

const protectedHosts = new Set(['quote-core.com','www.quote-core.com','app.quote-core.com','demo.quote-core.com','quote-core.co.nz','www.quote-core.co.nz', 'quotecore-plus.vercel.app', 'quotecore-plus-dev.vercel.app', 'quotecore-plus-main.vercel.app', 'quotecore-git-main-algora-devs-projects.vercel.app']);
export function stagingOrigin(value, allowLocal = false) {
  let u; try { u = new URL(value); } catch { throw new Error('Set an explicit staging origin.'); }
  const local = allowLocal && u.protocol === 'http:' && ['localhost','127.0.0.1'].includes(u.hostname);
  if ((!local && u.protocol !== 'https:') || u.origin !== value || u.username || u.password || protectedHosts.has(u.hostname))
    throw new Error('Use a staging HTTPS origin without a path, trailing slash or production hostname.');
  return u.origin;
}
export function exactOrigins(value, key) {
  const all = [...new Set((value || '').split(',').map(s=>s.trim()).filter(Boolean))];
  for (const value of all) {
    let u; try { u=new URL(value); } catch { throw new Error(key+' must contain exact HTTPS origins.'); }
    if (u.protocol!=='https:'||u.origin!==value||u.hostname.includes('*')||u.username||u.password)
      throw new Error(key+' must contain exact HTTPS origins, not paths or wildcards.');
  }
  return all;
}
export function config(env=process.env) {
  if (env.VERCEL_ENV === 'production') throw new Error('Refusing to configure production.');
  const origin=stagingOrigin(env.QC_HOST_SCAN_ORIGIN, env.NODE_ENV!=='production'&&!env.VERCEL);
  if (!env.QC_HOST_SCAN_SECRET || env.QC_HOST_SCAN_SECRET.length<32 || /REPLACE|GENERATE|YOUR_|SET_SERVER|SECRET_HERE/.test(env.QC_HOST_SCAN_SECRET))
    throw new Error('Generate a separate host-scan secret with at least 32 random bytes.');
  if (env.QC_HOST_SCAN_STORAGE!=='supabase') throw new Error('Staging needs QC_HOST_SCAN_STORAGE=supabase.');
  const db=env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,'');
  if (!/^https:\/\/[a-z0-9.-]+$/.test(db||'')||/YOUR-PROJECT/i.test(db||'')) throw new Error('Configure the actual Supabase project URL.');
  if (!env.SUPABASE_SERVICE_ROLE_KEY || /SET_SERVER|YOUR_|REPLACE/.test(env.SUPABASE_SERVICE_ROLE_KEY)) throw new Error('Configure the existing server-side Supabase service key.');
  const bucket=env.QC_HOST_SCAN_BUCKET;
  if (!/^qc-host-[a-z0-9-]{1,54}$/.test(bucket||'')) throw new Error('Use an isolated bucket whose name begins qc-host-.');
  return {origin,db,bucket,key:env.SUPABASE_SERVICE_ROLE_KEY,fileOrigins:exactOrigins(env.QC_HOST_SCAN_FILE_ORIGINS,'QC_HOST_SCAN_FILE_ORIGINS'),uiOrigins:exactOrigins(env.QC_HOST_SCAN_UI_ORIGINS,'QC_HOST_SCAN_UI_ORIGINS')};
}
export async function checkedFetch(url, init={}) {
  return fetch(url,{...init,redirect:'error',signal:AbortSignal.timeout(25_000)});
}
export function storageClient(c, fetcher=checkedFetch) {
  return async (path, init={}) => fetcher(c.db+'/storage/v1/'+path,{...init,headers:{apikey:c.key,Authorization:'Bearer '+c.key,'Content-Type':'application/json',...init.headers}});
}
export async function ensurePrivateBucket(c, {create=false,fetcher=checkedFetch}={}) {
  const call=storageClient(c,fetcher);
  let response=await call('bucket/'+c.bucket);
  let missing=response.status===404;
  if(response.status===400){
    // Storage API deployments may wrap their 404 in an HTTP 400 error body.
    const e=await response.clone().json().catch(()=>({}));
    missing=e.code==='NoSuchBucket'||e.message==='Bucket not found';
  }
  if (missing && create) {
    // Only create the explicitly named isolated bucket. Never change another bucket or its policies.
    const created=await call('bucket',{method:'POST',body:JSON.stringify({id:c.bucket,name:c.bucket,public:false,file_size_limit:3*1024*1024,allowed_mime_types:['image/png','image/jpeg']})});
    if (!created.ok && created.status!==409) throw new Error('Private bucket creation failed (HTTP '+created.status+').');
    response=await call('bucket/'+c.bucket);
  }
  if (!response.ok) throw new Error('Private bucket is unavailable (HTTP '+response.status+'). Run setup with --create-bucket only after reviewing its name.');
  const b=await response.json();
  if (b.public!==false) throw new Error('Refusing a public bucket. No existing settings were changed.');
  if (b.file_size_limit!==null && b.file_size_limit!==undefined && Number(b.file_size_limit)<2*1024*1024)
    throw new Error('Bucket file limit is below the 2 MiB prepared-image maximum.');
  if (b.allowed_mime_types && !['image/png','image/jpeg'].every(t=>b.allowed_mime_types.includes(t)||b.allowed_mime_types.includes('image/*')))
    throw new Error('Bucket MIME allowlist must accept prepared PNG and JPEG images.');
  return b;
}
export async function probeRateLimit(c, fetcher=checkedFetch) {
  const key='qc-host-outline-v1:setup:'+randomUUID();
  const invoke=()=>fetcher(c.db+'/rest/v1/rpc/consume_rate_limit',{method:'POST',headers:{apikey:c.key,Authorization:'Bearer '+c.key,'Content-Type':'application/json'},body:JSON.stringify({p_key:key,p_max:1,p_window_ms:60_000})});
  const a=await invoke(),b=await invoke();
  if (!a.ok||!b.ok||await a.json()!==true||await b.json()!==false)
    throw new Error('Existing consume_rate_limit RPC did not enforce its test limit. Do not enable the experiment.');
}
export async function probeStorage(c, fixture, fetcher=checkedFetch) {
  const call=storageClient(c,fetcher);
  const objectKey='host-outline-v1/'+new Date().toISOString().slice(0,10)+'/'+Date.now()+'-'+randomUUID();
  let wrote=false;
  try {
    const w=await call('object/'+c.bucket+'/'+objectKey,{method:'POST',headers:{'Content-Type':'image/png','x-upsert':'false'},body:fixture});
    if (!w.ok) throw new Error('Storage write probe failed (HTTP '+w.status+').');
    wrote=true;
    const r=await call('object/'+c.bucket+'/'+objectKey);
    if (!r.ok||!Buffer.from(await r.arrayBuffer()).equals(fixture)) throw new Error('Storage read probe failed or bytes differed.');
  } finally {
    if (wrote) {
      const d=await call('object/'+c.bucket,{method:'DELETE',body:JSON.stringify({prefixes:[objectKey]})});
      if (!d.ok) throw new Error('Could not clean up the synthetic storage probe. Run scoped retention cleanup.');
    }
  }
}
