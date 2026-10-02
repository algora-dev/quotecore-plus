import { ReviewConflict, reviewScopeKey, sameReviewScope, type ReviewRepository, type ReviewScope, type ReviewDocument, type StoredReview } from './reviews';
/** Durable device backup. Namespace by authenticated account, not merely quote.
 * Clear this namespace at logout on shared devices. This is NOT database sync. */
export function createBrowserReviewRepository(accountId:string):ReviewRepository & {clearAccount:()=>Promise<void>} {
  if(!accountId.trim())throw new Error('An authenticated account ID is required for the local review namespace.');
  const dbName='quotecore-offcut-reviews-v1',table='reviews',prefix=JSON.stringify(accountId)+'|';
  const database=():Promise<IDBDatabase>=>new Promise((resolve,reject)=>{
    const request=indexedDB.open(dbName,1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(table))request.result.createObjectStore(table);};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(new Error('Browser draft storage is unavailable. Export the draft or use account saving.'));request.onblocked=()=>reject(new Error('Close older draft tabs to enable device storage.'));
  });
  return{kind:'device',async load(scope){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction(table,'readonly'),r=tx.objectStore(table).get(prefix+reviewScopeKey(scope));r.onsuccess=()=>resolve(r.result??null);tx.onerror=()=>reject(tx.error);tx.oncomplete=()=>db.close();});},
    async save(scope,document,expectedRevision){
      if(!sameReviewScope(scope,document.scope))throw new Error('Review scope mismatch.');
      const db=await database();return new Promise((resolve,reject)=>{
        const tx=db.transaction(table,'readwrite'),store=tx.objectStore(table),key=prefix+reviewScopeKey(scope),request=store.get(key);let conflict=false,result:StoredReview;
        request.onsuccess=()=>{const existing=request.result as StoredReview|undefined;if((existing?.revision??0)!==expectedRevision){conflict=true;tx.abort();return;}result={revision:expectedRevision+1,document:structuredClone(document)};store.put(result,key);};
        tx.oncomplete=()=>{db.close();resolve(result);};tx.onabort=()=>{db.close();reject(conflict?new ReviewConflict():tx.error??new Error('Device save aborted.'));};tx.onerror=()=>{};
      });
    },async clearAccount(){const db=await database();return new Promise((resolve,reject)=>{const tx=db.transaction(table,'readwrite'),store=tx.objectStore(table),r=store.openCursor();r.onsuccess=()=>{const c=r.result;if(c){if(typeof c.key==='string'&&c.key.startsWith(prefix))c.delete();c.continue();}};tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>{db.close();reject(tx.error);};});}}
}
export interface ReviewRpcClient { rpc(name:string,args:Record<string,unknown>):PromiseLike<{data:unknown;error:{message:string;code?:string}|null}> }
/** Uses the logged-in browser/session client. NEVER pass a service-role key.
 * SQL checks auth.uid(), quote visibility and page/area ownership independently. */
export function createAccountReviewRepository(client:ReviewRpcClient):ReviewRepository {
  const args=(s:ReviewScope)=>({p_quote:s.quoteId,p_page:s.pageId,p_area:s.areaScopeId});
  const unwrap=(data:unknown):StoredReview|null=>{if(data===null)return null;const value=Array.isArray(data)?data[0]:data;if(!value||typeof value!=='object')throw new Error('Unexpected draft-store response.');const r=value as StoredReview;if(!Number.isInteger(r.revision)||r.revision<1||!r.document)throw new Error('Invalid stored draft revision.');return r;};
  return{kind:'cloud',async load(scope){const r=await client.rpc('qc_offcut_review_load',args(scope));if(r.error)throw new Error(r.error.message);return unwrap(r.data);},
    async save(scope,document,expectedRevision){const r=await client.rpc('qc_offcut_review_save',{...args(scope),p_document:document,p_expected_revision:expectedRevision});
      // 40001 is kept for self-hosted gateways without PostgREST's 40001 retry;
      // 23505 is used on Supabase where a 40001 RAISE is retried until gateway timeout.
      if(r.error){if(r.error.code==='40001'||(r.error.code==='23505'&&/Review revision conflict/i.test(r.error.message)))throw new ReviewConflict();throw new Error(r.error.message);}
      const saved=unwrap(r.data);if(!saved)throw new Error('Save returned no revision.');return saved;}};
}
/** Memory repository for isolated tests; deliberately not labelled durable. */
export function createMemoryReviewRepository():ReviewRepository {
  const rows=new Map<string,StoredReview>();
  return{kind:'memory',async load(scope){const r=rows.get(reviewScopeKey(scope));return r?structuredClone(r):null;},async save(scope:ReviewScope,document:ReviewDocument,expectedRevision:number){const k=reviewScopeKey(scope),row=rows.get(k);if((row?.revision??0)!==expectedRevision)throw new ReviewConflict();const next={revision:expectedRevision+1,document:structuredClone(document)};rows.set(k,next);return structuredClone(next);}};
}
