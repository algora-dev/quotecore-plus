import {parseScope,sameScope,type JobScope} from '../contracts/evidence';
import {digest} from '../policy/approval';
import {choice,ensure,finite,hash,id,integer,list,record,text,unique} from '../contracts/validation';
import {bool,optionalText} from './profile';
import type {Draft} from './draft';

/** Output of Phase 5 approvedHandoff; still not authorization to save or send. */
export type ReviewedDraft={scope:JobScope;draft:Draft;draftDigest:string;approvedForEditorReview:true;writeAuthorized:false;sendAuthorized:false};
export type EditorLine={id:string;lineType:'component'|'custom';componentId:string|null;scopeRef:{kind:'fact'|'issue';recordId:string;recordVersion:number}|null;text:string;quantityText:string|null;amount:number;showPrice:boolean;showUnits:boolean;isVisible:boolean;includeInTotal:boolean;sortOrder:number};
export type EditorRoundTrip={scope:JobScope;editorRevision:string;draftDigest:string;profileDigest:string;customerId:string;contactId:string;recipientEmail:string;currency:string;lines:EditorLine[];taxLines:Draft['taxLines'];subtotal:number;taxTotal:number;total:number;showMarginInPreview:boolean};
const money=(v:unknown,f:string)=>finite(v,f,0,1e12);
const equal=(a:number,b:number)=>Math.abs(a-b)<=1e-7; // same conservative tolerance as Phase 5
function parseLine(v:unknown,f:string):EditorLine{
 const x=record(v,f,['id','lineType','componentId','scopeRef','text','quantityText','amount','showPrice','showUnits','isVisible','includeInTotal','sortOrder']);
 const lineType=choice(x.lineType,f,['component','custom'] as const),componentId=x.componentId===null?null:id(x.componentId,f);ensure((lineType==='component')===(componentId!==null),'line type and component');
 const ref=x.scopeRef===null?null:record(x.scopeRef,f,['kind','recordId','recordVersion']);
 const scopeRef=ref?{kind:choice(ref.kind,f,['fact','issue'] as const),recordId:id(ref.recordId,f),recordVersion:integer(ref.recordVersion,f,1)}:null;
 ensure(!scopeRef||lineType==='custom','scope copy line type');
 return {id:id(x.id,f),lineType,componentId,scopeRef,text:text(x.text,f),quantityText:x.quantityText===null?null:optionalText(x.quantityText,f,200),amount:money(x.amount,f),showPrice:bool(x.showPrice,f),showUnits:bool(x.showUnits,f),isVisible:bool(x.isVisible,f),includeInTotal:bool(x.includeInTotal,f),sortOrder:integer(x.sortOrder,f)};
}
function parseRoundTrip(raw:unknown,scope:JobScope):EditorRoundTrip{
 const r=record(raw,'editor round trip',['scope','editorRevision','draftDigest','profileDigest','customerId','contactId','recipientEmail','currency','lines','taxLines','subtotal','taxTotal','total','showMarginInPreview']);
 ensure(sameScope(parseScope(r.scope),scope)&&scope.kind==='quote','editor scope');
 const lines=list(r.lines,'editor lines',parseLine,2000);unique(lines,l=>l.id,'duplicate editor line');unique(lines,l=>String(l.sortOrder),'duplicate editor order');
 const taxLines=list(r.taxLines,'tax lines',(v,f)=>{const t=record(v,f,['id','name','rate_percent','amount']);return {id:id(t.id,f),name:text(t.name,f,200),rate_percent:finite(t.rate_percent,f,0,100),amount:money(t.amount,f)};},100);unique(taxLines,t=>t.id,'duplicate taxes');
 return {scope,editorRevision:hash(r.editorRevision,'editor revision'),draftDigest:hash(r.draftDigest,'draft digest'),profileDigest:hash(r.profileDigest,'profile digest'),customerId:id(r.customerId,'customer'),contactId:id(r.contactId,'contact'),recipientEmail:text(r.recipientEmail,'recipient',320),currency:text(r.currency,'currency',3),lines,taxLines,subtotal:money(r.subtotal,'subtotal'),taxTotal:money(r.taxTotal,'tax'),total:money(r.total,'total'),showMarginInPreview:bool(r.showMarginInPreview,'margin visibility')};
}
/** Map the reviewed candidate to a locator for the REAL customer editor. Host
 * must keep candidate private, validate current Phase 5 approval and load exact
 * canonical state. No invented route keys, new quote ID, persistence or pricing. */
export function reviewedEditorHandoff(scopeRaw:JobScope,reviewed:ReviewedDraft){
 const scope=parseScope(scopeRaw);ensure(scope.kind==='quote'&&sameScope(parseScope(reviewed.scope),scope)&&reviewed.draft.profile.companyId===scope.companyId&&reviewed.approvedForEditorReview===true&&reviewed.writeAuthorized===false&&reviewed.sendAuthorized===false&&digest(reviewed.draft)===hash(reviewed.draftDigest,'draft digest'),'reviewed candidate');
 return {scope,quoteId:scope.quoteId,editor:'customer-edit' as const,draft:reviewed.draft,draftDigest:reviewed.draftDigest,requiresCanonicalHydration:true as const,writeAuthorized:false as const,sendAuthorized:false as const};
}
/** Compare the actual post-save, rehydrated canonical editor projection against
 * the Phase 5 reviewed candidate. No parallel calculation or renderer. Adapter
 * must also verify actual public/PDF rendering and all versioned assets; this
 * function alone does NOT attest that those outputs match or authorize release. */
export function checkEditorRoundTrip(scope:JobScope,reviewed:ReviewedDraft,raw:unknown){
 const h=reviewedEditorHandoff(scope,reviewed),d=h.draft,s=parseRoundTrip(raw,h.scope),blockers:string[]=[];
 const add=(ok:unknown,key:string)=>{if(!ok&&!blockers.includes(key))blockers.push(key);};
 add(s.draftDigest===h.draftDigest,'reviewed_draft_changed');
 add(s.profileDigest===digest(d.profile)&&!s.showMarginInPreview,'branding_terms_visibility_changed');
 add(s.customerId===d.customerId&&s.contactId===d.contactId&&s.recipientEmail===d.email&&s.currency===d.currency,'customer_or_currency_changed');
 add(s.lines.length===d.lines.length+d.scopeCopy.length,'line_coverage_changed');
 const componentLines=s.lines.filter(l=>l.lineType==='component'),scopeLines=s.lines.filter(l=>l.lineType==='custom');
 unique(componentLines,l=>l.componentId!,'duplicate component mapping');
 for(const l of d.lines){const actual=componentLines.find(x=>x.componentId===l.componentId);add(actual&&actual.text===l.text&&actual.quantityText===l.quantityText&&equal(actual.amount,l.amount)&&actual.showPrice===l.showPrice&&actual.showUnits===l.showUnits&&actual.isVisible===l.isVisible&&actual.includeInTotal===l.includeInTotal&&actual.sortOrder===l.sortOrder,'component_copy_quantity_amount_or_visibility_changed');}
 for(const c of d.scopeCopy){const matching=scopeLines.filter(x=>x.scopeRef?.kind===c.kind&&x.scopeRef.recordId===c.recordId&&x.scopeRef.recordVersion===c.recordVersion);const a=matching[0];add(matching.length===1&&a.text===c.text&&a.isVisible&&!a.includeInTotal&&!a.showPrice&&!a.showUnits&&a.amount===0&&(a.quantityText===null||a.quantityText===''),'scope_copy_missing_changed_or_priced');}
 add(digest(s.taxLines)===digest(d.taxLines)&&equal(s.subtotal,d.subtotal)&&equal(s.taxTotal,d.taxTotal)&&equal(s.total,d.total),'canonical_totals_or_taxes_changed');
 return {editorRevision:s.editorRevision,draftDigest:h.draftDigest,roundTripHash:digest({scope:h.scope,draftDigest:h.draftDigest,actual:s}),matchesReviewedDraft:blockers.length===0,blockers,sendAuthorized:false as const};
}
