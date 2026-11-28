import { parseScope, sameScope, type JobScope } from '../contracts/evidence';
import { ensure, id, integer, hash, text, unique } from '../contracts/validation';
import { type Action, type AgentPolicy, parsePolicy } from '../contracts/policy';
import { admit, type AuthoritySnapshot } from '../policy/admission';
import { digest } from '../policy/approval';

/** Server-owned planning projection. References are not writes, approval receipts,
 * geometry, or trusted just because a model produced them. Never accept a graph
 * or artifact reference directly from the client. */
export type Tool = 'documents'|'requirements'|'quantity_route'|'stated_quantities'|'digital_takeoff'|'profile'|'optimise'|'price'|'scope_allowances'|'quote_draft';
export type Owner = 'human'|'intelligence';
export type Status = 'pending'|'running'|'waiting'|'complete';
export type Artifact = {scope:JobScope;recordId:string;version:number;contentHash:string;kind:Tool};
export type Checkpoint = {scope:JobScope;recordId:string;version:number;contentHash:string;kind:'takeoff'|'measurements'|'builder';pageId?:string;selectionId?:string};
export type Option = {id:string;label:string;effect:string;action:'use_stated'|'use_takeoff'|'select_library'|'resolve_scope'|'correct_quantity'|'request_clarification';targetId:string;targetVersion:number;payloadHash:string};
export type Decision = {id:string;question:string;evidenceIds:string[];options:Option[];recommendedId?:string};
export type Node = {id:string;tool:Tool;areaId?:string;dependencies:string[];owner:Owner;status:Status;version:number;output?:Artifact;checkpoint?:Checkpoint;decision?:Decision;selection?:{decision:Decision;option:Option;actorId:string;atMs:number};lease?:{actorId:string;token:string;expiresAtMs:number;policyVersion:number;jobRevision:number};route?:'stated_quantities'|'digital_takeoff'};
export type Workflow = {scope:JobScope;nodes:Node[];paused:boolean};
export type Context = {actorKind:'user'|'agent';authority:AuthoritySnapshot;policy:AgentPolicy;enabled:boolean;canReview:boolean;canControl:boolean;nowMs:number;trigger:'explicit'|'event'};
const actions:Record<Tool,Action>={documents:'analyze_documents',requirements:'analyze_documents',quantity_route:'prepare_measurements',stated_quantities:'prepare_measurements',digital_takeoff:'prepare_measurements',profile:'prepare_estimate',optimise:'prepare_measurements',price:'prepare_estimate',scope_allowances:'prepare_estimate',quote_draft:'prepare_quote'};
const tools = Object.keys(actions) as Tool[];
const editors:Partial<Record<Tool,Checkpoint['kind']>>={stated_quantities:'measurements',digital_takeoff:'takeoff',optimise:'takeoff',price:'builder',profile:'builder',scope_allowances:'builder'};
function node(w:Workflow,key:string){const n=w.nodes.find(x=>x.id===key);ensure(n,'unknown task');return n;}
function copy(w:Workflow):Workflow {return structuredClone(w);}
function advance(n:Node){n.version=integer(n.version+1,'task version',1);delete n.lease;}
function reset(n:Node){advance(n);n.status='pending';delete n.output;delete n.decision;delete n.selection;delete n.checkpoint;delete n.route;}
function downstream(w:Workflow,key:string){const seen=new Set([key]);let changed=true;while(changed){changed=false;for(const n of w.nodes)if(!seen.has(n.id)&&n.dependencies.some(d=>seen.has(d))){seen.add(n.id);changed=true;}}return w.nodes.filter(n=>n.id!==key&&seen.has(n.id));}
function depsReady(w:Workflow,n:Node){return n.dependencies.every(d=>node(w,d).status==='complete');}
function dependencies(w:Workflow,n:Node){return n.dependencies.map(d=>{const p=node(w,d);return {id:d,version:p.version,output:p.output??null};});}
function guard(w:Workflow,c:Context){parseScope(w.scope);parsePolicy(c.policy);integer(c.nowMs,'trusted time',1);ensure(c.enabled&&c.authority.entitled&&!c.authority.revoked&&!c.authority.demo&&sameScope(w.scope,c.authority.scope)&&c.policy.companyId===w.scope.companyId&&c.policy.version===c.authority.policyVersion,'access or scope');id(c.authority.actorId,'actor');}
function human(w:Workflow,c:Context,control=false){guard(w,c);ensure(c.actorKind==='user'&&(control?c.canControl:c.canReview),'human permission');}
function automatic(w:Workflow,n:Node,c:Context){guard(w,c);ensure(!w.paused&&n.owner==='intelligence','paused or human owned');ensure(admit(c.policy,c.authority,{scope:w.scope,actorId:c.authority.actorId,action:actions[n.tool],policyVersion:c.policy.version,jobRevision:c.authority.jobRevision,trigger:c.trigger}).allowed,'tool admission');}
function expected(n:Node,version:number){ensure(n.version===integer(version,'expected task version',1),'stale task');}
function validateArtifact(w:Workflow,n:Node,a:Artifact){ensure(sameScope(parseScope(a.scope),w.scope)&&a.kind===n.tool,'artifact binding');id(a.recordId,'artifact id');integer(a.version,'artifact version',1);hash(a.contentHash,'artifact hash');}
function validateCheckpoint(w:Workflow,n:Node,p:Checkpoint){ensure(w.scope.kind==='quote'&&sameScope(parseScope(p.scope),w.scope)&&editors[n.tool]===p.kind,'checkpoint binding');id(p.recordId,'checkpoint id');integer(p.version,'checkpoint version',1);hash(p.contentHash,'checkpoint hash');if(p.pageId!==undefined)id(p.pageId,'page');if(p.selectionId!==undefined)id(p.selectionId,'selection');}
function validateDecision(n:Node,d:Decision){id(d.id,'decision');text(d.question,'question');ensure(d.evidenceIds.length<=100&&d.options.length>0&&d.options.length<=8,'decision size');d.evidenceIds.forEach(x=>id(x,'evidence'));unique(d.evidenceIds,x=>x,'evidence ids');unique(d.options,x=>x.id,'option ids');for(const o of d.options){id(o.id,'option');text(o.label,'label');text(o.effect,'effect');id(o.targetId,'target');integer(o.targetVersion,'target version',1);hash(o.payloadHash,'payload');const allowed:Option['action'][]=n.tool==='quantity_route'?['use_stated','use_takeoff','request_clarification']:n.tool==='profile'?['select_library','request_clarification']:n.tool==='scope_allowances'?['resolve_scope','request_clarification']:['stated_quantities','digital_takeoff'].includes(n.tool)?['correct_quantity','request_clarification']:['request_clarification'];ensure(allowed.includes(o.action),'decision action not allowed');}ensure(d.recommendedId===undefined||d.options.some(o=>o.id===d.recommendedId),'recommendation');}
/** Fixed pilot graph, one quantity source per roof area. No model-defined tools,
 * arbitrary dependencies, final quote release or outbound commands. Canonical
 * quote shell must already exist; intake-to-quote mapping belongs to adapter. */
export function plan(scope:JobScope,areas:readonly string[],defaultOwner:Owner='human'):Workflow {
  const s=parseScope(scope);ensure(s.kind==='quote','canonical quote required');ensure(areas.length>0&&areas.length<=30,'area count');areas.forEach(x=>id(x,'area'));unique(areas,x=>x,'areas');ensure(defaultOwner==='human'||defaultOwner==='intelligence','owner');
  const nodes:Node[]=[];const add=(key:string,tool:Tool,dependencies:string[],areaId?:string)=>nodes.push({id:key,tool,dependencies,owner:defaultOwner,status:'pending',version:1,...(areaId?{areaId}:{})});
  add('documents','documents',[]);add('requirements','requirements',['documents']);add('scope','scope_allowances',['requirements']);
  for(const a of areas){const k=(t:string)=>`${a}:${t}`;add(k('route'),'quantity_route',['requirements'],a);add(k('quantity'),'stated_quantities',[k('route')],a);add(k('profile'),'profile',['requirements'],a);add(k('optimise'),'optimise',[k('quantity'),k('profile')],a);add(k('price'),'price',[k('optimise')],a);}
  add('quote','quote_draft',['scope',...areas.map(a=>`${a}:price`)]);return {scope:s,nodes,paused:false};
}
/** Trusted source-route output: neither a numeric fact nor digital geometry is
 * verified by this decision. The selected engine must separately validate it. */
function routeReady(w:Workflow,n:Node){return n.tool!=='stated_quantities'&&n.tool!=='digital_takeoff'||node(w,`${n.areaId}:route`).route===n.tool;}
export function queue(w:Workflow){return w.nodes.map(n=>({id:n.id,tool:n.tool,areaId:n.areaId??null,owner:n.owner,version:n.version,status:n.status,ready:!w.paused&&n.status==='pending'&&depsReady(w,n)&&routeReady(w,n),blockedBy:n.dependencies.filter(d=>node(w,d).status!=='complete'),decision:n.decision??null,checkpoint:n.checkpoint??null}));}
export function assign(w:Workflow,c:Context,key:string,version:number,owner:Owner){human(w,c,true);ensure(owner==='human'||owner==='intelligence','owner');const out=copy(w),n=node(out,key);expected(n,version);if(n.owner!==owner){ensure(n.status!=='complete','completed task; invalidate before reassignment');advance(n);n.owner=owner;if(n.status==='running')n.status='pending';}return out;}
export function pause(w:Workflow,c:Context,paused:boolean){human(w,c,true);ensure(typeof paused==='boolean','pause');const out=copy(w);out.paused=paused;if(paused)for(const n of out.nodes)if(n.status==='running'){advance(n);n.status='pending';}return out;}
export function start(w:Workflow,c:Context,key:string,version:number){const out=copy(w),n=node(out,key);expected(n,version);automatic(out,n,c);ensure(n.status==='pending'&&depsReady(out,n)&&routeReady(out,n),'not runnable');advance(n);n.status='running';const expiresAtMs=integer(c.nowMs+c.policy.maxTaskMs,'expiry',1);const token=digest({scope:out.scope,id:n.id,version:n.version,deps:dependencies(out,n),actorId:c.authority.actorId,policyVersion:c.policy.version,jobRevision:c.authority.jobRevision,expiresAtMs});n.lease={actorId:c.authority.actorId,token,expiresAtMs,policyVersion:c.policy.version,jobRevision:c.authority.jobRevision};return {workflow:out,token};}
function leased(w:Workflow,c:Context,key:string,token:string){const n=node(w,key);automatic(w,n,c);ensure(n.status==='running'&&n.lease?.token===token&&n.lease.actorId===c.authority.actorId&&n.lease.expiresAtMs>c.nowMs&&n.lease.policyVersion===c.policy.version&&n.lease.jobRevision===c.authority.jobRevision&&depsReady(w,n)&&routeReady(w,n),'stale or expired lease');return n;}
export function recover(w:Workflow,c:Context,key:string,version:number){human(w,c,true);const out=copy(w),n=node(out,key);expected(n,version);ensure(n.status==='running'&&n.lease&&n.lease.expiresAtMs<=c.nowMs,'lease not expired');advance(n);n.status='pending';return out;}
export function saveCheckpoint(w:Workflow,c:Context,key:string,token:string,p:Checkpoint){const out=copy(w),n=leased(out,c,key,token);validateCheckpoint(out,n,p);ensure(!n.checkpoint||p.recordId===n.checkpoint.recordId&&(p.version>n.checkpoint.version||p.version===n.checkpoint.version&&p.contentHash===n.checkpoint.contentHash),'checkpoint regression');n.checkpoint=structuredClone(p);return out;}
export function waitForDecision(w:Workflow,c:Context,key:string,token:string,d:Decision){const out=copy(w),n=leased(out,c,key,token);validateDecision(n,d);advance(n);n.status='waiting';n.decision=structuredClone(d);return out;}
export function decisionPreview(w:Workflow,c:Context,key:string){human(w,c);const n=node(w,key);ensure(n.status==='waiting'&&n.decision&&depsReady(w,n),'decision unavailable');return {decision:structuredClone(n.decision),version:n.version,previewDigest:digest({scope:w.scope,actor:c.authority.actorId,policy:c.policy.version,jobRevision:c.authority.jobRevision,nodeId:n.id,version:n.version,decision:n.decision,deps:dependencies(w,n)})};}
/** Records a selected proposal only. The adapter must reload target/version,
 * validate payload hash and execute the approved typed operation atomically
 * using existing engine and approval rules. This does not authorize writes. */
export function selectOption(w:Workflow,c:Context,key:string,version:number,previewDigest:string,optionId:string){const p=decisionPreview(w,c,key);ensure(p.version===version&&p.previewDigest===previewDigest,'stale decision');const option=p.decision.options.find(o=>o.id===optionId);ensure(option,'unknown option');const out=copy(w),n=node(out,key);advance(n);n.selection={decision:p.decision,option,actorId:c.authority.actorId,atMs:c.nowMs};delete n.decision;n.status='pending';return out;}
function finish(w:Workflow,n:Node,a:Artifact,route?:Node['route']){validateArtifact(w,n,a);if(n.tool==='quantity_route'){ensure(route==='stated_quantities'||route==='digital_takeoff','route required');if(n.selection?.option.action==='use_stated')ensure(route==='stated_quantities','selected route mismatch');if(n.selection?.option.action==='use_takeoff')ensure(route==='digital_takeoff','selected route mismatch');ensure(n.selection?.option.action!=='request_clarification','clarification unresolved');const q=node(w,`${n.areaId}:quantity`);q.tool=route;n.route=route;}else ensure(route===undefined,'unexpected route');advance(n);n.status='complete';n.output=structuredClone(a);delete n.decision;delete n.selection;for(const d of downstream(w,n.id))reset(d);return w;}
/** Server adapter must independently validate authoritative output, current
 * evidence, approvals, target versions and actual engine result before calling. */
export function complete(w:Workflow,c:Context,key:string,token:string,a:Artifact,route?:Node['route']){const out=copy(w),n=leased(out,c,key,token);return finish(out,n,a,route);}
/** Called only from an authenticated canonical manual save event. Invalidate
 * affected descendants; never replace another user's in-flight manual edits. */
export function manualComplete(w:Workflow,c:Context,key:string,version:number,a:Artifact,route?:Node['route']){human(w,c);const out=copy(w),n=node(out,key);expected(n,version);ensure(n.owner==='human'&&depsReady(out,n)&&routeReady(out,n)&&n.status!=='running','manual task not ready');return finish(out,n,a,route);}
export function invalidate(w:Workflow,c:Context,key:string,version:number){human(w,c,true);const out=copy(w),n=node(out,key);expected(n,version);reset(n);delete n.route;for(const d of downstream(out,key))reset(d);return out;}
export function manualResume(w:Workflow,c:Context,key:string){human(w,c);const n=node(w,key);ensure(w.scope.kind==='quote'&&n.owner==='human'&&n.checkpoint,'no resume checkpoint');validateCheckpoint(w,n,n.checkpoint);return {quoteId:w.scope.quoteId,editor:n.checkpoint.kind,checkpoint:structuredClone(n.checkpoint),requiresServerHydration:true as const};}
export const registeredTools:readonly Tool[]=Object.freeze(tools);
