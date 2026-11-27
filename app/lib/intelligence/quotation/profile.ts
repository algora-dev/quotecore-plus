import { ensure, id, integer, record, text, hash } from '../contracts/validation';
import { digest } from '../policy/approval';

export function bool(v:unknown,f:string):boolean {ensure(typeof v==='boolean',f);return v;}
export function optionalText(v:unknown,f:string,max=8000):string {return v===''?'':text(v,f,max);}
export type QuotingProfile={companyId:string;templateId:string;version:number;name:string;description:string;companyName:string;companyAddress:string;companyPhone:string;companyEmail:string;companyLogoUrl:string;footerText:string;showQuantityColumn:boolean;hideLinePrices:boolean;hideTotals:boolean};
/** Server-authorized projection of an existing customer quote template and its
 * approved quoting preferences. No independent template store or legal copy generation. */
export function parseProfile(raw:unknown,companyId:string):QuotingProfile {
 const r=record(raw,'profile',['companyId','templateId','version','name','description','companyName','companyAddress','companyPhone','companyEmail','companyLogoUrl','footerText','showQuantityColumn','hideLinePrices','hideTotals']);
 ensure(id(r.companyId,'company')===companyId,'profile scope');
 const logo=optionalText(r.companyLogoUrl,'logo',2000);
 // Rendering/download authorization still belongs to the existing editor.
 ensure(!logo||/^https:\/\/[^\s]+$/i.test(logo),'logo URL');
 return {companyId,templateId:id(r.templateId,'template'),version:integer(r.version,'version',1),name:text(r.name,'name',200),description:optionalText(r.description,'description',1000),companyName:text(r.companyName,'company name',200),companyAddress:optionalText(r.companyAddress,'address',1000),companyPhone:optionalText(r.companyPhone,'phone',100),companyEmail:optionalText(r.companyEmail,'email',320),companyLogoUrl:logo,footerText:optionalText(r.footerText,'footer'),showQuantityColumn:bool(r.showQuantityColumn,'quantity visibility'),hideLinePrices:bool(r.hideLinePrices,'price visibility'),hideTotals:bool(r.hideTotals,'total visibility')};
}
export function changedFields<T extends object>(before:T|null,after:T):string[] {
 return Object.keys(after).filter(k=>!before||digest((before as Record<string,unknown>)[k])!==digest((after as Record<string,unknown>)[k])).sort();
}
/** Editable proposal only; approval must occur in the existing template editor.
 * Does not activate memory, save a template or silently apply company defaults. */
export function proposeProfile(companyId:string,previous:unknown|null,proposed:unknown){
 const old=previous===null?null:parseProfile(previous,companyId),next=parseProfile(proposed,companyId);
 ensure(old?old.templateId===next.templateId&&next.version===old.version+1:next.version===1,'profile revision');
 return {previous:old,proposed:next,changedFields:changedFields(old,next),proposalDigest:digest({old,next}),requiresHumanApproval:true as const,writeAuthorized:false as const};
}
export function profileApproved(profile:QuotingProfile,raw:unknown,now:number,authorized:(id:string)=>boolean):boolean {
 if(raw===null)return false;
 const r=record(raw,'profile approval',['actorId','atMs','profileDigest']);
 return hash(r.profileDigest,'profile digest')===digest(profile)&&integer(r.atMs,'approved time',1)<=now&&authorized(id(r.actorId,'approver'));
}
