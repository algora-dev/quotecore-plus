import { parseScope,sameScope,type JobScope } from '../contracts/evidence';
import { choice,ensure,finite,hash,id,integer,list,record,text,unique } from '../contracts/validation';
import { computeQuoteTotals,type QuoteComponent } from '../../pricing/engine';
import { computeTaxLines } from '../../taxes/types';
import type { EstimateSnapshot } from '../estimating/snapshot';
import { digest } from '../policy/approval';
import { bool,changedFields,parseProfile,type QuotingProfile } from './profile';
const money=(v:unknown,f:string)=>finite(v,f,0,1e12);
const equal=(a:number,b:number)=>Math.abs(a-b)<=1e-7;
export type CustomerLine={componentId:string;text:string;quantityText:string;amount:number;showPrice:boolean;showUnits:boolean;isVisible:boolean;includeInTotal:boolean;sortOrder:number};
export type CustomerScopeCopy={kind:'fact'|'issue';recordId:string;recordVersion:number;outcome:'included'|'excluded'|'not_applicable'|'resolved';text:string};
export type Draft={profile:QuotingProfile;customerId:string;contactId:string;customerName:string;email:string;currency:string;lines:CustomerLine[];scopeCopy:CustomerScopeCopy[];taxLines:{id:string;name:string;rate_percent:number;amount:number}[];subtotal:number;taxTotal:number;total:number};
export type CustomerSnapshot={scope:JobScope;revision:string;complete:boolean;editable:boolean;recipientVerified:boolean;customerId:string;contactId:string;customerName:string;email:string;currency:string;profile:QuotingProfile;profileApproval:unknown;estimateApproval:{receiptId:string;binding:unknown};lineCopy:{componentId:string;text:string;amount:number}[];scopeCopy:CustomerScopeCopy[];canonicalCustomerSubtotal:number;canonicalCustomerTotal:number;current:Draft|null};
function parseCopy(v:unknown,f:string):CustomerScopeCopy {const x=record(v,f,['kind','recordId','recordVersion','outcome','text']);return {kind:choice(x.kind,f,['fact','issue'] as const),recordId:id(x.recordId,f),recordVersion:integer(x.recordVersion,f,1),outcome:choice(x.outcome,f,['included','excluded','not_applicable','resolved'] as const),text:text(x.text,f,2000)};}
function parseLine(v:unknown,f:string):CustomerLine {const x=record(v,f,['componentId','text','quantityText','amount','showPrice','showUnits','isVisible','includeInTotal','sortOrder']);return {componentId:id(x.componentId,f),text:text(x.text,f),quantityText:text(x.quantityText,f,200),amount:money(x.amount,f),showPrice:bool(x.showPrice,f),showUnits:bool(x.showUnits,f),isVisible:bool(x.isVisible,f),includeInTotal:bool(x.includeInTotal,f),sortOrder:integer(x.sortOrder,f)};}
function email(v:unknown){const s=text(v,'email',320);ensure(/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(s),'single recipient');return s;}
function currency(v:unknown){const s=text(v,'currency',3);ensure(/^[A-Z]{3}$/.test(s),'currency');return s;}
function parseCurrent(v:unknown,companyId:string):Draft {const x=record(v,'current draft',['profile','customerId','contactId','customerName','email','currency','lines','scopeCopy','taxLines','subtotal','taxTotal','total']);return {profile:parseProfile(x.profile,companyId),customerId:id(x.customerId,'customer'),contactId:id(x.contactId,'contact'),customerName:text(x.customerName,'name',200),email:email(x.email),currency:currency(x.currency),lines:list(x.lines,'lines',parseLine,1000),scopeCopy:list(x.scopeCopy,'scope copy',parseCopy,1000),taxLines:list(x.taxLines,'tax lines',(v,f)=>{const t=record(v,f,['id','name','rate_percent','amount']);return {id:id(t.id,f),name:text(t.name,f,200),rate_percent:finite(t.rate_percent,f,0,100),amount:money(t.amount,f)};},100),subtotal:money(x.subtotal,'subtotal'),taxTotal:money(x.taxTotal,'tax'),total:money(x.total,'total')};}
export function parseCustomerSnapshot(raw:unknown,scope:JobScope):CustomerSnapshot {
 const r=record(raw,'customer snapshot',['scope','revision','complete','editable','recipientVerified','customerId','contactId','customerName','email','currency','profile','profileApproval','estimateApproval','lineCopy','scopeCopy','canonicalCustomerSubtotal','canonicalCustomerTotal','current']);
 ensure(sameScope(parseScope(r.scope),scope),'customer snapshot scope');
 const a=record(r.estimateApproval,'estimate approval',['receiptId','binding']);
 const lineCopy=list(r.lineCopy,'line copy',(v,f)=>{const x=record(v,f,['componentId','text','amount']);return {componentId:id(x.componentId,f),text:text(x.text,f),amount:money(x.amount,f)};},1000);
 const scopeCopy=list(r.scopeCopy,'scope copy',parseCopy,1000);
 unique(lineCopy,x=>x.componentId,'duplicate customer line');unique(scopeCopy,x=>x.kind+':'+x.recordId,'duplicate scope copy');
 const current=r.current===null?null:parseCurrent(r.current,scope.companyId);if(current){unique(current.lines,x=>x.componentId,'duplicate saved customer line');unique(current.scopeCopy,x=>x.kind+':'+x.recordId,'duplicate saved scope');unique(current.taxLines,x=>x.id,'duplicate saved tax');}
 return {scope,revision:hash(r.revision,'customer revision'),complete:bool(r.complete,'complete'),editable:bool(r.editable,'editable'),recipientVerified:bool(r.recipientVerified,'recipient verified'),customerId:id(r.customerId,'customer'),contactId:id(r.contactId,'contact'),customerName:text(r.customerName,'customer name',200),email:email(r.email),currency:currency(r.currency),profile:parseProfile(r.profile,scope.companyId),profileApproval:r.profileApproval,estimateApproval:{receiptId:id(a.receiptId,'receipt'),binding:a.binding},lineCopy,scopeCopy,canonicalCustomerSubtotal:money(r.canonicalCustomerSubtotal,'canonical customer subtotal'),canonicalCustomerTotal:money(r.canonicalCustomerTotal,'canonical customer total'),current};
}
/** First slice: exactly one visible customer line per verified estimate line.
 * Copy is explicit editor input, never generated from private findings/reasons.
 * No grouping, discounts, suppressed totals, or implicit rounding assumptions. */
export function buildDraft(s:EstimateSnapshot,c:CustomerSnapshot){
 const blockers:string[]=[];const add=(x:string)=>{if(!blockers.includes(x))blockers.push(x);};
 if(!c.complete||!c.editable)add('customer_snapshot_incomplete_or_locked');
 if(!c.recipientVerified)add('recipient_unverified');
 if(s.currency!==c.currency)add('currency_mismatch');
 if(c.profile.hideTotals)add('hidden_total_unsupported');
 if(s.lines.length!==c.lineCopy.length)add('customer_line_coverage');
 const lines:CustomerLine[]=[];
 for(const l of s.lines){const copy=c.lineCopy.find(x=>x.componentId===l.id);if(!copy){add('customer_line_coverage');continue;}
  if(l.materialCost===null||l.labourCost===null){add('unpriced_line');continue;}
  const amount=computeQuoteTotals([{materialCost:l.materialCost,labourCost:l.labourCost}] as QuoteComponent[],{materialMarginPct:s.materialMarginPct,labourMarginPct:s.labourMarginPct,taxRate:0}).subtotalWithMargins;
  if(!equal(amount,copy.amount))add('customer_line_amount_mismatch');
  lines.push({componentId:l.id,text:copy.text,quantityText:`${l.quantity} ${l.pricingUnit}`,amount:copy.amount,showPrice:!c.profile.hideLinePrices,showUnits:c.profile.showQuantityColumn,isVisible:true,includeInTotal:true,sortOrder:lines.length});
 }
 if(c.scopeCopy.length!==s.dispositions.length||s.dispositions.some(d=>!c.scopeCopy.some(x=>x.kind===d.kind&&x.recordId===d.recordId&&x.recordVersion===d.recordVersion&&x.outcome===d.outcome)))add('scope_copy_missing_or_stale');
 const subtotal=lines.reduce((n,l)=>n+l.amount,0),tax=computeTaxLines(s.taxes,subtotal,'quote'),taxTotal=tax.total,total=subtotal+taxTotal;
 if(!equal(subtotal,c.canonicalCustomerSubtotal)||!equal(total,c.canonicalCustomerTotal)||s.canonicalBuilderTotal===null||!equal(total,s.canonicalBuilderTotal))add('customer_total_mismatch');
 const draft:Draft={profile:c.profile,customerId:c.customerId,contactId:c.contactId,customerName:c.customerName,email:c.email,currency:c.currency,lines,scopeCopy:c.scopeCopy,taxLines:tax.lines,subtotal,taxTotal,total};
 const previousLines=c.current?.lines??[];
 const lineChanges=[...lines.map(l=>{const old=previousLines.find(x=>x.componentId===l.componentId);return {componentId:l.componentId,kind:old?'changed' as const:'added' as const,fields:changedFields(old??null,l)};}).filter(x=>x.fields.length),...previousLines.filter(l=>!lines.some(x=>x.componentId===l.componentId)).map(l=>({componentId:l.componentId,kind:'removed' as const,fields:[] as string[]}))];
 return {draft,blockers,changedFields:changedFields(c.current,draft),lineChanges,previousTotal:c.current?.total??null,draftDigest:digest(draft)};
}
