import type { Owner, Tool, Checkpoint, Option, Workflow } from '../coordination/workflow';

/** Safe, minimal presentation DTO. No lease tokens, internal payload hashes,
 * signed storage URLs, policy secrets or raw provider data. */
export type EvidenceView={id:string;filename:string;pageNumber:number;excerpt:string};
export type TaskState='decision'|'manual'|'running'|'queued'|'blocked'|'paused'|'complete'|'interrupted';
export type TaskView={id:string;label:string;areaId:string|null;owner:Owner;version:number;state:TaskState;blockedBy:string[];canAssign:boolean;canResume:boolean;canTakeoverResume:boolean;decision?:{question:string;options:Pick<Option,'id'|'label'|'effect'|'action'>[];recommendedId?:string;evidence:EvidenceView[];missingEvidence:boolean;previewDigest:string;canSelect:boolean}};
export type JobView={quoteId:string;title:string;paused:boolean;canControl:boolean;canInstruct:boolean;revision:string;tasks:TaskView[];state:'attention'|'working'|'waiting'|'prepared';};
export type HubView={jobs:JobView[];counts:Record<JobView['state'],number>};
export type HubCommand=
 | {kind:'assign';taskId:string;version:number;owner:Owner}
 | {kind:'select';taskId:string;version:number;previewDigest:string;optionId:string}
 | {kind:'resume';taskId:string;version:number}
 | {kind:'takeover_resume';taskId:string;version:number}
 | {kind:'pause';revision:string;paused:boolean};
export type HubResult={kind:'updated';job:JobView}|{kind:'resume';quoteId:string;editor:Checkpoint['kind'];checkpoint:Checkpoint;requiresServerHydration:true};
export type InstructionRequest={quoteId:string;revision:string;taskId?:string;taskVersion?:number;text:string;source:'text'|'voice'};
export type InstructionPreview={summary:string;questions:string[]}; // preview only, never a mutation receipt
export const toolLabels:Record<Tool,string>={documents:'Read documents',requirements:'Review project requirements',quantity_route:'Choose measurement source',stated_quantities:'Extract stated quantities',digital_takeoff:'Digital takeoff',profile:'Choose roofing library',optimise:'Optimise materials',price:'Prepare pricing',scope_allowances:'Review scope and allowances',quote_draft:'Prepare quotation'};
export const stateLabels:Record<TaskState,string>={decision:'Needs your decision',manual:'Assigned to you',running:'Working',queued:'Ready to run',blocked:'Waiting for dependency',paused:'Paused',complete:'Complete',interrupted:'Worker interrupted'};
export function summarizeJobs(jobs:JobView[]):HubView {return {jobs,counts:{attention:jobs.filter(j=>j.state==='attention').length,working:jobs.filter(j=>j.state==='working').length,waiting:jobs.filter(j=>j.state==='waiting').length,prepared:jobs.filter(j=>j.state==='prepared').length}};}
export function taskLabel(n:Workflow['nodes'][number]){return `${n.areaId?`${n.areaId} · `:''}${toolLabels[n.tool]}`;}
