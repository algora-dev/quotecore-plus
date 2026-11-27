import { assessBrief, reviewIsCurrent } from '../brief/readiness';
import type { JobFact, Quantity } from '../contracts/brief';
import { evidenceIsCurrent, type EvidenceRef } from '../contracts/evidence';
import { parseDistanceSuggestion } from '../../takeoff/calibrationCandidates';

/** Structural projection of measurements-import/domain.ts MeasurementLine.
 * The actual measurementLineSchema and live library guard MUST run at the
 * future admission boundary. No insert or confirm call is made here. */
export type DraftLine = {
  label:string;unit:string;unitGuessed:false;kind:'area'|'lineal'|'quantity';entries:{value:number}[];
  matchedComponentId:null;matchedName:null;matchConfidence:'none';matchOrigin:'auto';
  basisOverride:'plan'|'actual';combineEntries:false;split:null;warnings:string[];
};
const units:Readonly<Record<string,{kind:DraftLine['kind'];display:string;aliases:readonly string[]}>>=Object.freeze({
  m:{kind:'lineal',display:'m',aliases:['m','lm','metre','metres','meter','meters']},
  mm:{kind:'lineal',display:'mm',aliases:['mm','millimetres','millimeters']},
  cm:{kind:'lineal',display:'cm',aliases:['cm','centimetres','centimeters']},
  ft:{kind:'lineal',display:'ft',aliases:['ft','feet','foot',"'"]},
  in:{kind:'lineal',display:'in',aliases:['in','inch','inches','"']},
  yd:{kind:'lineal',display:'yd',aliases:['yd','yard','yards']},
  m2:{kind:'area',display:'m²',aliases:['m2','m²','m^2','sq m','square metres','square meters']},
  ft2:{kind:'area',display:'ft²',aliases:['ft2','ft²','ft^2','sq ft','square feet']},
  yd2:{kind:'area',display:'yd²',aliases:['yd2','yd²','yd^2','sq yd','square yards']},
  roof_square:{kind:'area',display:'RS',aliases:['rs','roofing square','roofing squares']},
  count:{kind:'quantity',display:'ea',aliases:['ea','each','count','pcs','pieces','units','items','qty']},
});
const norm=(s:string)=>s.trim().replace(/\s+/g,' ').toLowerCase();
const cmp=(a:string,b:string)=>a<b?-1:a>b?1:0;
const hasLiteral=(e:EvidenceRef,s:string)=>{
  const needle=norm(s),hay=norm(e.excerpt);let start=0;
  for(;;){const at=hay.indexOf(needle,start);if(at<0)return false;
    // Prevent matching 20 m2 inside 120 m2, 0.20 m2, or a longer unit.
    const before=hay[at-1]??'',after=hay[at+needle.length]??'';
    if(!/[a-z0-9.,+\-]/.test(before)&&!/[a-z0-9²³]/.test(after))return true;
    start=at+1;
  }
};
function scalar(q:Quantity){
  const u=Object.hasOwn(units,q.unit)?units[q.unit]:undefined;
  if(!u||q.sourceUnit===null||!u.aliases.includes(norm(q.sourceUnit))||q.value<=0) return null;
  if(u.kind==='quantity'?q.basis!=='count':!['plan','surface'].includes(q.basis))return null;
  // A narrow, anchored scalar reading. Never reinterpret N x M, ranges,
  // localized decimals, fractions, dimensions or mixed units as a total.
  const m=/^(\d+(?:\.\d+)?)\s*(\S.*?)$/.exec(norm(q.sourceText));
  if(!m||Number(m[1])!==q.value||!u.aliases.includes(m[2]))return null;
  return u;
}
export type QuantityHold={factId:string;reason:'not_explicit'|'unsupported_or_ambiguous_scalar'|'source_text_not_found'|'dimension_not_quantity'|'label_limit'|'shared_quantity_evidence'|'possible_duplicate_quantity'};
export type QuantityDraft={factId:string;factVersion:number;source:Quantity;evidence:EvidenceRef[];status:'candidate';line:DraftLine};
export type CalibrationHint={factId:string;factVersion:number;evidence:EvidenceRef;distance:number;unit:string;sourceText:string;requiresEndpointReview:true};
const dimension=(f:JobFact)=>/\b(?:calibration|dimension|scale reference)\b/i.test(f.title);
/** Pure read-only projection; even a fully reviewed brief never authorizes a write. */
export function prepareMeasurements(raw:unknown){
  const {brief,ready,blockers}=assessBrief(raw);
  const evidenceById=new Map(brief.evidence.filter(e=>evidenceIsCurrent(e,brief.manifest)).map(e=>[e.id,e]));
  const confirmed=brief.facts.filter(f=>f.state==='confirmed'&&reviewIsCurrent(f.review,f.version,brief.manifest.revision)&&f.evidenceIds.every(e=>evidenceById.has(e)));
  const ev=(f:JobFact)=>f.evidenceIds.map(id=>evidenceById.get(id)!);
  const pitchContext=confirmed.filter(f=>f.category==='pitch').map(f=>({factId:f.id,factVersion:f.version,title:f.title,finding:f.finding,quantity:f.quantity??null,evidence:ev(f)}));
  const candidates:QuantityDraft[]=[],held:QuantityHold[]=[],calibrationHints:CalibrationHint[]=[];
  const quantities=confirmed.filter(f=>f.category==='quantity'&&f.quantity);
  if(ready)for(const f of quantities){
    const q=f.quantity!,es=ev(f),hold=(reason:QuantityHold['reason'])=>held.push({factId:f.id,reason});
    if(f.basis!=='explicit'){hold('not_explicit');continue;}
    if(dimension(f)){
      const parsed=parseDistanceSuggestion(q.sourceText,q.sourceUnit);
      const written=parseDistanceSuggestion(q.sourceText,null);
      if(q.sourceUnit!==null&&parsed&&written&&written.unit===parsed.unit&&written.distance===parsed.distance&&parsed.distance>0&&parsed.distance===q.value&&parsed.unit===q.unit&&q.basis==='plan')for(const e of es.filter(e=>hasLiteral(e,q.sourceText)))calibrationHints.push({factId:f.id,factVersion:f.version,evidence:e,distance:parsed.distance,unit:parsed.unit,sourceText:q.sourceText,requiresEndpointReview:true});
      hold('dimension_not_quantity');continue;
    }
    const u=scalar(q);if(!u){hold('unsupported_or_ambiguous_scalar');continue;}
    if(!es.some(e=>hasLiteral(e,q.sourceText))){hold('source_text_not_found');continue;}
    if(es.some(e=>/\d\s*(?:[x×*]|\bat\b|@|[-–])\s*\d/i.test(e.excerpt))){hold('unsupported_or_ambiguous_scalar');continue;}
    if(f.title.trim().length>180){hold('label_limit');continue;}
    if(quantities.some(g=>g.id!==f.id&&g.evidenceIds.some(id=>f.evidenceIds.includes(id)))){hold('shared_quantity_evidence');continue;}
    // Conservative cross-document duplicate check even if issues were closed.
    // User can use the legacy review flow to distinguish identical readings.
    if(quantities.some(g=>g.id!==f.id&&g.quantity!.value===q.value&&g.quantity!.unit===q.unit&&g.quantity!.basis===q.basis)){hold('possible_duplicate_quantity');continue;}
    // No global roof pitch is silently assigned. The existing component can
    // apply default pitch; explicitly require review for plan-based readings.
    const warnings=['Intelligence proposal only; verify scope, source and component before selecting.'];
    if(q.basis==='plan')warnings.push('Plan quantity: verify component pitch and calculation settings; no pitch was applied.');
    if(q.basis==='count')warnings.push('Count basis preserved in source metadata; verify component uses count without pitch or waste conversion.');
    candidates.push({factId:f.id,factVersion:f.version,source:q,evidence:es,status:'candidate',line:{label:f.title.trim(),unit:u.display,unitGuessed:false,kind:u.kind,entries:[{value:q.value}],matchedComponentId:null,matchedName:null,matchConfidence:'none',matchOrigin:'auto',basisOverride:q.basis==='plan'?'plan':'actual',combineEntries:false,split:null,warnings}});
  }
  const selected=new Set(brief.selectedPages.map(p=>`${p.revisionId}:${p.pageIndex}`));
  const pages=brief.manifest.documents.filter(d=>d.status==='active').flatMap(d=>d.pages.filter(p=>selected.has(`${d.revisionId}:${p.index}`)||p.relevance==='relevant').map(p=>({revisionId:d.revisionId,documentHash:d.contentHash,filename:d.filename,pageIndex:p.index,pageHash:p.contentHash,transformVersion:p.transformVersion,status:p.status,selected:selected.has(`${d.revisionId}:${p.index}`),evidenceIds:confirmed.flatMap(f=>ev(f)).filter(e=>e.documentRevisionId===d.revisionId&&e.pageIndex===p.index).map(e=>e.id).filter((id,i,a)=>a.indexOf(id)===i).sort(cmp),requiresPlanVerification:true as const}))).sort((a,b)=>Number(b.selected)-Number(a.selected)||cmp(a.revisionId,b.revisionId)||a.pageIndex-b.pageIndex);
  return {briefRevision:brief.revision,manifestRevision:brief.manifest.revision,ready,blockers,candidates,held,pitchContext,calibrationHints,pages,manualAvailable:true as const,writeAuthorized:false as const};
}
