import { prepareMeasurements } from '../measurements/prepare';
import { ensure, finite, id, integer, list, record, unique, hash } from '../contracts/validation';
import { buildSourceToScene, applyAffine, distance, assertPointInRaster } from '../../takeoff/calibrationCoordinates';
import { convertDistance, parseDistanceSuggestion } from '../../takeoff/calibrationCandidates';

/** Experimental adapter for vector endpoints already extracted from the DISPLAYED
 * rotated source raster, not PDF points or inferred text-box corners. A human
 * explicitly associates a dimension with endpoints and optionally a feature
 * across drawings. All outputs are advisory, never a calibration commit. */
export function vectorCalibrationProposals(brief:unknown,raw:unknown){
 const p=prepareMeasurements(brief);ensure(p.ready,'brief not reviewed');
 const rows=list(raw,'vector observations',(v,f)=>{
  const r=record(v,f,['id','factId','evidenceId','revisionId','pageIndex','pageHash','transformVersion','width','height','p1','p2','featureId']);
  const width=integer(r.width,f,1,100000),height=integer(r.height,f,1,100000);
  const point=(v:unknown)=>{const q=record(v,f,['x','y']);const a={x:finite(q.x,f,0,width),y:finite(q.y,f,0,height)};assertPointInRaster(a,width,height,f);return a;};
  const revisionId=id(r.revisionId,f),pageIndex=integer(r.pageIndex,f),pageHash=hash(r.pageHash,f),transformVersion=integer(r.transformVersion,f,1);
  const hint=p.calibrationHints.find(h=>h.factId===r.factId&&h.evidence.id===r.evidenceId&&h.evidence.documentRevisionId===revisionId&&h.evidence.pageIndex===pageIndex&&h.evidence.pageHash===pageHash&&h.evidence.transformVersion===transformVersion);
  ensure(hint,'current reviewed dimension required');
  const parsed=parseDistanceSuggestion(hint.sourceText,null);ensure(parsed,'written distance');
  const scene=buildSourceToScene(width,height),p1=applyAffine(scene.transform,point(r.p1)),p2=applyAffine(scene.transform,point(r.p2));
  const span=distance(p1,p2);ensure(span>=1,'degenerate vector');
  const writtenMm=convertDistance(parsed.distance,parsed.unit,'mm');
  const candidateMmPerSceneUnit=writtenMm/span;ensure(Number.isFinite(candidateMmPerSceneUnit)&&candidateMmPerSceneUnit>0,'invalid scale');
  return {id:id(r.id,f),featureId:r.featureId===null?null:id(r.featureId,f),revisionId,pageIndex,pageHash,transformVersion,width,height,sceneWidth:scene.sceneWidth,sceneHeight:scene.sceneHeight,sceneP1:p1,sceneP2:p2,writtenMm,candidateMmPerSceneUnit,evidence:hint.evidence,factId:hint.factId,factVersion:hint.factVersion,requiresEndpointReview:true as const,calibrationConfirmed:false as const};
 },100);unique(rows,r=>r.id,'observation IDs');
 // No averaging, automatic registration or selection. Two drawing dimensions
 // can describe the same feature only after explicit association by a reviewer.
 const issues:{code:string;observationIds:string[]}[]=[];
 const differs=(a:number,b:number)=>Math.abs(a-b)>Math.max(a,b)*0.01; // provisional advisory threshold, not calibration tolerance
 for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
  const a=rows[i],b=rows[j],samePage=a.revisionId===b.revisionId&&a.pageIndex===b.pageIndex;
  if(samePage&&(a.width!==b.width||a.height!==b.height))issues.push({code:'raster_dimensions_disagree',observationIds:[a.id,b.id]});
  else if(samePage&&differs(a.candidateMmPerSceneUnit,b.candidateMmPerSceneUnit))issues.push({code:'page_scale_disagreement',observationIds:[a.id,b.id]});
  if(!samePage&&a.featureId!==null&&a.featureId===b.featureId&&differs(a.writtenMm,b.writtenMm))issues.push({code:'cross_drawing_dimension_disagreement',observationIds:[a.id,b.id]});
 }
 return {rows,issues,thresholdPercent:1,requiresManualRegistration:true as const,writeAuthorized:false as const};
}
