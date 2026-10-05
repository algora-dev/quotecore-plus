import { captureLiveTakeoff, exportLiveCapture, freezeSnapshot, type LiveInputCapture } from './liveSnapshot';
import type { QuoteCoreSnapshot } from './quotecore';
/** One bounded checkpoint per browser tab, not a silent cloud save. Keeping a
 * single latest snapshot avoids accumulating private geometry across quotes. */
export const LIVE_CAPTURE_KEY='quotecore.offcuts.live-input.v1';
export interface SnapshotStorage { getItem(key:string):string|null; setItem(key:string,value:string):void; removeItem(key:string):void }
let latest:LiveInputCapture|null=null;
export function checkpointLiveCapture(capture:LiveInputCapture,storage?:SnapshotStorage|null):LiveInputCapture {
  let result:LiveInputCapture={...capture,storage:{status:'memory-only',message:'Input captured in this open review. Export the debug bundle to keep it.'}};
  // Publish memory first: a quota/security error must not lose the true input.
  latest=freezeSnapshot(result);
  try {
    const store=storage===undefined?(typeof window==='undefined'?null:window.sessionStorage):storage;
    if(store) {
      // Never leave an older same-tab checkpoint masquerading as this run.
      store.removeItem(LIVE_CAPTURE_KEY);
      result={...capture,storage:{status:'tab-session',message:'Input checkpoint saved in this browser tab; not saved to the quote.'}};
      store.setItem(LIVE_CAPTURE_KEY,exportLiveCapture(result));
      latest=freezeSnapshot(result);
    }
  } catch { /* Restricted browser storage: keep an explicit memory-only status. */ }
  return latest;
}
export function latestLiveCapture():LiveInputCapture|null {return latest;}
export function forgetLiveCapture(storage?:SnapshotStorage|null):void {
  latest=null;
  try{(storage===undefined?(typeof window==='undefined'?null:window.sessionStorage):storage)?.removeItem(LIVE_CAPTURE_KEY);}catch{/* optional storage */}
}
/** Recovery is explicit, data-only and exact-scope checked. It NEVER participates
 * in normal opening; a new button click ALWAYS reads the current workspace. */
export function recoverLiveSnapshot(text:string,scope:{quoteId:string;pageId:string;areaScopeId:string|null}):QuoteCoreSnapshot {
  if(text.length>8_000_000)throw new Error('Snapshot exceeds the 8 MB recovery limit.');
  const value=JSON.parse(text) as Partial<LiveInputCapture>;
  if(value.kind!=='quotecore-live-takeoff-snapshot'||value.schemaVersion!==1||!value.snapshot)throw new Error('Not a live-input snapshot.');
  const s=value.snapshot;
  if(s.quoteId!==scope.quoteId||s.pageId!==scope.pageId||(s.areaScopeId??null)!==scope.areaScopeId)throw new Error('This snapshot belongs to another quote, page or roof area.');
  // Do not trust stored adaptation, executable/image URLs or confirmations.
  const raw=structuredClone(s);delete raw.imageUrl;
  const checked=captureLiveTakeoff(raw);
  return structuredClone(checked.snapshot);
}
