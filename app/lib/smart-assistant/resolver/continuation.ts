/** Model-assisted clarification uses the SAME resolver and stored user task.
 * It cannot replace a pending read with an edit, alter a proposed rate, approve
 * anything, or erase explicit identities without a new user-supplied reference. */
import { normalizeName, extractAnchors, constrainIntent } from './anchors';
import { strictObject, type ResolverIntent, type ResolutionState } from './contracts';
import { parseResolutionState } from './state';
import { RetrievalError } from '../retrieval/contracts';

export function mergeRefinement(state:ResolutionState, raw:unknown, message:string):{intent:ResolverIntent;rejectShown:boolean;useful:boolean}{
  const patch=strictObject(raw,['domain','query','number','parent','customer','job','period','rejectPrevious'],'clarification clues');
  if(patch.rejectPrevious!==undefined && typeof patch.rejectPrevious!=='boolean')throw new RetrievalError('invalid_query','rejectPrevious must be boolean.');
  const {rejectPrevious,...clues}=patch;
  if(!Object.keys(clues).length && rejectPrevious!==true)throw new RetrievalError('invalid_query','A clarification needs one useful clue or a rejection of the displayed choices.');
  const old=state.intent;
  // Replacing an exact identity is an explicit user correction, never an AI
  // repair strategy. A model cannot smuggle a new id/task/rate into this patch.
  const anchors=extractAnchors(message);
  if(old.parent?.number && patch.parent && (patch.parent as Record<string,unknown>).number!==old.parent.number
      && !anchors.numbers.some(n=>n.number===(patch.parent as Record<string,unknown>).number))throw new RetrievalError('invalid_query','Keep the prior exact parent unless the user explicitly corrects its number.');
  if(old.parent?.id && patch.parent && JSON.stringify(patch.parent)!==JSON.stringify(old.parent))throw new RetrievalError('invalid_query','Keep the selected parent. Start a new request or use an explicit selection to change it.');
  if(old.number && patch.number!==undefined && patch.number!==old.number && !anchors.numbers.some(n=>n.number===patch.number))throw new RetrievalError('invalid_query','The old exact record number cannot be silently replaced.');
  const merged={...old,...clues};
  if(patch.domain==='any')merged.domain=old.domain;
  if(patch.parent && old.parent){
    const parentPatch=patch.parent as Record<string,unknown>;
    const kept={...old.parent};
    // A new explicit selector replaces the old selector, not its independent
    // customer/job constraints. Keeping text+number would reject a perfectly
    // useful second answer even though the user supplied the exact number.
    if(['id','number','text','current'].some(key=>parentPatch[key]!==undefined)){
      delete kept.id;delete kept.number;delete kept.text;delete kept.current;
    }
    merged.parent={...kept,...parentPatch};
  }
  if(patch.query!==undefined && normalizeName(String(patch.query))!==normalizeName(old.query??'')){
    if(!/\b(?:called|named|meant|spelled|spelt|name is)\b/i.test(message))throw new RetrievalError('invalid_query','Keep the original item clue. Use customer/job/parent for context; change query only for an explicit name correction.');
    delete merged.contains;delete merged.nameOrContents;
  }
  // A domain-only answer normally narrows a broad discovery. An explicit parent
  // is not silently dropped when the model supplies an inconsistent domain.
  if(old.parent && patch.domain && !['components',old.domain].includes(String(patch.domain)))throw new RetrievalError('invalid_query','That domain conflicts with the stored parent. Ask for an explicit new request rather than dropping it.');
  const checked=parseResolutionState({...state,intent:merged});
  if(!checked)throw new RetrievalError('invalid_query','Those clarification clues cannot be combined with the stored task. No qualifier or proposed change was discarded.');
  const intent=constrainIntent(checked.intent,anchors);
  // Parse once more after attaching exact user references. The server-only P3
  // payload remains exactly the payload that was already stored for this task.
  if(!parseResolutionState({...state,intent}))throw new RetrievalError('invalid_query','The exact reference conflicts with this continuation.');
  return {intent,rejectShown:rejectPrevious===true,useful:Object.keys(clues).length>0};
}
