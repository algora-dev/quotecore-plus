/** Quality grammar augments, rather than loosens, the existing whole-request
 * parser. Unconsumed/compound qualifiers still go to the first model pass. */
import { requestFromText, parentFromText } from '../resolver/clues';
import { bounded, type ResolverIntent, type ResolverDomain } from '../resolver/contracts';
const domain = (text: string): ResolverDomain => /draft/i.test(text) ? 'drafts' : /order/i.test(text) ? 'orders' : /invoice/i.test(text) ? 'invoices' : 'quotes';
const clean = (text: string) => text.trim().replace(/[.!?]+$/, '').trim();
export function qualityRequest(message: string, now = new Date()): ResolverIntent | null {
    if (message.length > 600 || /[;\n\r]/.test(message))
        return null;
    let text = clean(message).replace(/^(?:I\s+(?:just\s+)?(?:want|need)\s+to\s+(?:see|find)|let me see)\s+/i, 'show ');
    text = text.replace(/^(show(?: me)?|find|list)\s+(?:all\s+(?:of\s+)?)?(?:my\s+|the\s+)?(quotes|drafts|draft quotes)\s+(with|containing|that (?:have|contain))\s+/i, '$1 $2 $3 ');
    // Pronouns are dependencies, not record names. The shared router decides
    // whether they refer to the active task or require clarification.
    if (/\b(?:its|their|the other one)\b/i.test(text) && !/["“”]/.test(text))
        return null;
    text = text.replace(/^list\s+/i, 'find ');
    // Unknown conjunctions, negations, periods and actions are never discarded.
    const base = text.replace(/^(?:please\s+)?(?:(?:can|could|would) you\s+)?/i, '')
        .replace(/^(?:show(?: me)?|find|list|open|what(?:'s| is|s)?|tell me about)\s+/i, '').replace(/^(?:my|the)\s+/i, '');
    const possessive = /^(?:all(?: of)?\s+)?(.+?)[’']s\s+(quotes|drafts|draft quotes|invoices)$/i.exec(base);
    if (possessive && bounded(possessive[1]) && !/["“”]/.test(possessive[1]) && !/\b(?:and|then|except|without|not|with|before|after)\b/i.test(possessive[1]))
        return { version: 1, task: 'find', domain: domain(possessive[2]), customer: possessive[1], list: true };
    const recency = /^(most recent|latest|newest|last|earliest|oldest|first)\s+(.+)$/i.exec(base);
    if (!recency) {
        const parsed = requestFromText(text, now);
        if (parsed) {
            if (parsed.contains)
                parsed.contains = parsed.contains.replace(/\s+(?:components|line items)$/i, '').trim();
            return parsed;
        }
        // A whole bare explicit number is a new record request unless it answers the
        // typed parent slot. The task router owns that distinction.
        if (/^(?:quote\s+(?:(?:number|no\.?)\s*)?#?\s*[1-9]\d{0,9}|(?:material\s+)?order\s+(?:number\s*)?#?\s*[a-z]{0,8}[-/]?\d[\da-z/-]*|invoice\s+(?:number\s*)?#?\s*[a-z]{0,8}[-/]?\d[\da-z/-]*)$/i.test(text)) {
            const p = parentFromText(text);
            if (p?.number)
                return { version: 1, task: 'find', domain: p.domain, number: p.number };
        }
        return null;
    }
    if (/\b(?:and|then|also|except|without|not|before|after|since|between|last week|this month|paid|unpaid|accepted|sent|draft status|delete|remove|email)\b/i.test(text))
        return null;
    const selection = /earliest|oldest|first/i.test(recency[1]) ? 'earliest' : 'latest';
    const requested = recency[2];
    const task: ResolverIntent['task'] = /^(?:please\s+)?(?:open|pull up|bring up)\b/i.test(text) ? 'open' : 'find';
    const explicit = /^(quote|draft|draft quote|order|material order|invoice)\s+for\s+(.+)$/i.exec(requested);
    if (explicit && bounded(explicit[2]) && !/\b(?:with|containing|on|from|for|in|during)\b/i.test(explicit[2]))
        return { version: 1, task, domain: domain(explicit[1]), selection, customer: explicit[2] };
    const named = /^(?:(.+?)\s+)?(quote|draft|draft quote|order|material order|invoice)$/i.exec(requested);
    if (!named)
        return null;
    if (!named[1])
        return { version: 1, task, domain: domain(named[2]), selection };
    const name = named[1].trim();
    if (!bounded(name))
        return null;
    if (/^["“].+["”]$/.test(name))
        return { version: 1, task, domain: domain(named[2]), selection, query: name.slice(1, -1) };
    if (/\b(?:with|containing|on|from|for|in|during|my|your)\b/i.test(name))
        return null;
    // Bare NAME quote may name either a customer or a job. Try the registered
    // customer predicate first; only an empty complete set permits name fallback.
    // Explicit `for NAME` above never has this fallback.
    return { version: 1, task, domain: domain(named[2]), selection, customer: name, customerOrName: true };
}
