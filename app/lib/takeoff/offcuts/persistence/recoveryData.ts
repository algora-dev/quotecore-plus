import {recoveryId} from '../reliability/id';
import { captureLiveTakeoff, exportLiveCapture, legacyLiveInputFingerprint, type LiveInputCapture } from '../adapters/liveSnapshot';
import { canonicalFingerprint, fingerprint } from '../core/math';
import type { Point } from '../core/types';
import { sameReviewScope, type ReviewDocument, type ReviewScope } from './reviews';
import {validCalculationJournal,type CalculationJournal} from '../reliability/protocol';
export type MeasurementKind='line'|'area'|'point'|'multi_lineal'|'multi_lineal_lxh'|'volume_3d'|'length_x_height_freestyle'|'multi_lineal_lxh_freestyle';
export interface RecoveryEntryInputs {height_m?:number|null;depth_m?:number|null;value_basis?:'plan'|'pitched'|'offcuts'|'corner_all'|'corner_external'|'corner_internal';plan_value?:number;pitch_applied?:boolean;source_geometry_id?:string;offcut_layout_id?:string;offcut_source_revision?:string;offcut_faces_revision?:string;corner_count?:number;}
export interface RecoveryMeasurement {id:string;type:MeasurementKind;value:number;points?:Point[];visible:boolean;fromPageId?:string|null;quoteRoofAreaId?:string|null;entryInputs?:RecoveryEntryInputs|null;aiOrigin?:boolean;}
export interface RecoveryGroup {componentId:string;expanded:boolean;measurements:RecoveryMeasurement[];}
export interface RecoveryArea {id:string;name:string;points:Point[];area:number;pitch:number;visible:boolean;fromPageId?:string|null;quoteRoofAreaId?:string|null;}
export interface RecoveryCalibration {id:string;point1:Point;point2:Point;pixelDistance:number;actualDistance:number;unit:'feet'|'meters';scale:number;}
export interface RecoveryTouchEntry {id:string;key:string;componentId:string|null;displayName:string;colour:string;value:number;kind:'line'|'area'|'point';hidden:boolean;points:Point[];fromRoofAreaId?:string;quoteRoofAreaId?:string|null;planValue?:number;fromOffcuts?:boolean;cornerBasis?:'all'|'external'|'internal';cornerCount?:number;sourceGeometryId?:string|null;}
export interface WorkstationRecoveryState {
  componentMeasurements:RecoveryGroup[];roofAreas:RecoveryArea[];calibrations:RecoveryCalibration[];calibrationConfirmed:boolean;
  activeComponentIds:string[];selectedComponentId:string|null;activeSaveRoofAreaId:string|null;
  componentColors:Array<{componentId:string;color:string}>;touchEntries:RecoveryTouchEntry[];touchHydratedIds:string[];
  calibrationMetadataText:string|null;measurementSystem:string;sessionVersion:number|null;
}
export interface RecoveryDocument {
  schemaVersion:1;kind:'quotecore-takeoff-recovery';engineVersion:'2.20'|'2.21'|'2.22'|'2.23'|'2.24';id:string;scope:ReviewScope;
  imageKey:string;savedAt:string;status:'active'|'completed'|'discarded';capture:LiveInputCapture;
  workstation:WorkstationRecoveryState;review:ReviewDocument|null;calculation:CalculationJournal|null;
}
/** A null document means the stored row exists but its content can no longer
 * be verified (pre-canonical jsonb rows). It is never restored; the revision is
 * reported so the next compare-and-swap save replaces the row. */
export interface RecoveryRecord {revision:number;document:RecoveryDocument|null;}
export const RECOVERY_MAX_BYTES=12_000_000;
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const finite=(n:unknown):n is number=>typeof n==='number'&&Number.isFinite(n);
const points=(v:unknown):boolean=>Array.isArray(v)&&v.length<=20_000&&v.every(p=>record(p)&&finite(p.x)&&finite(p.y)&&Math.abs(p.x)<1e8&&Math.abs(p.y)<1e8);
const kinds:MeasurementKind[]=['line','area','point','multi_lineal','multi_lineal_lxh','volume_3d','length_x_height_freestyle','multi_lineal_lxh_freestyle'];
/** This decoder is deliberately independent of Fabric and database price rows. */
export function checkedWorkstationState(value:unknown):WorkstationRecoveryState {
  if(!record(value)||!Array.isArray(value.componentMeasurements)||value.componentMeasurements.length>1000||!Array.isArray(value.roofAreas)||value.roofAreas.length>100||!Array.isArray(value.calibrations))throw new Error('Invalid takeoff recovery state.');
  const ids=new Set<string>();let count=0;
  for(const g of value.componentMeasurements){
    if(!record(g)||typeof g.componentId!=='string'||!Array.isArray(g.measurements)||typeof g.expanded!=='boolean')throw new Error('Invalid recovered component group.');
    for(const m of g.measurements){if(++count>2500||!record(m)||typeof m.id!=='string'||ids.has(m.id)||!kinds.includes(m.type as MeasurementKind)||!finite(m.value)||m.value<0||typeof m.visible!=='boolean'||m.points!==undefined&&!points(m.points))throw new Error('Invalid or duplicate recovered measurement.');ids.add(m.id);
      if(m.entryInputs!==undefined&&m.entryInputs!==null){if(!record(m.entryInputs))throw new Error('Invalid recovered entry inputs.');
        for(const [k,v] of Object.entries(m.entryInputs)){
          if(['height_m','depth_m','plan_value','corner_count'].includes(k)&&v!==null&&!finite(v))throw new Error('Invalid recovered numeric input.');
          if(k==='value_basis'&&!['plan','pitched','offcuts','corner_all','corner_external','corner_internal'].includes(String(v)))throw new Error('Unknown recovered quantity basis.');
        }
      }
    }
  }
  for(const a of value.roofAreas)if(!record(a)||typeof a.id!=='string'||typeof a.name!=='string'||!points(a.points)||!finite(a.area)||a.area<0||!finite(a.pitch)||a.pitch<0||a.pitch>=90||typeof a.visible!=='boolean')throw new Error('Invalid recovered roof area.');
  for(const c of value.calibrations)if(!record(c)||typeof c.id!=='string'||!points([c.point1,c.point2])||!finite(c.actualDistance)||c.actualDistance<=0||!finite(c.pixelDistance)||c.pixelDistance<=0||!finite(c.scale)||c.scale<=0||!['feet','meters'].includes(String(c.unit)))throw new Error('Invalid recovered calibration.');
  if(typeof value.calibrationConfirmed!=='boolean'||!Array.isArray(value.activeComponentIds)||!value.activeComponentIds.every(x=>typeof x==='string')||!Array.isArray(value.componentColors)||!Array.isArray(value.touchEntries)||value.touchEntries.length>2500||!Array.isArray(value.touchHydratedIds)||!value.touchHydratedIds.every(x=>typeof x==='string')||typeof value.measurementSystem!=='string')throw new Error('Invalid recovery controls.');
  if(![value.selectedComponentId,value.activeSaveRoofAreaId].every(v=>v===null||typeof v==='string')||!(value.sessionVersion===null||Number.isSafeInteger(value.sessionVersion)))throw new Error('Invalid recovered selection/version.');
  for(const c of value.componentColors)if(!record(c)||typeof c.componentId!=='string'||typeof c.color!=='string')throw new Error('Invalid recovered component colours.');
  for(const e of value.touchEntries)if(!record(e)||typeof e.id!=='string'||typeof e.key!=='string'||!(e.componentId===null||typeof e.componentId==='string')||typeof e.displayName!=='string'||typeof e.colour!=='string'||!finite(e.value)||e.value<0||!['line','area','point'].includes(String(e.kind))||!points(e.points)||typeof e.hidden!=='boolean')throw new Error('Invalid recovered touch measurement.');
  if(value.calibrationMetadataText!==null&&typeof value.calibrationMetadataText!=='string')throw new Error('Invalid calibration metadata.');
  return structuredClone(value) as unknown as WorkstationRecoveryState;
}
export function createRecoveryDocument(capture:LiveInputCapture,workstation:WorkstationRecoveryState,imageKey:string):RecoveryDocument {
  const c=JSON.parse(exportLiveCapture(capture)) as LiveInputCapture;
  workstation=structuredClone(workstation);
  const sourceRows=new Map(c.snapshot.componentMeasurements.flatMap(g=>g.measurements.map(m=>[m.id,m] as const)));
  for(const group of workstation.componentMeasurements)for(const m of group.measurements){const drawn=sourceRows.get(m.id);if(drawn?.points)m.points=structuredClone(drawn.points);}
  for(const area of workstation.roofAreas){const drawn=c.snapshot.roofAreas.find(a=>a.id===area.id);if(drawn)area.points=structuredClone(drawn.points);}
  return parseRecoveryDocument({schemaVersion:1,kind:'quotecore-takeoff-recovery',engineVersion:'2.24',id:recoveryId(),
    scope:{quoteId:c.snapshot.quoteId,pageId:c.snapshot.pageId,areaScopeId:c.snapshot.areaScopeId??null},imageKey,savedAt:new Date().toISOString(),status:'active',capture:c,workstation,review:null,calculation:null});
}
export function parseRecoveryDocument(value:unknown,scope?:ReviewScope):RecoveryDocument {
  const text=JSON.stringify(value);if(!text||new TextEncoder().encode(text).length>RECOVERY_MAX_BYTES)throw new Error('The recovery checkpoint exceeds its 12 MB limit.');
  const d=JSON.parse(text) as RecoveryDocument;
  if(d?.schemaVersion!==1||d.kind!=='quotecore-takeoff-recovery'||!['2.20','2.21','2.22','2.23','2.24'].includes(d.engineVersion)||typeof d.id!=='string'||!d.scope||typeof d.scope.quoteId!=='string'||typeof d.scope.pageId!=='string'||typeof d.imageKey!=='string'||!['active','completed','discarded'].includes(d.status)||!Number.isFinite(Date.parse(d.savedAt)))throw new Error('Invalid takeoff recovery document.');
  if(scope&&!sameReviewScope(d.scope,scope))throw new Error('Recovery belongs to a different quote, page or roof area.');
  const capture=captureLiveTakeoff(d.capture?.snapshot);
  // Canonical hashing is immune to jsonb/clone key reordering; the legacy hash
  // still verifies copies saved before the canonical switch (their original
  // key order is preserved in device storage). Neither branch accepts altered
  // data: both are exact-content checks of the same parsed snapshot.
  const stored=d.capture?.inputFingerprint;
  const verifiedFingerprint=stored===capture.inputFingerprint?capture.inputFingerprint:stored===legacyLiveInputFingerprint(capture.snapshot)?stored:null;
  if(!sameReviewScope(d.scope,{quoteId:capture.snapshot.quoteId,pageId:capture.snapshot.pageId,areaScopeId:capture.snapshot.areaScopeId??null})||verifiedFingerprint===null)throw new Error('Recovery source does not match its scope or fingerprint.');
  d.capture=JSON.parse(exportLiveCapture({...capture,captureId:d.capture.captureId,capturedAt:d.capture.capturedAt})) as LiveInputCapture;
  d.workstation=checkedWorkstationState(d.workstation);
  if(d.review&&(!sameReviewScope(d.review.scope,d.scope)||d.review.sourceFingerprint!==verifiedFingerprint))throw new Error('Recovery review is not derived from this captured input.');
  if(d.calculation&&!validCalculationJournal(d.calculation))throw new Error('Invalid calculation journal.');
  return d;
}
export function recoveryStateFingerprint(state:WorkstationRecoveryState):string {
  // Display selection and collapsed rails do not mean the measured roof changed.
  // Canonical: one side of every comparison crossed a persistence round-trip.
  return canonicalFingerprint([state.componentMeasurements.map(g=>[g.componentId,g.measurements]),state.roofAreas,state.calibrations,state.calibrationConfirmed,state.touchEntries,state.measurementSystem]);
}
export function stableRecoveryImageKey(pageId:string,url:string,width:number,height:number,revision?:string|null):string {
  let path=url.split(/[?#]/)[0];try{path=new URL(url).pathname;}catch{/* local/demo URL */}
  return fingerprint([pageId,revision||path,width,height]);
}
