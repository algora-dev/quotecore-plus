import type { DraftChoiceWire } from './contracts';
const PREFIX='[SA_DRAFT_CHOICE_V1]';
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export function encodeDraftChoice(value:DraftChoiceWire){ return PREFIX+encodeURIComponent(JSON.stringify(value)); }
export function decodeDraftChoice(value:string):DraftChoiceWire|null{
  if(!value.startsWith(PREFIX)||value.length>30000)return null;
  try{
    const parsed=JSON.parse(decodeURIComponent(value.slice(PREFIX.length)));
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)||Object.keys(parsed).some(k=>!['version','stateId','revision','selections','choice'].includes(k))
      ||parsed.version!==1||!uuid(parsed.stateId)||!Number.isSafeInteger(parsed.revision)||parsed.revision<1
      ||!parsed.selections||typeof parsed.selections!=='object'||Array.isArray(parsed.selections)
      ||parsed.choice!==undefined&&!['apply','cancel'].includes(parsed.choice))return null;
    const selections=Object.entries(parsed.selections);
    if(selections.length>25||selections.some(([key,id])=>key.length>120||!(key==='basis'?(id==='plan'||id==='actual'):uuid(id))||!(key==='collection'||key==='basis'||/^concept:[a-z][a-z0-9_]{1,63}$/.test(key)||key.startsWith('measurement:')&&uuid(key.slice(12)))))return null;
    return {version:1,stateId:parsed.stateId,revision:parsed.revision,selections:Object.fromEntries(selections) as Record<string,string>,...(parsed.choice?{choice:parsed.choice}:{})};
  }catch{return null;}
}
export function isDraftChoice(value:string){return value.startsWith(PREFIX);}
export function displayDraftChoice(value:string){return isDraftChoice(value)?(decodeDraftChoice(value)?.choice==='cancel'?'Draft preparation cancelled.':'Draft component choices selected.'):value;}
