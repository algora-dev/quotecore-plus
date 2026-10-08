import {validCalculationJournal,type CalculationJournal} from './protocol';
import type { ReviewScope } from '../persistence/reviews';
import { reviewScopeKey } from '../persistence/reviews';
/** No geometry or pricing in this last-resort session journal. The host also
 * stores this in its authenticated durable checkpoint. Storage is best effort. */
export function storeCalculationJournal(scope:ReviewScope,journal:CalculationJournal):void {
  try{sessionStorage.setItem('qc-offcuts-run-v220|'+reviewScopeKey(scope),JSON.stringify(journal));}catch{/* quota/private mode; host checkpoint is independent */}
}
export function loadCalculationJournal(scope:ReviewScope):CalculationJournal|null {
  try{const raw=sessionStorage.getItem('qc-offcuts-run-v220|'+reviewScopeKey(scope));if(!raw||raw.length>80_000)return null;
    const j=JSON.parse(raw) as CalculationJournal;return validCalculationJournal(j)?j:null;
  }catch{return null;}
}
