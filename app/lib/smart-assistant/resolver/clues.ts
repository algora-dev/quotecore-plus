/** Deliberately small grammar for high-confidence clues. Unrecognised qualifiers
 * fall through to the existing model planner, never to a less-specific search. */
import { normalizeName } from './anchors';
import { bounded, type Parent, type Period, type QuestionKey, type ResolverDomain, type ResolverIntent, type ResolutionState } from './contracts';

function clean(text: string): string { return text.trim().replace(/[.!?]+$/, '').trim().replace(/^["“](.*)["”]$/, '$1').trim(); }
function lead(text: string): string { return clean(text).replace(/^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:please\s+)?/i, ''); }
function article(text: string): string { return text.replace(/^(?:my|the|a|an|those|these)\s+/i, '').trim(); }
function domainWord(word: string): ResolverDomain {
  const n = normalizeName(word);
  if (/draft/.test(n)) return 'drafts';
  if (/quote/.test(n)) return 'quotes';
  if (/order/.test(n)) return 'orders';
  if (/invoice/.test(n)) return 'invoices';
  if (/catalog/.test(n)) return 'catalogues';
  if (/library|libraries|saved|reusable/.test(n)) return 'library';
  if (/component|line item/.test(n)) return 'components';
  return 'any';
}
export function parentFromText(input: string): Parent | null {
  let text = clean(input), customer: string | undefined;
  const qualifier = /^(.*)\s+for\s+(.+)$/i.exec(text);
  if (qualifier && (qualifier[1].match(/["“”]/g) ?? []).length % 2 === 0 && /\b(?:quote|draft|job|invoice)\b/i.test(qualifier[1])) {
    text = clean(qualifier[1]); customer = clean(qualifier[2]);
    if (!bounded(customer) || /\b(?:and|then|except|without|not)\b/i.test(customer)) return null;
  }
  const current = /^(?:this|the current)\s+(draft(?:\s+quote)?|quote|(?:material\s+)?order|invoice)$/i.exec(text);
  if (current) return { domain: domainWord(current[1]) as Parent['domain'], current: true, ...(customer ? { customer } : {}) };
  text = article(text);
  const prefix = /^(draft(?:\s+quote)?|quote|(?:material\s+)?order|invoice)\s+(.+)$/i.exec(text);
  const suffix = /^(.+?)\s+(draft(?:\s+quote)?|quote|(?:material\s+)?order|invoice|job)$/i.exec(text);
  let kind: string, name: string, rawName: string;
  if (prefix) { kind = prefix[1]; rawName = prefix[2]; name = clean(rawName); }
  else if (suffix) { kind = suffix[2] === 'job' ? 'quote' : suffix[2]; rawName = suffix[1]; name = clean(rawName); }
  else return null;
  const domain = domainWord(kind) as Parent['domain'];
  if (!bounded(name) || /\b(?:and|then|except|without|not|last|latest|recent)\b/i.test(name)) return null;
  const numeric = name.replace(/^(?:number|no\.?)\s*/i, '').replace(/^#\s*/, '');
  const quoted = /^["“].*["”]$/.test(rawName!.trim());
  const numberSyntax = !!prefix || /^(?:#|number\s|no\.?\s)/i.test(rawName!.trim()) || domain !== 'quotes' && /^[a-z]+[-/]\d/i.test(name);
  const isNumber = !quoted && numberSyntax && domain !== 'drafts' && (domain === 'quotes' ? /^[1-9]\d{0,9}$/.test(numeric) : /^[a-z]{0,8}[-/]?\d[\da-z/-]*$/i.test(numeric));
  return { domain, ...(isNumber ? { number: numeric } : { text: name }), ...(customer ? { customer } : {}), ...(suffix?.[2] === 'job' ? { quoteScope: 'all_permitted' as const } : {}) };
}
/** Ranges are explicit UTC calendar ranges, frozen into pending state. No local
 * account timezone is invented. The label is included with any eventual answer. */
export function calendarPeriod(phrase: string, now: Date, basis: Period['basis'] = 'created'): Period | null {
  if (!Number.isFinite(now.getTime())) return null;
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const from = new Date(day), to = new Date(day);
  const p = normalizeName(phrase);
  if (p === 'last week') {
    const sinceMonday = (day.getUTCDay() + 6) % 7;
    to.setUTCDate(day.getUTCDate() - sinceMonday); from.setTime(to.getTime()); from.setUTCDate(from.getUTCDate() - 7);
  } else if (p === 'this week') {
    from.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7); to.setTime(from.getTime()); to.setUTCDate(to.getUTCDate() + 7);
  } else if (p === 'last month' || p === 'this month') {
    from.setUTCDate(1); if (p === 'last month') from.setUTCMonth(from.getUTCMonth() - 1);
    to.setTime(from.getTime()); to.setUTCMonth(to.getUTCMonth() + 1);
  } else if (p === 'last year' || p === 'this year') {
    from.setUTCMonth(0, 1); if (p === 'last year') from.setUTCFullYear(from.getUTCFullYear() - 1);
    to.setTime(from.getTime()); to.setUTCFullYear(to.getUTCFullYear() + 1);
  } else return null;
  return { from: from.toISOString(), to: to.toISOString(), basis, label: `${p} (UTC calendar)` };
}
function attachParent(body: string): { query: string; parent?: Parent } | null {
  const m = /^(.*?)\s+(?:on|in|within|inside|from)\s+(.+)$/i.exec(body);
  if (!m) return { query: body };
  const parent = parentFromText(m[2]);
  if (!parent) return null;
  return { query: clean(m[1]), parent };
}
/** A safe one-field rate request goes directly to the EXISTING P3 planner.
 * No user unit, rate type, qualifier or parent is inferred. */
export function rateRequest(message: string): ResolverIntent | null {
  const text = lead(message);
  const match = /^(?:set|change|update)\s+(?:the\s+)?(.+?)\s+(material|labour|labor)\s+rate\s+to\s+(\d+(?:\.\d{1,6})?)\s+(?:per\s+|\/)(m2|m²|m3|m³|m|ft2|ft²|ft3|ft³|ft|each)\s+(?:on|in|within)\s+(.+)$/i.exec(text);
  if (!match || /\b(?:and|then|except|without|not)\b/i.test(match[1])) return null;
  const parent = parentFromText(match[5]);
  if (!parent || !['quotes','drafts'].includes(parent.domain) || !bounded(match[1])) return null;
  const value = Number(match[3]); if (!Number.isFinite(value) || value > 1_000_000) return null;
  const unit = match[4].toLowerCase().replace('²', '2').replace('³', '3');
  return { version: 1, task: 'propose_component', domain: 'components', query: clean(match[1]), parent,
    proposal: { changes: { [match[2].toLowerCase() === 'material' ? 'material_rate' : 'labour_rate']: value }, quantity_unit: null, rate_unit: unit } };
}
export function requestFromText(message: string, now = new Date()): ResolverIntent | null {
  if (message.length > 600 || /[;\n]/.test(message)) return null;
  const rate = rateRequest(message); if (rate) return rate;
  let text = lead(message), task: ResolverIntent['task'];
  const charge = /^(?:what|how much)\s+did\s+(?:I|we)\s+charge\s+(?:for\s+)?(.+)$/i.exec(text);
  const cost = /^how much\s+(?:(?:does|did)\s+(.+?)\s+cost|(?:is|was|are|were)\s+(.+))$/i.exec(text);
  const lookup = /^(open|show|find|pull up|bring up|tell me about|look for)\s+(?:me\s+)?(.+)$/i.exec(text);
  if (charge) { task = 'charge'; text = charge[1]; }
  else if (cost) { task = 'cost'; text = cost[1] ?? cost[2]; }
  else if (lookup) { task = /^(open|show|pull up|bring up)$/i.test(lookup[1]) ? 'open' : 'find'; text = lookup[2]; }
  else return null;
  const intent: ResolverIntent = { version: 1, task, domain: 'any' };
  // Entire recognised relationship suffix is consumed; arbitrary compound asks
  // never become a shortened fast path.
  const expansion = /\s+with\s+(?:their\s+)?(?:linked\s+)?orders\s+and\s+(?:their\s+)?invoice\s+status$/i.exec(text);
  if (expansion) { intent.include = ['orders','invoices']; text = text.slice(0, expansion.index); }
  if (/\b(?:and|then|also|except|without|not|delete|remove|send|email|highest|lowest|largest|smallest|most|least|cheapest|expensive|top|bottom|average|total|sum|count|compare|why|increase|decrease|before|after|overdue)\b/i.test(text)) return null;
  const time = /\s+(this|last)\s+(week|month|year)$/i.exec(text);
  if (time) {
    intent.period = calendarPeriod(time[0], now, /\borders?\b/i.test(text) ? 'ordered' : 'created') ?? undefined;
    text = text.slice(0, time.index);
  }
  // Unrecognised date/recency phrases must remain for the model, not be names.
  if (/\b(?:latest|recent|yesterday|today|ago|between|since|last|this year|this month)\b/i.test(text)) return null;
  text = clean(text);
  if (/^(?:my |the )?(?:quotes|drafts|orders|invoices|components|catalogues)$/i.test(text)) return null;
  const contained = /^(?:my\s+|the\s+)?(quotes|drafts|draft quotes)\s+(?:with|containing|that (?:have|contain))\s+(.+)$/i.exec(text);
  const qualifiedPlural = /^(?:my\s+|the\s+)?(.+?)\s+(quotes|drafts)$/i.exec(text);
  if (contained || qualifiedPlural) {
    const term = clean(contained ? contained[2] : qualifiedPlural![1]);
    if (!bounded(term) || /\b(?:for|on|in|with|at)\b/i.test(term)) return null;
    intent.domain = domainWord(contained ? contained[1] : qualifiedPlural![2]);
    intent.contains = term; intent.list = true; intent.task = 'find';
    if (!contained) intent.nameOrContents = true;
    return intent;
  }
  const parentOnly = parentFromText(text);
  if (parentOnly && !/\s+(?:on|in|within|inside|from)\s+/i.test(text)) {
    intent.domain = parentOnly.domain;
    intent.query = parentOnly.text; intent.number = parentOnly.number; intent.current = parentOnly.current;
    if (parentOnly.customer) intent.customer = parentOnly.customer;
    return intent;
  }
  const fromLibrary = /^(.*?)\s+(?:from|in)\s+(?:my|the)\s+(?:component\s+)?library$/i.exec(text);
  if (fromLibrary) { intent.domain = 'library'; text = fromLibrary[1]; }
  else {
    const attached = attachParent(text); if (!attached) return null;
    if (attached.parent) { intent.parent = attached.parent; intent.domain = 'components'; text = attached.query; }
  }
  const explicitLibrary = /^(?:my\s+|the\s+)?(?:saved|library|reusable)\s+(?:smart\s+)?component\s+(.+)$/i.exec(text);
  const suffixLibrary = /^(.+?)\s+(?:from\s+)?(?:my\s+|the\s+)?(?:component\s+)?library$/i.exec(text);
  if (explicitLibrary || suffixLibrary) { intent.domain = 'library'; text = (explicitLibrary ?? suffixLibrary)![1]; }
  const component = /^(?:my\s+|the\s+)?(?:smart\s+)?(?:component|line item)\s+(.+)$/i.exec(text);
  if (component) { intent.domain = 'components'; text = component[1]; }
  const atEnd = /^(.+?)\s+(?:component|line item)$/i.exec(text);
  if (atEnd) { intent.domain = 'components'; text = atEnd[1]; }
  text = clean(article(text));
  if (!bounded(text) || /\b(?:it|that|thing|something|one|stuff|them)\b/i.test(text)
      || /\b(?:on|within|from|for|with|at|during)\b/i.test(text)) return null;
  if (intent.include && !['quotes','drafts'].includes(intent.domain)) return null;
  intent.query = text;
  return intent;
}
export type Refinement = { intent: ResolverIntent; rejectShown: boolean; useful: boolean } | { choiceIndex: number } | { cancel: true };
export function refineRequest(previous: ResolutionState, message: string, now = new Date()): Refinement | null {
  if (!bounded(message, 240)) return null;
  let text = clean(message);
  if (/^(?:cancel|never mind|nevermind|stop)(?: (?:that|this|search))?$/i.test(text)) return { cancel: true };
  const ordinal = /^(?:the\s+)?(first|second|third|fourth|fifth|[1-5])(?:\s+(?:one|option))?$/i.exec(text);
  if (ordinal) return { choiceIndex: ['first','second','third','fourth','fifth'].includes(ordinal[1].toLowerCase()) ? ['first','second','third','fourth','fifth'].indexOf(ordinal[1].toLowerCase()) : Number(ordinal[1])-1 };
  const rejectShown = /^(?:none(?: of (?:these|those))?|not (?:these|those)|no)(?:[,.!]?\s|$)/i.test(text);
  text = text.replace(/^(?:none(?: of (?:these|those))?|not (?:these|those)|no)(?:[,.!]?\s|$)/i, '').trim();
  const intent: ResolverIntent = JSON.parse(JSON.stringify(previous.intent));
  if (!text) return { intent, rejectShown, useful: false };
  // A fresh independent request does not accidentally inherit an earlier search.
  if (/^(?:what|how|why|can|could|please|show|open|find|set|change|send|delete)\b/i.test(text)) return null;
  if (/\b(?:and|then|except|without|not)\b/i.test(text)) return null;
  let useful = false;
  if (/^(?:the\s+)?one I (?:normally|usually) use$/i.test(text) || /^(?:the |my )?(?:component )?(?:library|saved components?)$/i.test(text)) {
    intent.domain = 'library'; delete intent.parent; delete intent.current; delete intent.id; delete intent.number; useful = true;
  }
  const ordered = /^(?:the\s+)?(?:one I\s+)?ordered\s+((?:last|this) (?:week|month|year))$/i.exec(text);
  if (ordered) { intent.domain = 'orders'; intent.period = calendarPeriod(ordered[1], now, 'ordered')!; delete intent.parent; delete intent.current; useful = true; }
  const onlyDomain = /^(?:in|on|from)?\s*(?:a|the|my)?\s*(quotes?|draft(?: quote)?s?|(?:material )?orders?|invoices?|catalogues?|components?)$/i.exec(text);
  if (onlyDomain) { intent.domain = domainWord(onlyDomain[1]); delete intent.parent; delete intent.current; useful = true; }
  const parent = parentFromText(text.replace(/^(?:on|in|from)\s+/i, ''));
  if (parent) {
    if (['components','any','library','catalogues'].includes(intent.domain) || intent.parent || ['cost','charge','propose_component'].includes(intent.task) && intent.query) {
      intent.parent = parent; intent.domain = 'components'; delete intent.current;
    } else { intent.domain = parent.domain; intent.number = parent.number; intent.id = parent.id; intent.query = parent.text ?? intent.query; intent.current = parent.current; }
    useful = true;
  }
  const period = calendarPeriod(text, now, intent.domain === 'orders' ? 'ordered' : 'created');
  if (period) { intent.period = period; useful = true; }
  const correctedName = /^(?:it(?:'s| is)|I meant|called|named)\s+(.+)$/i.exec(text);
  if (correctedName && bounded(correctedName[1])) { intent.query = clean(correctedName[1]); delete intent.contains; useful = true; }
  if (!useful) {
    // "the Smith one" answers the discriminator, not a fresh global text query.
    const value = clean(text.replace(/^(?:the|for|customer|job)\s+/i, '').replace(/\s+(?:one|job|customer)$/i, ''));
    if (!bounded(value) || /\b(?:maybe|dunno|know|something|somewhere|thing|stuff|yes|okay|ok|it|that)\b/i.test(value) || /[?]/.test(text)) return { intent, rejectShown, useful: false };
    const key: QuestionKey = previous.question.key;
    if (key === 'customer') { if (intent.parent) intent.parent.customer = value; else intent.customer = value; }
    else if (key === 'job') { if (intent.parent) intent.parent.job = value; else intent.job = value; }
    else if (key === 'name') { intent.query = value; delete intent.contains; }
    else if (key === 'date') return { intent, rejectShown, useful: false };
    else if (intent.parent) {
      // A clarification must not silently replace an exact parent identity.
      if (intent.parent.id || intent.parent.number || intent.parent.current) intent.parent.customer = value;
      else intent.parent = { ...intent.parent, text: value };
    }
    else if (['quotes','drafts'].includes(intent.domain)) intent.customer = value;
    else { intent.parent = { domain: 'quotes', text: value, quoteScope: 'all_permitted' }; intent.domain = 'components'; }
    useful = true;
  }
  return { intent, rejectShown, useful };
}
