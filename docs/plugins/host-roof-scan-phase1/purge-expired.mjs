#!/usr/bin/env node
/** Dedicated private bucket only. DRY RUN unless --execute is explicitly supplied.
 * Does not modify SQL, RLS, app records, other buckets or existing cron configuration.
 * Schedule externally in staging before allowing real user uploads.
 */
const origin=process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/,'');
const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket=process.env.QC_HOST_SCAN_BUCKET;
if(!/^https:\/\/[a-z0-9.-]+$/.test(origin||'')||!key||!/^[a-z0-9][a-z0-9-]{2,62}$/.test(bucket||''))throw new Error('Configure Supabase and the dedicated host-scan bucket.');
const execute=process.argv.includes('--execute');
const cutoff=Date.now()-35*60*1000; // 30-minute capability TTL plus five-minute safety buffer.
async function call(path,init={}){const r=await fetch(origin+'/storage/v1/'+path,{...init,redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json',...init.headers}});if(!r.ok)throw new Error('Storage request failed, status '+r.status);return r.json();}
const b=await call('bucket/'+bucket);if(b.public!==false)throw new Error('Refusing to use a non-private bucket.');
async function list(prefix){const result=[];for(let offset=0;;offset+=100){const page=await call('object/list/'+bucket,{method:'POST',body:JSON.stringify({prefix,limit:100,offset,sortBy:{column:'name',order:'asc'}})});if(!Array.isArray(page))throw new Error('Unexpected listing shape');result.push(...page);if(result.length>10000)throw new Error('Listing too large; review retention manually.');if(page.length<100)break;}return result;}
const folders=await list('host-outline-v1'),deletions=[];
for(const folder of folders){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(folder.name)||folder.id)continue;
 for(const file of await list('host-outline-v1/'+folder.name)){
  const m=/^(\d{13})-([a-f0-9-]{36})$/.exec(file.name);
  if(m&&Number(m[1])<cutoff)deletions.push('host-outline-v1/'+folder.name+'/'+file.name);
 }
}
console.log((execute?'DELETE':'DRY RUN')+': '+deletions.length+' expired host-outline objects. No image names or credentials logged.');
if(execute)for(let i=0;i<deletions.length;i+=100)await call('object/'+bucket,{method:'DELETE',body:JSON.stringify({prefixes:deletions.slice(i,i+100)})});
