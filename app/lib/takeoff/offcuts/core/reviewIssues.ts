import type { Draft, Issue, RoofFace } from './types';
import { fingerprint } from './math';
/** Ignore hides an advisory, never the underlying geometry or validator. A
 * changed face / profile / scope gets a new key and requires fresh review. */
export function warningKey(issue:Issue,draft:Draft):string {
  const faces=issue.faceId?draft.faces.filter(f=>f.id===issue.faceId):draft.faces;
  return fingerprint([issue.code,issue.message,issue.faceId,issue.objectId,issue.location,
    draft.roof.sourceRevision,draft.roof.draftingTolerance,draft.roof.mmPerSceneUnit,
    faces.map(f=>[f.id,f.polygon,f.flow,f.directionApproval]),draft.profile]);
}
export function warningDismissed(issue:Issue,draft:Draft):boolean {
  return issue.severity==='warning' && !!draft.dismissedWarnings?.includes(warningKey(issue,draft));
}
export function dismissWarning(draft:Draft,issue:Issue):void {
  if(issue.severity!=='warning')throw new Error('This issue needs a fix before continuing; it cannot be ignored.');
  draft.dismissedWarnings=[...new Set([...(draft.dismissedWarnings??[]),warningKey(issue,draft)])].slice(-500);
}
export function issueTitle(issue:Issue,faces:RoofFace[]):string {
  const face=faces.find(f=>f.id===issue.faceId)?.name;
  if(issue.code==='DANGLING_LINE')return 'Connect or review this boundary';
  if(issue.code==='FLOW_REVIEW'||issue.code==='MISSING_FLOW')return `${face??'Face'} needs a water direction`;
  if(issue.code==='BACKGROUND_IMAGE')return 'Plan image unavailable';
  if(issue.code==='LOCAL_REPAIR_REVIEW')return 'Check the repaired face';
  if(issue.code==='PROFILE_UNVERIFIED')return 'Profile details not yet checked';
  if(issue.code==='REVIEWED_BOUNDARY'||/FLOW_EAVE_CONFLICT|RIDGE_DIRECTION|BARGE_DIRECTION/.test(issue.code))return 'Your reviewed direction is being used';
  if(issue.code==='DRAWING_SLIVER')return 'Small drawing difference';
  if(issue.code==='INVALID_POLYGON')return 'Adjust the face outline';
  if(issue.code==='CONFLICTING_EDGE')return 'Boundary labels need review';
  return issue.severity==='error'?`Check ${face??'this input'}`:'Review note';
}
