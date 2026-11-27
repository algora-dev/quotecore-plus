import { createHash } from 'node:crypto';
import { type JobScope, parseScope, sameScope } from '../contracts/evidence';
import { ACTIONS,type Action } from '../contracts/policy';
import { choice,ensure,hash,id,integer,record } from '../contracts/validation';

/** Stable digest of validated JSON. Reject non-JSON values, accessors and unbounded nesting. */
export function canonicalJson(v:unknown,depth=0):string {
  ensure(depth<=32,'payload nesting');
  if(v===null||typeof v==='boolean'||typeof v==='string') return JSON.stringify(v);
  if(typeof v==='number') {ensure(Number.isFinite(v),'payload number');return JSON.stringify(v);}
  if(Array.isArray(v)) {ensure(v.length<=10000,'payload array length');return '['+Array.from(v,x=>canonicalJson(x,depth+1)).join(',')+']';}
  ensure(typeof v==='object'&&v!==null,'JSON payload');
  ensure(Object.getPrototypeOf(v)===Object.prototype||Object.getPrototypeOf(v)===null,'payload object');
  const keys=Object.keys(v).sort();ensure(keys.length<=1000,'payload object size');
  return '{'+keys.map(k=>{const d=Object.getOwnPropertyDescriptor(v,k);ensure(d&&'value' in d,'payload accessor');return JSON.stringify(k)+':'+canonicalJson(d.value,depth+1);}).join(',')+'}';
}
export function digest(v:unknown):string {const s=canonicalJson(v);ensure(s.length<=1_000_000,'payload length');return createHash('sha256').update(s).digest('hex');}
export type ActionBinding={scope:JobScope;action:Action;actorId:string;policyVersion:number;jobRevision:number;inputHash:string;payloadHash:string;idempotencyKey:string};
export function parseBinding(v:unknown):ActionBinding {
  const r=record(v,'binding',['scope','action','actorId','policyVersion','jobRevision','inputHash','payloadHash','idempotencyKey']);
  return {scope:parseScope(r.scope),action:choice(r.action,'action',ACTIONS),actorId:id(r.actorId,'actorId'),policyVersion:integer(r.policyVersion,'policyVersion',1),jobRevision:integer(r.jobRevision,'jobRevision',1),inputHash:hash(r.inputHash,'inputHash'),payloadHash:hash(r.payloadHash,'payloadHash'),idempotencyKey:id(r.idempotencyKey,'idempotencyKey')};
}
export type ApprovalReceipt={id:string;scope:JobScope;bindingHash:string;approvedBy:string;approvedAtMs:number;expiresAtMs:number;state:'active'|'consumed'|'revoked'};
/** No approval is minted here. Load receipt and fresh approver authority on the server.
 * Consumption and action must be atomic/idempotent in 1B, not implemented by this predicate.
 */
export function approvalMatches(receipt:ApprovalReceipt,bindingRaw:unknown,nowMs:number,approverStillAuthorized:boolean):boolean {
  const binding=parseBinding(bindingRaw);integer(nowMs,'nowMs',1);
  return approverStillAuthorized===true&&receipt.state==='active'&&sameScope(receipt.scope,binding.scope)&&
    Number.isSafeInteger(receipt.approvedAtMs)&&Number.isSafeInteger(receipt.expiresAtMs)&&receipt.approvedAtMs>0&&receipt.approvedAtMs<=nowMs&&receipt.expiresAtMs>nowMs&&receipt.bindingHash===digest(binding);
}
