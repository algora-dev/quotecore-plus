import type { Point } from '../core/types';
import { fingerprint } from '../core/math';
import { fromQuoteCore, type AdaptedTakeoff, type QuoteCoreSnapshot } from './quotecore';

export interface LiveInputCapture {
  schemaVersion: 1; kind: 'quotecore-live-takeoff-snapshot'; adapterVersion: '2.9'|'2.11';
  captureId: string; capturedAt: string; source: 'live-workspace';
  inputFingerprint: string;
  /** Detached plain data. Never a Fabric instance, database row cache or screenshot. */
  snapshot: QuoteCoreSnapshot;
  adapted: AdaptedTakeoff;
  storage?: { status: 'tab-session'|'memory-only'; message: string };
}
const point = (p: Point): Point => ({x:p?.x,y:p?.y});
/** An allowlist is intentional: live rows contain Fabric objects/cycles and
 * unrelated pricing data. Neither belongs in a snapshot or its debug export. */
export function cloneTakeoffSnapshot(s: QuoteCoreSnapshot): QuoteCoreSnapshot {
  if(!s||!Array.isArray(s.roofAreas)||!Array.isArray(s.componentMeasurements)||!Array.isArray(s.components)||!Array.isArray(s.calibrations))
    throw new Error('The live takeoff is not ready. Wait for it to load, then open Find offcuts again.');
  for(const a of s.roofAreas)if(!Array.isArray(a.points))throw new Error(`Finish the roof outline ${a.id??''} before opening Find offcuts.`);
  if(s.roofAreas.length>100||s.componentMeasurements.reduce((n,g)=>n+g.measurements.length,0)>2500)
    throw new Error('This live takeoff exceeds the snapshot size limit. Select a smaller roof scope.');
  const copy:QuoteCoreSnapshot={quoteId:s.quoteId,pageId:s.pageId,areaScopeId:s.areaScopeId??null,imageRevision:s.imageRevision,
    ...(s.imageUrl?{imageUrl:s.imageUrl}:{}),width:s.width,height:s.height,calibrationConfirmed:s.calibrationConfirmed===true,
    calibrations:s.calibrations.map(c=>({id:c.id,point1:point(c.point1),point2:point(c.point2),unit:c.unit,
      ...(c.actualDistance!==undefined?{actualDistance:c.actualDistance}:{}),...(c.pixelDistance!==undefined?{pixelDistance:c.pixelDistance}:{}),...(c.scale!==undefined?{scale:c.scale}:{})})),
    roofAreas:s.roofAreas.map(a=>({id:a.id,name:a.name,points:a.points.map(point),pitch:a.pitch,visible:a.visible!==false,fromPageId:a.fromPageId??null,quoteRoofAreaId:a.quoteRoofAreaId??null})),
    components:s.components.map(c=>({id:c.id,name:c.name,...(c.semanticType!==undefined?{semanticType:c.semanticType}:{}),...(c.is_system!==undefined?{is_system:c.is_system}:{})})),
    componentMeasurements:s.componentMeasurements.map(g=>({componentId:g.componentId,measurements:g.measurements.map(m=>({
      id:m.id,type:m.type,...(m.points?{points:m.points.map(point)}:{}),visible:m.visible!==false,fromPageId:m.fromPageId??null,quoteRoofAreaId:m.quoteRoofAreaId??null,
      ...(m.geometryKind!==undefined?{geometryKind:m.geometryKind}:{}),...(m.aiOrigin!==undefined?{aiOrigin:m.aiOrigin}:{}),...(m.source!==undefined?{source:m.source}:{}),...(m.semanticType!==undefined?{semanticType:m.semanticType}:{})}))})),
    ...(s.semanticByComponentId?{semanticByComponentId:{...s.semanticByComponentId}}:{}),...(s.selectedOutlineIds?{selectedOutlineIds:[...s.selectedOutlineIds]}:{})};
  if(JSON.stringify(copy).length>3_000_000)throw new Error('This live takeoff exceeds the 3 MB snapshot limit. Select a smaller roof scope.');
  return copy;
}
/** Display URL refreshes must not make a correct geometric snapshot stale. */
export function liveInputFingerprint(s: QuoteCoreSnapshot): string {
  const copy=cloneTakeoffSnapshot(s);delete copy.imageUrl;
  return fingerprint(copy);
}
export function freezeSnapshot<T>(value:T):T {
  if(value&&typeof value==='object'&&!Object.isFrozen(value)) {
    for(const child of Object.values(value))freezeSnapshot(child);
    Object.freeze(value);
  }
  return value;
}
export function captureLiveTakeoff(input: QuoteCoreSnapshot): LiveInputCapture {
  const snapshot=cloneTakeoffSnapshot(input), adapted=fromQuoteCore(snapshot);
  if(!snapshot.calibrationConfirmed||!(adapted.roof.mmPerSceneUnit>0))throw new Error('Confirm the current plan calibration before opening Find offcuts. No saved calibration will be substituted.');
  if(!adapted.roof.outlines.length)throw new Error('Draw or select a roof outline in the current page and area first. No old scan outline will be substituted.');
  const incomplete=adapted.issues.find(i=>i.severity==='error');
  if(incomplete)throw new Error(incomplete.message);
  return freezeSnapshot({schemaVersion:1,kind:'quotecore-live-takeoff-snapshot',adapterVersion:'2.11',
    captureId:globalThis.crypto?.randomUUID?.()??`capture-${Date.now()}-${++captureCounter}`,
    capturedAt:new Date().toISOString(),source:'live-workspace',inputFingerprint:liveInputFingerprint(snapshot),snapshot,adapted});
}
let captureCounter=0;
export function exportLiveCapture(capture: LiveInputCapture): string {
  const safe=structuredClone(capture);delete safe.snapshot.imageUrl;delete safe.adapted.roof.imageUrl;
  return JSON.stringify(safe,null,2);
}
export interface CaptureHooks {
  /** Optional cheap scope reader when reading canvas positions requires a commit first. */
  readContext?: () => Pick<QuoteCoreSnapshot,'quoteId'|'pageId'|'areaScopeId'|'imageRevision'>;
  /** Host commits pending text/vertex/polyline edits to its authoritative live
   * model. This is NOT a network save. Reject while a scan/load/edit is pending. */
  prepareSnapshot?: () => void|Promise<void>;
  /** Test/host scheduling hook. Defaults to waiting for a browser paint. */
  settle?: () => Promise<void>;
  signal?: AbortSignal;
}
function browserSettle():Promise<void> {
  return new Promise(resolve=>{
    if(typeof requestAnimationFrame==='function'&&typeof document!=='undefined'&&!document.hidden)requestAnimationFrame(()=>resolve());
    else setTimeout(resolve,0);
  });
}
function checkAbort(signal?:AbortSignal):void {
  if(signal?.aborted)throw new Error('Opening Find offcuts was cancelled. No takeoff was captured.');
}
/** Capture only after the host has committed edits, and only while context and
 * model remain stable. Re-reading means dynamic imports/React commits cannot
 * freeze the button handler's old closure by accident. A reader returning a
 * permanently stale value cannot be detected here: the host contract matters. */
export async function prepareLiveCapture(read:()=>QuoteCoreSnapshot,hooks:CaptureHooks={}):Promise<LiveInputCapture> {
  checkAbort(hooks.signal);
  const start=hooks.readContext?.()??read(),context=fingerprint([start.quoteId,start.pageId,start.areaScopeId??null,start.imageRevision]);
  await hooks.prepareSnapshot?.();checkAbort(hooks.signal);
  const settle=hooks.settle??browserSettle;
  for(let attempt=0;attempt<4;attempt++) {
    await settle();checkAbort(hooks.signal);
    const first=cloneTakeoffSnapshot(read());
    if(fingerprint([first.quoteId,first.pageId,first.areaScopeId,first.imageRevision])!==context)throw new Error('The page, roof area or plan changed while opening Find offcuts. Open it again from the current takeoff.');
    const revision=liveInputFingerprint(first);
    await settle();checkAbort(hooks.signal);
    const second=cloneTakeoffSnapshot(read());
    if(fingerprint([second.quoteId,second.pageId,second.areaScopeId,second.imageRevision])!==context)throw new Error('The page, roof area or plan changed while opening Find offcuts. Open it again from the current takeoff.');
    if(liveInputFingerprint(second)===revision)return captureLiveTakeoff(second);
  }
  throw new Error('The takeoff is still changing. Finish the current drawing or scan, then open Find offcuts again.');
}
