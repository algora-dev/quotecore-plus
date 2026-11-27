import { choice, ensure, id, ids, integer, record, text } from './validation';
/** Learning proposals are not instructions. Company / user / job are separately authorized scopes. */
export type MemoryScope={kind:'company';companyId:string}|{kind:'user';companyId:string;userId:string}|{kind:'job';companyId:string;quoteId:string};
export type MemoryRecord={id:string;scope:MemoryScope;kind:'fact'|'preference'|'mapping'|'rule'|'product';subject:string;content:string;sourceIds:string[];version:number;state:'proposed'|'active'|'rejected'|'superseded'|'revoked';approval?:{actorId:string;version:number;atMs:number};expiresAtMs?:number};
export function parseMemory(raw:unknown):MemoryRecord {
  const r=record(raw,'memory',['id','scope','kind','subject','content','sourceIds','version','state','approval','expiresAtMs']);
  const s=record(r.scope,'memory.scope',['kind','companyId','userId','quoteId']);
  const kind=choice(s.kind,'scope.kind',['company','user','job'] as const);const companyId=id(s.companyId,'companyId');
  ensure((kind==='user')===(s.userId!==undefined)&&(kind==='job')===(s.quoteId!==undefined),'memory scope');
  const scope:MemoryScope=kind==='company'?{kind,companyId}:kind==='user'?{kind,companyId,userId:id(s.userId,'userId')}:{kind,companyId,quoteId:id(s.quoteId,'quoteId')};
  const state=choice(r.state,'state',['proposed','active','rejected','superseded','revoked'] as const);const version=integer(r.version,'version',1);
  const a=r.approval===undefined?undefined:record(r.approval,'approval',['actorId','version','atMs']);
  const approval=a?{actorId:id(a.actorId,'actorId'),version:integer(a.version,'approval.version',1),atMs:integer(a.atMs,'atMs',1)}:undefined;
  ensure(state!=='active'||approval?.version===version,'active memory approval');
  const sourceIds=ids(r.sourceIds,'sourceIds');ensure(sourceIds.length>0,'memory sources');
  const expiresAtMs=r.expiresAtMs===undefined?undefined:integer(r.expiresAtMs,'expiresAtMs',1);
  return {id:id(r.id,'id'),scope,kind:choice(r.kind,'kind',['fact','preference','mapping','rule','product'] as const),subject:text(r.subject,'subject',200),content:text(r.content,'content',8000),sourceIds,version,state,...(approval?{approval}:{}),...(expiresAtMs!==undefined?{expiresAtMs}:{})};
}
/** Filter a server-authorized result set; not a replacement for RLS or permission checks. */
export function activeMemory(raw:unknown,context:{companyId:string;userId:string;quoteId?:string;nowMs:number}):boolean {
  const m=parseMemory(raw);
  return m.state==='active'&&!!m.approval&&m.approval.atMs<=context.nowMs&&m.scope.companyId===context.companyId&&(!m.expiresAtMs||m.expiresAtMs>context.nowMs)&&
    (m.scope.kind==='company'||(m.scope.kind==='user'?m.scope.userId===context.userId:m.scope.quoteId===context.quoteId));
}
