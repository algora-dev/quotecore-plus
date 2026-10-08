import { ReviewConflict, sameReviewScope, reviewScopeKey, type ReviewScope } from './reviews';
import { parseRecoveryDocument, type RecoveryDocument, type RecoveryRecord } from './recoveryData';
import type { ReviewRpcClient } from './browserReviewStore';
export interface RecoveryHint {scope:ReviewScope;savedAt:string;imageKey:string;status:RecoveryDocument['status'];}
export interface RecoveryRepository {
  listPage?(quoteId:string,pageId:string):Promise<RecoveryHint[]>;
  load(scope:ReviewScope):Promise<RecoveryRecord|null>;
  save(scope:ReviewScope,document:RecoveryDocument,expectedRevision:number):Promise<RecoveryRecord>;
}
export function createAccountRecoveryRepository(client:ReviewRpcClient):RecoveryRepository {
  const args=(s:ReviewScope)=>({p_quote:s.quoteId,p_page:s.pageId,p_area:s.areaScopeId});
  const unwrap=(raw:unknown,scope:ReviewScope):RecoveryRecord|null=>{
    if(raw==null)return null;const r=(Array.isArray(raw)?raw[0]:raw) as RecoveryRecord;
    if(!r||!Number.isSafeInteger(r.revision)||r.revision<1)throw new Error('Invalid checkpoint revision.');
    return {revision:r.revision,document:parseRecoveryDocument(r.document,scope)};
  };
  return {async listPage(quoteId,pageId){
    const r=await client.rpc('qc_takeoff_checkpoint_list',{p_quote:quoteId,p_page:pageId});
    if(r.error)throw new Error(r.error.message);if(!Array.isArray(r.data))throw new Error('Invalid checkpoint index.');
    return r.data.filter((row:unknown)=>{const h=row as RecoveryHint;return !!h?.scope&&h.scope.quoteId===quoteId&&h.scope.pageId===pageId&&typeof h.imageKey==='string'&&Number.isFinite(Date.parse(h.savedAt))&&['active','completed','discarded'].includes(h.status);}) as RecoveryHint[];
  },async load(scope){const r=await client.rpc('qc_takeoff_checkpoint_load',args(scope));if(r.error)throw new Error(`Recovery store unavailable: ${r.error.message}. The V2.20 checkpoint migration may need to be applied.`);
    if(r.data==null)return null;const row=(Array.isArray(r.data)?r.data[0]:r.data) as {revision?:unknown;document?:unknown};
    if(!row||typeof row.revision!=='number'||!Number.isSafeInteger(row.revision)||row.revision<1)throw new Error('Invalid checkpoint revision.');const revision:number=row.revision;
    // Quarantine, not a hard failure: an unverifiable document must not block
    // the scope, and its revision feeds the CAS update that replaces it.
    try{return {revision,document:parseRecoveryDocument(row.document,scope)};}catch{return {revision,document:null};}
  },
    async save(scope,document,expectedRevision){
      const checked=parseRecoveryDocument(document,scope);
      const r=await client.rpc('qc_takeoff_checkpoint_save',{...args(scope),p_document:checked,p_expected_revision:expectedRevision});
      if(r.error){if(r.error.code==='23505'&&/checkpoint revision conflict/i.test(r.error.message))throw new ReviewConflict();throw new Error(`Measurements could not be saved to your account: ${r.error.message}`);}
      const saved=unwrap(r.data,scope);if(!saved)throw new Error('Checkpoint save returned no confirmation.');return saved;
    }};
}
export interface RecoveryBackup {put(document:RecoveryDocument):Promise<void>;load(scope:ReviewScope):Promise<RecoveryDocument|null>;listPage?(quoteId:string,pageId:string):Promise<RecoveryHint[]>;}
/** Separate account namespaces. No signed URLs/Fabric instances. Recent
 * checkpoint IDs are retained so a new tab cannot erase another tab's local copy. */
export function createRecoveryBackup(accountId:string):RecoveryBackup {
  if(!accountId)throw new Error('Sign in before accessing device recovery.');
  const prefix=JSON.stringify(accountId)+'|';
  const open=():Promise<IDBDatabase>=>new Promise((resolve,reject)=>{
    let rejected=false;const r=indexedDB.open('quotecore-takeoff-recovery-v220',1);
    r.onupgradeneeded=()=>r.result.createObjectStore('checkpoints');
    r.onerror=()=>reject(new Error('Device recovery storage unavailable.'));r.onblocked=()=>{rejected=true;reject(new Error('Close older tabs to enable recovery storage.'));};
    r.onsuccess=()=>{r.result.onversionchange=()=>r.result.close();if(rejected)r.result.close();else resolve(r.result);};
  });
  return {async listPage(quoteId,pageId){const db=await open();return new Promise((resolve,reject)=>{
    const tx=db.transaction('checkpoints','readonly'),request=tx.objectStore('checkpoints').openCursor(),hints=new Map<string,RecoveryHint>();
    request.onsuccess=()=>{const c=request.result;if(!c)return;if(typeof c.key==='string'&&c.key.startsWith(prefix)){try{const d=parseRecoveryDocument(c.value);if(d.scope.quoteId===quoteId&&d.scope.pageId===pageId){const k=reviewScopeKey(d.scope),old=hints.get(k);if(!old||d.savedAt>old.savedAt)hints.set(k,{scope:d.scope,savedAt:d.savedAt,imageKey:d.imageKey,status:d.status});}}catch{/* invalid copy quarantined */}}c.continue();};
    tx.oncomplete=()=>{db.close();resolve([...hints.values()].sort((a,b)=>b.savedAt.localeCompare(a.savedAt)));};tx.onabort=()=>{db.close();reject(tx.error);};tx.onerror=()=>{};
  });},async put(document){const d=parseRecoveryDocument(document),db=await open();return new Promise((resolve,reject)=>{
    const tx=db.transaction('checkpoints','readwrite',{durability:'strict'}),store=tx.objectStore('checkpoints'),base=prefix+reviewScopeKey(d.scope)+'|';
    store.put(d,base+d.id);
    const prior:Array<{key:IDBValidKey;savedAt:string}>=[],cursor=store.openCursor();
    cursor.onsuccess=()=>{const c=cursor.result;if(c){if(typeof c.key==='string'&&c.key.startsWith(base)&&c.key!==base+d.id)prior.push({key:c.key,savedAt:String((c.value as RecoveryDocument).savedAt)});c.continue();}
      else for(const row of prior.sort((a,b)=>b.savedAt.localeCompare(a.savedAt)).slice(2))store.delete(row.key);};
    tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>{db.close();reject(tx.error??new Error('Device checkpoint was not committed.'));};tx.onerror=()=>{};
  });},async load(scope){const db=await open();return new Promise((resolve,reject)=>{
    const tx=db.transaction('checkpoints','readonly'),r=tx.objectStore('checkpoints').openCursor(),base=prefix+reviewScopeKey(scope)+'|';let latest:RecoveryDocument|null=null;
    r.onsuccess=()=>{const c=r.result;if(!c)return;if(typeof c.key==='string'&&c.key.startsWith(base)){try{const d=parseRecoveryDocument(c.value,scope);if(!latest||d.savedAt>latest.savedAt)latest=d;}catch{/* invalid copy is never restored */}}c.continue();};
    tx.oncomplete=()=>{db.close();resolve(latest);};tx.onabort=()=>{db.close();reject(tx.error);};tx.onerror=()=>{};
  });}};
}
export function memoryRecoveryRepository():RecoveryRepository {
  const rows=new Map<string,RecoveryRecord>();return{async listPage(quoteId,pageId){return [...rows.values()].filter(r=>r.document&&r.document.scope.quoteId===quoteId&&r.document.scope.pageId===pageId).map(r=>r.document?({scope:r.document.scope,savedAt:r.document.savedAt,imageKey:r.document.imageKey,status:r.document.status}):null).filter((h):h is RecoveryHint=>h!==null);},async load(s){return structuredClone(rows.get(reviewScopeKey(s))??null);},async save(s,d,expected){
    if(!sameReviewScope(s,d.scope))throw new Error('Wrong scope');const k=reviewScopeKey(s),old=rows.get(k);if((old?.revision??0)!==expected)throw new ReviewConflict();const row={revision:expected+1,document:parseRecoveryDocument(d,s)};rows.set(k,row);return structuredClone(row);
  }};
}
