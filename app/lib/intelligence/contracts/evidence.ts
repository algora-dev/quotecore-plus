import { choice, ensure, finite, hash, id, integer, list, record, text, unique } from './validation';

export const MAX_SOURCE_BYTES = 50 * 1024 * 1024; // existing signed-upload cap; storage checks still required
export type JobScope = { companyId: string } & ({ kind: 'quote'; quoteId: string } | { kind: 'intake'; intakeId: string });
export function parseScope(v: unknown): JobScope {
  const r = record(v, 'scope', ['companyId','kind','quoteId','intakeId']);
  const companyId = id(r.companyId,'companyId');
  const kind = choice(r.kind,'scope.kind',['quote','intake'] as const);
  if (kind === 'quote') { ensure(r.intakeId === undefined,'scope.intakeId'); return {companyId,kind,quoteId:id(r.quoteId,'quoteId')}; }
  ensure(r.quoteId === undefined,'scope.quoteId'); return {companyId,kind,intakeId:id(r.intakeId,'intakeId')};
}
export function sameScope(a: JobScope,b:JobScope): boolean {
  return a.companyId===b.companyId && (a.kind==='quote' ? b.kind==='quote' && a.quoteId===b.quoteId : b.kind==='intake' && a.intakeId===b.intakeId);
}
export type PageStatus = 'pending'|'screened'|'analyzed'|'failed';
export type SourcePage = { index:number; contentHash:string; status:PageStatus; relevance:'unknown'|'relevant'|'not_relevant'; transformVersion:number };
export type SourceDocument = { id:string; revisionId:string; contentHash:string; filename:string; bytes:number; pageCount:number; status:'active'|'superseded'|'deleted'; pages:SourcePage[] };
export type SourceManifest = { scope:JobScope; revision:number; documents:SourceDocument[] };
export function parseManifest(v:unknown): SourceManifest {
  const r=record(v,'manifest',['scope','revision','documents']);
  const documents=list(r.documents,'documents',(x,f):SourceDocument=>{
    const d=record(x,f,['id','revisionId','contentHash','filename','bytes','pageCount','status','pages']);
    const pageCount=integer(d.pageCount,`${f}.pageCount`,1,10000);
    const pages=list(d.pages,`${f}.pages`,(y,g):SourcePage=>{
      const p=record(y,g,['index','contentHash','status','relevance','transformVersion']);
      const status=choice(p.status,g,['pending','screened','analyzed','failed'] as const);
      const relevance=choice(p.relevance,g,['unknown','relevant','not_relevant'] as const);
      ensure(status!=='analyzed' || relevance!=='unknown',`${g}.relevance`);
      return {index:integer(p.index,g,0,pageCount-1),contentHash:hash(p.contentHash,g),status,relevance,transformVersion:integer(p.transformVersion,g,1)};
    },10000);
    unique(pages,p=>String(p.index),`${f}.pages`);
    return {id:id(d.id,f),revisionId:id(d.revisionId,f),contentHash:hash(d.contentHash,f),filename:text(d.filename,f,512),bytes:integer(d.bytes,f,1,MAX_SOURCE_BYTES),pageCount,status:choice(d.status,f,['active','superseded','deleted'] as const),pages};
  },100);
  unique(documents,d=>d.revisionId,'document revision IDs');
  unique(documents.filter(d=>d.status==='active'),d=>d.id,'active document IDs');
  unique(documents.filter(d=>d.status==='active'),d=>d.contentHash,'active document content hashes');
  return {scope:parseScope(r.scope),revision:integer(r.revision,'revision',1),documents};
}
/** Coordinates are normalized to the displayed, rotated page, with a versioned transform. */
export type EvidenceRef = { id:string; scope:JobScope; documentRevisionId:string; pageIndex:number; pageHash:string; transformVersion:number; box:[number,number,number,number]; excerpt:string; runId:string };
export function parseEvidence(v:unknown):EvidenceRef {
  const r=record(v,'evidence',['id','scope','documentRevisionId','pageIndex','pageHash','transformVersion','box','excerpt','runId']);
  const b=list(r.box,'box',(x,f)=>finite(x,f,0,1),4); ensure(b.length===4 && b[0]<b[2] && b[1]<b[3],'box extent');
  return {id:id(r.id,'evidence.id'),scope:parseScope(r.scope),documentRevisionId:id(r.documentRevisionId,'documentRevisionId'),pageIndex:integer(r.pageIndex,'pageIndex'),pageHash:hash(r.pageHash,'pageHash'),transformVersion:integer(r.transformVersion,'transformVersion',1),box:[b[0],b[1],b[2],b[3]],excerpt:text(r.excerpt,'excerpt'),runId:id(r.runId,'runId')};
}
export function evidenceIsCurrent(e:EvidenceRef,m:SourceManifest):boolean {
  if(!sameScope(e.scope,m.scope)) return false;
  const d=m.documents.find(x=>x.revisionId===e.documentRevisionId && x.status==='active');
  const p=d?.pages.find(x=>x.index===e.pageIndex);
  return !!p && p.status==='analyzed' && p.contentHash===e.pageHash && p.transformVersion===e.transformVersion;
}
