import { restoreDraft, blankDraft, DOCUMENT_ROUTES, kindForPath, type DocumentDraft, type DocumentKind } from './document-model';
/** Explicit, temporary, device-local rescue across OAuth and email verification.
 * No token/password and no draft in the URL. Never uploads the quote. */
const PREFIX='qc:document-auth-resume:v2:';
const TTL=60*60*1000;
export interface ResumeAssist {mode:'text'|'image';text:string;image:string;filename:string;}
export interface AuthResume {
  version:2; id:string; expiresAt:number; path:string; draft:DocumentDraft;
  step:0|1|2; generated:boolean; marketingConsent:boolean; intendedEmail:string|null; assist?:ResumeAssist; reopenAssist?:boolean;
}
export function validResumeId(id:string|null):id is string {return !!id && /^[a-f0-9-]{32,64}$/.test(id);}
export function sweepAuthResumes(storage:Storage,now=Date.now()) {
  for(let i=storage.length-1;i>=0;i--){const key=storage.key(i);if(!key?.startsWith(PREFIX))continue;
    try{const value=JSON.parse(storage.getItem(key)||'null');if(!value||!Number.isFinite(value.expiresAt)||value.expiresAt<=now)storage.removeItem(key);}catch{storage.removeItem(key);}}
}
export function saveAuthResume(draft:DocumentDraft,step:0|1|2,generated:boolean,marketingConsent:boolean,intendedEmail:string|null,assist?:ResumeAssist,reopenAssist=false):{id:string;available:boolean} {
  const bytes=crypto.getRandomValues(new Uint8Array(16));const id=Array.from(bytes,n=>n.toString(16).padStart(2,'0')).join('');
  try {sweepAuthResumes(localStorage);const record:AuthResume={version:2,id,expiresAt:Date.now()+TTL,path:DOCUMENT_ROUTES[draft.kind??'quote'],draft,step,generated,marketingConsent,intendedEmail,assist,reopenAssist};
    localStorage.setItem(PREFIX+id,JSON.stringify(record));return {id,available:true};
  } catch {return {id,available:false};}
}
export function readAuthResume(id:string|null,storage?:Storage,now=Date.now(),expectedPath?:string):AuthResume|null {
  if(!validResumeId(id))return null;
  try {const store=storage??localStorage;const value=JSON.parse(store.getItem(PREFIX+id)||'null');
    if(!value||value.version!==2||value.id!==id||!kindForPath(value.path)||!Number.isFinite(value.expiresAt)||value.expiresAt<=now||value.expiresAt>now+TTL+60000){store.removeItem(PREFIX+id);return null;}
    if(expectedPath&&value.path!==expectedPath)return null;
    const kind=kindForPath(value.path)!;
    const draft=restoreDraft(value.draft,blankDraft('', '',kind));if(!draft)return null;
    const a=value.assist;
    const assist:ResumeAssist|undefined=a&&['text','image'].includes(a.mode)?{mode:a.mode,text:typeof a.text==='string'?a.text.slice(0,20000):'',image:typeof a.image==='string'&&/^data:image\/(jpeg|png|webp);base64,/.test(a.image)&&a.image.length<6000000?a.image:'',filename:typeof a.filename==='string'?a.filename.slice(0,255):''}:undefined;
    return {version:2,id,expiresAt:value.expiresAt,path:value.path,draft,assist,reopenAssist:value.reopenAssist===true,step:[0,1,2].includes(value.step)?value.step:0,generated:value.generated===true,marketingConsent:value.marketingConsent===true,
      intendedEmail:typeof value.intendedEmail==='string'?value.intendedEmail.toLowerCase():null};
  }catch{return null;}
}
export function clearAuthResume(id:string|null){if(!validResumeId(id))return;try{localStorage.removeItem(PREFIX+id);}catch{/* no account or draft upload */}}
export function authReturnUrl(id:string,kind:DocumentKind='quote'){return `${window.location.origin}/api/free-tools/auth/callback?resume=${encodeURIComponent(id)}&document=${encodeURIComponent(kind)}`;}

/** UI identities may be regenerated when reading legacy drafts. Compare content. */
export function sameQuote(a:DocumentDraft,b:DocumentDraft):boolean {
  const signature=(d:DocumentDraft)=>JSON.stringify({...d,lines:d.lines.map(({id,...line})=>line)});
  return signature(a)===signature(b);
}
