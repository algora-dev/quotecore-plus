import type { DraftChoiceWire } from './contracts';
const PREFIX='[SA_DRAFT_CHOICE_V1]';
export function encodeDraftChoice(value:DraftChoiceWire){ return PREFIX+encodeURIComponent(JSON.stringify(value)); }
export function decodeDraftChoice(value:string):DraftChoiceWire|null{
  if(!value.startsWith(PREFIX))return null;
  try{const parsed=JSON.parse(decodeURIComponent(value.slice(PREFIX.length))) as DraftChoiceWire;
    if(parsed?.version!==1||typeof parsed.stateId!=='string'||!Number.isInteger(parsed.revision)||!parsed.selections||typeof parsed.selections!=='object')return null;
    return parsed;
  }catch{return null;}
}
export function isDraftChoice(value:string){return value.startsWith(PREFIX);}
export function displayDraftChoice(value:string){return isDraftChoice(value)?'Draft component choices selected.':value;}
