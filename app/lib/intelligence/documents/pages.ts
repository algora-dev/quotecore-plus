import { createHash } from 'node:crypto';
import { MAX_SOURCE_BYTES, parseManifest, type SourceManifest, type JobScope, type SourceDocument, type EvidenceRef } from '../contracts/evidence';
import { ensure, integer, id, text, hash, list, record, finite, unique } from '../contracts/validation';
import { digest } from '../policy/approval';
import { parseCandidates } from '../contracts/brief';

// Pilot defaults, not a production storage/worker configuration. Never raise the existing cap.
export const LIMITS = Object.freeze({ files: 20, packetBytes: 150 * 1024 * 1024, pages: 200, regions: 80, pageTextBytes: 24000, outputTokens: 2000, providerMs: 15000 });
export const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
export type VerifiedDocument = { id: string; revisionId: string; filename: string; bytes: number; contentHash: string; pageCount: number };
/** Only the private storage verifier/parser may supply metadata. Page identity is tied to
 * immutable original bytes + zero-based page index + transform algorithm version, not a raster hash. */
export function createManifest(scope: JobScope, revision: number, docs: readonly VerifiedDocument[]): SourceManifest {
  ensure(docs.length > 0 && docs.length <= LIMITS.files, 'packet file count');
  let bytes = 0, pages = 0;
  const documents: SourceDocument[] = docs.map(d => {
    bytes += integer(d.bytes, 'file bytes', 1, MAX_SOURCE_BYTES);
    pages += integer(d.pageCount, 'page count', 1, LIMITS.pages);
    ensure(bytes <= LIMITS.packetBytes && pages <= LIMITS.pages, 'packet bounds');
    hash(d.contentHash, 'original hash');
    return {...d, status:'active', pages:Array.from({length:d.pageCount}, (_,index)=>({index,contentHash:pageIdentity(d.contentHash,index,1),status:'pending',relevance:'unknown',transformVersion:1}))};
  });
  return parseManifest({scope,revision,documents});
}
export function pageIdentity(originalHash:string,index:number,transformVersion:number) { return digest({originalHash:hash(originalHash,'original hash'),index:integer(index,'page index'),transformVersion:integer(transformVersion,'transform',1)}); }
export function verifyOriginal(bytes:Uint8Array,doc:VerifiedDocument) {
  ensure(bytes.byteLength===doc.bytes && bytes.byteLength<=MAX_SOURCE_BYTES && sha256(bytes)===doc.contentHash,'original bytes/hash');
  // Signature check is only a first filter. Full parser/quarantine validation is still required.
  const b=Buffer.from(bytes.buffer,bytes.byteOffset,Math.min(bytes.byteLength,12));
  ensure(b.subarray(0,5).toString()==='%PDF-' || b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || (b[0]===255&&b[1]===216&&b[2]===255),'unsupported source signature');
}
export type Region = { text:string; box:[number,number,number,number] };
export type PageText = { pageHash:string; transformVersion:number; textOnly:boolean; regions:Region[] };
/** Trusted parser boundary. textOnly must mean visual interpretation is not required;
 * default to false for drawings, scans, unknown layouts and unproven PDF parsers. */
export interface PageReader { read(scope:JobScope,doc:VerifiedDocument,index:number):Promise<PageText> }
export function parsePage(raw:unknown,expectedHash:string,transformVersion:number):PageText {
  const r=record(raw,'page',['pageHash','transformVersion','textOnly','regions']);
  ensure(hash(r.pageHash,'page hash')===expectedHash && integer(r.transformVersion,'transform',1)===transformVersion && typeof r.textOnly==='boolean','page identity');
  const regions=list(r.regions,'regions',(v,f):Region=>{
    const a=record(v,f,['text','box']);const b=list(a.box,f,(x,g)=>finite(x,g,0,1),4);
    ensure(b.length===4&&b[0]<b[2]&&b[1]<b[3],'region extent');
    return {text:text(a.text,f,2000),box:[b[0],b[1],b[2],b[3]]};
  },LIMITS.regions);
  ensure(regions.reduce((n,r)=>n+Buffer.byteLength(r.text,'utf8'),0)<=LIMITS.pageTextBytes,'page text limit');
  return {pageHash:expectedHash,transformVersion,textOnly:r.textOnly,regions};
}
export function buildEvidence(scope:JobScope,revisionId:string,index:number,p:PageText,runId:string):EvidenceRef[] {
  return p.regions.map((r,i)=>({id:'e-'+digest({runId,revisionId,index,i}),scope,documentRevisionId:revisionId,pageIndex:index,pageHash:p.pageHash,transformVersion:p.transformVersion,box:r.box,excerpt:r.text,runId}));
}
export type PageCandidates = ReturnType<typeof parseCandidates> & { relevance:'relevant'|'not_relevant' };
/** Provider may only point to server-created evidence on this page. Never accept provider boxes,
 * approval, tenant fields, coverage, prices or task commands. IDs are namespaced by page/run. */
export function parsePageCandidates(raw:unknown,evidence:readonly EvidenceRef[],namespace:string):PageCandidates {
  const r=record(raw,'page candidates',['relevance','facts','issues']);
  ensure(r.relevance==='relevant'||r.relevance==='not_relevant','page relevance');
  const c=parseCandidates({facts:r.facts,issues:r.issues});
  const known=new Set(evidence.map(e=>e.id));
  ensure([...c.facts,...c.issues].every(x=>x.evidenceIds.length>0&&x.evidenceIds.every(e=>known.has(e))),'page evidence required');
  ensure(r.relevance==='relevant'||(!c.facts.length&&!c.issues.length),'irrelevant candidates');
  const namespaced=(kind:string,x:string)=>kind+'-'+digest({namespace,id:id(x,'candidate id')});
  const facts=c.facts.map(f=>({...f,id:namespaced('f',f.id)}));const issues=c.issues.map(i=>({...i,id:namespaced('i',i.id)}));
  unique([...facts,...issues],x=>x.id,'candidate ids');
  return {relevance:r.relevance,facts,issues};
}
