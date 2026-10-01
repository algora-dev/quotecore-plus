/** One turn-boundary decision shared by the deterministic and model paths.
 * Parse failure is UNKNOWN, never evidence that data is absent. Context is used
 * because a message depends on it, not because a previous question was pending. */
import { parentFromText, refineRequest, type Refinement } from '../resolver/clues';
import { qualityRequest } from './interpretation';
import { normalizeName } from '../resolver/anchors';
import { componentWords } from '../resolver/vocabulary';
import { parseFastIntent } from '../speed/intent';
import { isResolutionMessage } from '../resolver/wire';
import type { ResolverIntent, StoredResolution } from '../resolver/contracts';
import type { TaskDisposition, TaskSnapshot } from './contracts';
export type TaskDecision = {
    disposition: TaskDisposition;
    reason: string;
    message: string;
    parsed?: ResolverIntent;
    refinement?: Refinement;
    closure?: 'solved' | 'abandoned';
};
const clean = (s: string) => s.trim().replace(/[,.!?]+$/, '').trim();
export function taskControl(message: string): 'solved' | 'abandoned' | null {
    const text = clean(message).replace(/[’]/g, "'");
    if (/^(?:thanks(?: very much| a lot)?|thank you(?: very much)?|done|task (?:complete|completed|solved)|that(?:'s| is) (?:what I (?:wanted|needed)|right))$/i.test(text))
        return 'solved';
    if (/^(?:move on|new (?:question|request|task)|start (?:over|fresh)|never ?mind|cancel(?: (?:this|that|the))?(?: (?:search|task))?|stop(?: (?:this|that|the) (?:search|task))?)$/i.test(text))
        return 'abandoned';
    // Bare yes/confirmed/approve are deliberately NOT approval or task controls.
    return null;
}
export function stripTaskPreamble(message: string): string {
    return message.trim().replace(/^(?:(?:thanks|thank you|okay|ok)(?:[,.!]\s*|\s+)(?:now\s+)?|(?:new (?:question|request|task)|move on)[,:.!]\s*)/i, '');
}
const activeResolution = (snapshot: TaskSnapshot, now: Date): StoredResolution | null => snapshot.resolution
    && Date.parse(snapshot.resolution.expiresAt) > now.getTime() ? snapshot.resolution : null;
export function decideTask(message: string, snapshot: TaskSnapshot, now = new Date()): TaskDecision {
    const control = taskControl(message);
    if (control)
        return { disposition: 'close', reason: 'explicit_task_control', message, closure: control };
    const text = stripTaskPreamble(message);
    const standalone = qualityRequest(text, now);
    const task = snapshot.task;
    const live = !!task && task.status !== 'closed' && Date.parse(task.expiresAt) > now.getTime();
    const saved = live ? activeResolution(snapshot, now) : null;
    const pending = saved?.state.status === 'pending' ? saved : null;
    const next = (reason: string): TaskDecision => ({ disposition: 'new', reason, message: text, ...(standalone ? { parsed: standalone } : {}) });
    if (isResolutionMessage(text))
        return { disposition: 'continue', reason: 'structured_candidate', message: text };
    if (!live)
        return next(task?.status === 'closed' ? 'previous_task_closed' : 'no_live_task');
    // Acknowledgement prefixes do not erase a dependent follow-up. Only an
    // explicit fresh-task prefix has authority to discard the old task here.
    if (/^(?:new (?:question|request|task)|move on)[,:.!]/i.test(message.trim()))
        return next('explicit_new_task_prefix');
    // A bare exact parent can answer a typed parent question, but a failed LIST
    // must never attach its old component/customer filters to a new quote number.
    const parent = parentFromText(clean(text).replace(/^(?:on|in|from)\s+/i, ''));
    const expectsParent = pending && !pending.state.intent.list
        && (pending.state.question.key === 'parent' || !!pending.state.intent.parent
            || ['cost', 'charge', 'propose_component'].includes(pending.state.intent.task));
    if (parent && expectsParent) {
        const refinement = refineRequest(pending.state, text, now);
        if (refinement && 'intent' in refinement && refinement.useful)
            return { disposition: 'continue', reason: 'expected_parent_answer', message: text, refinement };
    }
    // Owner feedback 2026-09-29 (voice follow-ups): an anaphoric mention of the
    // task's document ("that draft", "this quote", "on the record we opened") or a
    // definite roof-area reference ("the main roof area") continues the live task
    // instead of spinning a fresh one that re-asks which job is meant. Proper-noun
    // records ("the Smith quote") still fall through to a new task below.
    if (/\b(?:that|this)\s+(?:draft|quote|invoice|order|job|record)\b/i.test(text)
        || /\b(?:that|this|the)\s+(?:(?:main|front|back|rear|left|right|upper|lower|garage|porch|extension)\s+)?(?:roof\s+)?areas?\b/i.test(text)
        || /\bon\s+(?:that|this|the)\s+(?:draft|quote|invoice|order|job|record|area)\b/i.test(text))
        return { disposition: 'continue', reason: 'dependent_reference', message: text };
    if (standalone || parseFastIntent(text))
        return next('self_contained_request');
    // A variant-only follow-up repairs the prior component term, not the task's
    // identity, period, requested operation or customer constraints.
    const variant = clean(text);
    if (saved && /^(?:ridge|ridges|ridging)$/i.test(variant)) {
        const old = saved.state.intent;
        const clue = old.contains ?? old.query;
        if (clue && normalizeName(componentWords(clue)) === 'ridge') {
            const intent = { ...old };
            if (old.contains)
                intent.contains = componentWords(variant);
            else
                intent.query = componentWords(variant);
            return { disposition: 'correct', reason: 'component_word_variant', message: text, refinement: { intent, rejectShown: false, useful: true } };
        }
    }
    const correction = /^(?:no\b|none(?: of (?:these|those))?\b|not (?:these|those|quite)\b|I (?:meant|mean)\b|it(?:'s| is) called\b)/i.test(text);
    if (correction && saved) {
        const refinement = refineRequest(saved.state, text, now);
        // Structured qualifiers or a full sentence must go to interpretation, not
        // become a literal customer/name value. Rejection alone remains useful.
        const safe = refinement && ('cancel' in refinement || 'choiceIndex' in refinement
            || (!/\b(?:with|contain|containing|quantity|metres|meters|on the)\b/i.test(text) && 'intent' in refinement));
        return { disposition: 'correct', reason: 'explicit_correction', message: text, ...(safe ? { refinement } : {}) };
    }
    if (/^(?:what|how) about\b|\b(?:its|their)\b|^(?:and\s+)?(?:that|those|it|them|the other one)\b/i.test(text)) {
        return { disposition: 'continue', reason: 'dependent_reference', message: text };
    }
    // Acknowledgements and proceed-style confirmations (the task strip's
    // Proceed button sends "Yes, proceed."; users type or voice the same intent
    // with fillers - owner 2026-09-29 mobile test: "Correct, proceed." and
    // "Yeah, so proceed." both spun pointless boundary questions mid-creation)
    // continue the CURRENT task when the message is short and made purely of
    // confirmation words. They are never authority for a write: Confirm cards
    // are the only path that applies a change.
    const CONFIRM_WORDS = new Set(['please', 'thanks', 'thank', 'you', 'yes', 'yeah', 'yep', 'yup', 'correct', 'right', 'thats', "that's", 'sounds', 'looks', 'good', 'perfect', 'great', 'sure', 'ok', 'okay', 'confirmed', 'confirm', 'approved', 'approve', 'proceed', 'continue', 'go', 'ahead', 'carry', 'on', 'keep', 'going', 'for', 'it', 'so', 'then', 'now', 'that', 'is', 'was']);
    const confirmWords = text.replace(/[\u2019\u2018]/g, "'").toLowerCase().split(/[^a-z']+/).filter(Boolean);
    if (confirmWords.length > 0 && confirmWords.length <= 6 && !text.includes('?') && confirmWords.every(word => CONFIRM_WORDS.has(word)))
        return { disposition: 'continue', reason: 'acknowledgement_not_authority', message: text };
    if (pending) {
        const ordinal = /^(?:the\s+)?(?:first|second|third|fourth|fifth|[1-5])(?:\s+(?:one|option))?[.!?]?$/i.test(text);
        const explicitSlot = /^(?:the\s+)?one I (?:normally|usually) use|^(?:the\s+)?(?:one I\s+)?ordered\s+|^(?:on|in|from|for|customer|job|called|named)\s+|^(?:this|last) (?:week|month|year)$/i.test(text);
        const elapsed = now.getTime() - Date.parse(task!.updatedAt);
        const shortAnswer = text.length <= 100 && !/[?]/.test(text) && text.split(/\s+/).length <= 8
            && !/\b(?:want|need|would|could|can|should|show|find|see|give|tell|change|set|remove|send|email|compare|contains?|with|before|after|but|and)\b/i.test(text);
        if (ordinal || explicitSlot || (shortAnswer && elapsed < 5 * 60000)) {
            const refinement = refineRequest(pending.state, text, now);
            if (refinement && (!('intent' in refinement) || refinement.useful))
                return { disposition: 'continue', reason: ordinal ? 'candidate_ordinal' : 'expected_slot_answer', message: text, refinement };
        }
    }
    // Owner 2026-10-01 (voice): the model asks "plan or actual measurements?"
    // per the prompt contract, but that question leaves no resolver-level
    // pending state, so a short basis-only answer used to fall into the
    // boundary fallback ("existing task or new task?"). Bind it to the LIVE
    // task as an expected answer instead.
    if (live && /^(?:plan|actual)(?:\s+(?:measurements?|sizes?|figures?|numbers?|dimensions?|values?|basis))?[.!?]*$/i.test(text))
        return { disposition: 'continue', reason: 'expected_basis_answer', message: text };
    // Unparsed complete questions/statements use the EXISTING first model pass.
    // They do not inherit an old unresolved search or consume its retry budget.
    if (text.length > 140 || text.split(/\s+/).length > 8 || /^(?:I\s+(?:just\s+)?(?:want|need)|what|whats|what's|how|why|when|where|who|please|can|could|would|show|list|open|find|set|change|send|delete|compare|tell|give|pull)\b/i.test(text))
        return next('unparsed_self_contained_request');
    return { disposition: 'ask_boundary', reason: 'ambiguous_fragment', message: text };
}
export function intentLabel(intent: ResolverIntent): string {
    const name = (value: string | undefined) => value?.replace(/[\u0000-\u001f]/g, ' ').trim();
    const domain = intent.domain === 'any' ? 'permitted records' : intent.domain === 'library' ? 'component library' : intent.domain;
    const parent = intent.parent ? ` on ${intent.parent.domain}${intent.parent.number ? ` #${intent.parent.number}` : intent.parent.text ? ` ${name(intent.parent.text)}` : ''}` : '';
    const detail = `${intent.number ? ` #${intent.number}` : ''}${intent.query ? ` ${name(intent.query)}` : ''}${intent.contains ? ` containing ${name(intent.contains)}` : ''}${intent.customer ? ` for ${name(intent.customer)}` : ''}${intent.job ? ` at ${name(intent.job)}` : ''}${parent}`;
    return `${intent.task === 'propose_component' ? 'Reviewing' : intent.selection === 'latest' ? 'Latest' : intent.selection === 'earliest' ? 'Earliest' : 'Finding'}: ${domain}${detail}`.slice(0, 200);
}
