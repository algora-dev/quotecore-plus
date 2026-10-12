/** Staging-only reference bucket setup/retention. No application tables or image policies changed.
 * check: read-only; create: explicitly creates only a missing dedicated bucket;
 * purge: dry-run unless --delete. Service credentials remain in environment variables.
 */
import {pathToFileURL} from 'node:url';
import {config,storageClient,checkedFetch} from '../host-roof-scan-phase1b/ops.mjs';
export const PREFIX='host-outline-refs-v1',MAX_BYTES=65536;
export function referenceConfig(env=process.env){
 const c=config(env),bucket=env.QC_HOST_SCAN_REFERENCE_BUCKET;
 if(!/^qc-host-[a-z0-9-]{1,54}$/.test(bucket||'')||bucket===c.bucket)throw new Error('Configure a dedicated qc-host- reference bucket, different from QC_HOST_SCAN_BUCKET.');
 return {...c,imageBucket:c.bucket,bucket};
}
export async function ensureReferenceBucket(c,{create=false,fetcher=checkedFetch}={}){
 const call=storageClient(c,fetcher);let r=await call('bucket/'+c.bucket),missing=r.status===404;
 if(r.status===400){const e=await r.clone().json().catch(()=>({}));missing=e.code==='NoSuchBucket'||e.message==='Bucket not found';}
 if(missing&&create){const w=await call('bucket',{method:'POST',body:JSON.stringify({id:c.bucket,name:c.bucket,public:false,file_size_limit:MAX_BYTES,allowed_mime_types:['application/json']})});if(!w.ok&&w.status!==409)throw new Error('Reference bucket creation failed (HTTP '+w.status+').');r=await call('bucket/'+c.bucket);}
 if(!r.ok)throw new Error('Reference bucket unavailable (HTTP '+r.status+'). Review the target before using create.');
 const b=await r.json();
 if(b.public!==false||Number(b.file_size_limit)!==MAX_BYTES||!Array.isArray(b.allowed_mime_types)||b.allowed_mime_types.length!==1||b.allowed_mime_types[0]!=='application/json')throw new Error('Reference bucket must be private, JSON-only and limited to 65536 bytes. Existing settings were not changed.');
 return {bucket:c.bucket,private:true,fileSizeLimit:MAX_BYTES,mimeType:'application/json'};
}
function dateName(name){return /^\d{4}-\d{2}-\d{2}$/.test(name)&&!Number.isNaN(Date.parse(name+'T00:00:00Z'))&&new Date(name+'T00:00:00Z').toISOString().slice(0,10)===name;}
export function expiredReferenceKey(day,name,cutoff){
 if(!dateName(day))return null;
 const m=/^(\d{1,16})-([a-f0-9]{64})\.json$/.exec(name);if(!m)return null;
 const expiry=Number(m[1]);
 if(!Number.isSafeInteger(expiry)||expiry<=0||expiry>=cutoff||expiry>8.64e15||String(expiry)!==m[1]||new Date(expiry).toISOString().slice(0,10)!==day)return null;
 return `${PREFIX}/${day}/${name}`;
}
export async function purgeReferences(c,{remove=false,now=Date.now(),graceMs=300000,pageSize=100,maxListRequests=1000,maxCandidates=10000,fetcher=checkedFetch}={}){
 // Even dry-runs validate private target settings; never enumerate a different bucket.
 await ensureReferenceBucket(c,{fetcher});
 if(!Number.isFinite(now)||!Number.isInteger(graceMs)||graceMs<300000||!Number.isInteger(pageSize)||pageSize<1||pageSize>1000||!Number.isInteger(maxListRequests)||maxListRequests<1||!Number.isInteger(maxCandidates)||maxCandidates<1)throw new Error('Unsafe retention parameters.');
 const cutoff=now-graceMs,call=storageClient(c,fetcher),keys=new Set();let requests=0,skipped=0;
 async function* entries(prefix){
  for(let offset=0;;offset+=pageSize){
   if(++requests>maxListRequests)throw new Error('Retention listing limit reached; nothing was deleted. Use an operator-reviewed larger limit.');
   const r=await call('object/list/'+c.bucket,{method:'POST',body:JSON.stringify({prefix,limit:pageSize,offset,sortBy:{column:'name',order:'asc'}})});
   if(!r.ok)throw new Error('Retention listing failed (HTTP '+r.status+'); nothing was deleted.');
   const rows=await r.json();if(!Array.isArray(rows)||rows.length>pageSize)throw new Error('Invalid storage listing; nothing was deleted.');
   for(const row of rows)yield row;
   if(rows.length<pageSize)break;
  }
 }
 // Finish the complete bounded listing before deletion. Deleting while paginating skips entries.
 for await(const dir of entries(PREFIX)){
  if(!dir||typeof dir.name!=='string'||dir.id!=null||!dateName(dir.name)){skipped++;continue;}
  for await(const row of entries(PREFIX+'/'+dir.name)){
   const key=row&&row.id!=null&&typeof row.name==='string'?expiredReferenceKey(dir.name,row.name,cutoff):null;
   if(!key){skipped++;continue;}keys.add(key);if(keys.size>maxCandidates)throw new Error('Retention candidate limit reached; nothing was deleted.');
  }
 }
 let removed=0;
 if(remove){const all=[...keys];for(let i=0;i<all.length;i+=100){const batch=all.slice(i,i+100),r=await call('object/'+c.bucket,{method:'DELETE',body:JSON.stringify({prefixes:batch})});if(!r.ok)throw new Error('Retention delete failed after '+removed+' objects (HTTP '+r.status+'). Rerun the dry-run before retrying.');removed+=batch.length;}}
 // Report only counts and bucket name, never raw capabilities, signed tickets or credentials.
 return {bucket:c.bucket,dryRun:!remove,eligible:keys.size,removed,skipped,listRequests:requests,graceMs};
}
export async function main(argv=process.argv.slice(2),env=process.env){
 const [command='check',...flags]=argv;
 if(!['check','create','purge'].includes(command)||flags.some(f=>f!=='--delete')||(flags.length&&command!=='purge'))throw new Error('Usage: reference-ops.mjs check | create | purge [--delete]');
 const c=referenceConfig(env),result=command==='purge'?await purgeReferences(c,{remove:flags.includes('--delete')}):await ensureReferenceBucket(c,{create:command==='create'});
 console.log(JSON.stringify(result,null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
