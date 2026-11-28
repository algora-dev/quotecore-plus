import { MAX_SOURCE_BYTES, type JobScope } from '../contracts/evidence';
import { ensure, choice, hash, id, integer, list, record, text, unique } from '../contracts/validation';
import { LIMITS, type VerifiedDocument } from '../documents/pages';
import { digest } from '../policy/approval';

export type Attachment = { id:string; filename:string; bytes:number; contentHash:string; mediaType:string };
export type Envelope = { providerMessageId:string; messageId:string|null; threadId:string|null; sender:string; senderAuthenticated:boolean; forwarded:boolean; subject:string; bodyText:string; receivedAtMs:number; attachments:Attachment[] };
export type MailRoute = { id:string; companyId:string; mailboxId:string; enabled:boolean; verified:boolean; version:number; allowedSenders:string[] };
export type Scan = { attachmentId:string; contentHash:string; bytes:number; result:'clean'|'blocked'; document?:VerifiedDocument };
export type Intake = { id:string; envelope:Envelope; envelopeHash:string; routeVersion:number; version:number; flags:string[]; scans:Scan[]; review?:{actorId:string; atMs:number; scope:JobScope; note:string; deadlineMs:number|null}; intent?:AnalysisIntent };
export type AnalysisIntent = { id:string; intakeId:string; intakeVersion:number; routeVersion:number; scope:JobScope; jobRevision:number; inputHash:string; manifestHash:string; policyVersion:number; grantId:string; grantVersion:number; workerId:string; createdAtMs:number; deadlineMs:number };
export function mailbox(v:unknown,f:string):string {
 const s=text(v,f,254); ensure(/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/.test(s)&&!s.includes('..'),f);
 const i=s.lastIndexOf('@');return s.slice(0,i)+s.slice(i).toLowerCase();
}
const flag=(v:unknown,f:string)=>{ensure(typeof v==='boolean',f);return v;};
const optionalText=(v:unknown,f:string,max:number)=>v===''?'':text(v,f,max);
export function parseEnvelope(raw:unknown):Envelope {
 const r=record(raw,'envelope',['providerMessageId','messageId','threadId','sender','senderAuthenticated','forwarded','subject','bodyText','receivedAtMs','attachments']);
 const attachments=list(r.attachments,'attachments',(v,f):Attachment=>{const a=record(v,f,['id','filename','bytes','contentHash','mediaType']);return {id:id(a.id,f),filename:text(a.filename,f,512),bytes:integer(a.bytes,f,1,MAX_SOURCE_BYTES),contentHash:hash(a.contentHash,f),mediaType:text(a.mediaType,f,100)};},LIMITS.files);
 unique(attachments,a=>a.id,'attachment id');ensure(attachments.reduce((n,a)=>n+a.bytes,0)<=LIMITS.packetBytes,'packet bytes');
 const bodyText=optionalText(r.bodyText,'body',32000);ensure(Buffer.byteLength(bodyText,'utf8')<=64000,'body bytes');
 return {providerMessageId:id(r.providerMessageId,'provider message'),messageId:r.messageId===null?null:text(r.messageId,'message id',512),threadId:r.threadId===null?null:id(r.threadId,'thread'),sender:mailbox(r.sender,'sender'),senderAuthenticated:flag(r.senderAuthenticated,'sender authentication'),forwarded:flag(r.forwarded,'forwarded'),subject:optionalText(r.subject,'subject',512),bodyText,receivedAtMs:integer(r.receivedAtMs,'received time',1),attachments};
}
export function parseScan(raw:unknown,a:Attachment):Scan {
 const r=record(raw,'scan',['attachmentId','contentHash','bytes','result','document']);
 ensure(r.attachmentId===a.id&&r.contentHash===a.contentHash&&r.bytes===a.bytes,'scan binding');const result=choice(r.result,'scan result',['clean','blocked'] as const);
 if(result==='blocked'){ensure(r.document===undefined,'blocked document');return {attachmentId:a.id,contentHash:a.contentHash,bytes:a.bytes,result};}
 ensure(['application/pdf','image/png','image/jpeg'].includes(a.mediaType),'unsupported document type');
 const d=record(r.document,'verified document',['id','revisionId','filename','bytes','contentHash','pageCount']);
 ensure(d.contentHash===a.contentHash&&d.bytes===a.bytes&&d.filename===a.filename,'verified attachment identity');
 return {attachmentId:a.id,contentHash:a.contentHash,bytes:a.bytes,result,document:{id:id(d.id,'document id'),revisionId:id(d.revisionId,'document revision'),filename:a.filename,bytes:a.bytes,contentHash:a.contentHash,pageCount:integer(d.pageCount,'pages',1,LIMITS.pages)}};
}
/** Excludes transport ID/time for detection of repeat delivery. Does not establish sender identity. */
export const envelopeDigest=(e:Envelope)=>digest({messageId:e.messageId,threadId:e.threadId,sender:e.sender,senderAuthenticated:e.senderAuthenticated,forwarded:e.forwarded,subject:e.subject,bodyText:e.bodyText,attachments:e.attachments});
export const attachmentHashes=(e:Envelope)=>[...new Set(e.attachments.map(a=>a.contentHash))].sort();
