/** Immutable clues from the ACTUAL user utterance. These constrain model plans;
 * they do not give the model access or identify a row by themselves. */
import { isRecord } from '../section-permissions';
import { RetrievalError } from '../retrieval/contracts';
import type { ResolverDomain, ResolverIntent } from './contracts';
export type NumberAnchor = { domain: 'quotes' | 'orders' | 'invoices'; number: string };
export type Anchors = { numbers: NumberAnchor[]; customer?: string; component?: string; child?: string };
export function normalizeName(text: string): string {
  return text.normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}
export function extractAnchors(message: string): Anchors {
  const numbers: NumberAnchor[] = [];
  const typedSpans: [number,number][] = [];
  // Quoted names stay names. Digits in an ordinal job name are not a quote number.
  const text = message.replace(/"[^"\n]*"|“[^”\n]*”/g, ' ');
  const re = /\b(quote|invoice|(?:material\s+)?order)\s*(?:(?:number|no\.?)\s*)?#?\s*([a-z]{0,8}[-/]?\d[\da-z/-]*)(?![\p{L}\p{N}])/giu;
  for (const m of text.matchAll(re)) {
    typedSpans.push([m.index!,m.index!+m[0].length]);
    const domain = m[1].toLowerCase() === 'quote' ? 'quotes' : m[1].toLowerCase() === 'invoice' ? 'invoices' : 'orders';
    const number = m[2];
    if (domain === 'quotes' && !/^[1-9]\d{0,9}$/.test(number)) continue;
    if (number.length > 60 || /\b(?:draft)\s*$/i.test(text.slice(Math.max(0, m.index! - 10), m.index!))) continue;
    if (/^0\d/.test(number) && domain === 'quotes') continue;
    if (!numbers.some(n => n.domain === domain && n.number.toLowerCase() === number.toLowerCase())) numbers.push({ domain, number });
  }
  {
    const hash = /(?:^|\s)#([1-9]\d{0,9})(?![\p{L}\p{N}])/gu;
    for (const m of text.matchAll(hash)) {
      const at=m.index!+m[0].indexOf('#');
      if(typedSpans.some(([a,b])=>at>=a&&at<b) || /\bdraft\s*$/i.test(text.slice(Math.max(0,at-12),at)))continue;
      if(!numbers.some(n=>n.domain==='quotes'&&n.number===m[1]))numbers.push({ domain: 'quotes', number: m[1] });
    }
  }
  // "for" is a customer qualifier only in an entity-shaped request, not e.g.
  // "flashing for chimneys". Do not split arbitrary product descriptions.
  // Component/item identity in edit-shaped requests is immutable user input.
  // Keep this deliberately structural: extract the named child, but leave the
  // requested mutation/value to the existing validated P3 proposal parser.
  // This prevents model plans from switching components when wording varies.
  const childPatterns = [
    /^(?:please\s+)?(?:set|change|update)\s+(?:the\s+)?(.+?)\s+(?:material|labour|labor)\s+rate\b/i,
    /^(?:please\s+)?(?:set|change|update)\s+(?:the\s+)?(?:material|labour|labor)\s+rate\s+(?:to|on|in)\s+(?:the\s+)?(.+?)(?:\s+component\b|\s+line items?\b|\s+items?\b|\s+(?:of|on|for|in)\s+|\s+to\s+|$)/i,
    /^(?:please\s+)?(?:set|change|update)\s+(?:the\s+)?(.+?)\s+(?:quantity|qty|waste(?:\s+percent(?:age)?)?|pitch(?:\s+degrees?)?)\b/i,
    /^(?:please\s+)?(?:set|change|update)\s+(?:the\s+)?(?:quantity|qty|waste(?:\s+percent(?:age)?)?|pitch(?:\s+degrees?)?)\s+(?:to|on|in|of)\s+(?:the\s+)?(.+?)(?:\s+component\b|\s+line items?\b|\s+items?\b|\s+(?:of|on|for|in)\s+|\s+to\s+|$)/i,
  ];
  const articleOnly = (v?: string) => !v || /^(?:the|a|an|this|that|it|these|those)$/i.test(v);
  let childFinal: string | undefined;
  for (const pattern of childPatterns) {
    const value = pattern.exec(message)?.[1]?.trim().replace(/^["“']+|["”']+$/g,'');
    if (!articleOnly(value)) { childFinal = value; break; }
  }
  // Mask quoted literals without changing offsets: a job named "Ridge for
  // Smith" is not customer=Smith. A real qualifier after that literal still
  // binds, including when the customer name itself is quoted.
  const literalMask = message.replace(/"[^"\n]*"|“[^”\n]*”/g, value => 'Q'.repeat(value.length));
  const customerMatch = /(\b(?:quotes?|draft(?:\s+quotes?)?|invoices?|jobs?|(?:material\s+)?orders?)\b[^\n;]*?\s+for\s+)([^\n;?!]+?)(?=\s+(?:on|in|with|containing|that\s+(?:has|have|contains?|includes?))\b|[.!?]|$)/i.exec(literalMask);
  const customerStart = customerMatch ? customerMatch.index + customerMatch[1].length : 0;
  const customer = customerMatch ? message.slice(customerStart, customerStart + customerMatch[2].length).trim().replace(/^["“]|["”]$/g, '') : undefined;
  const component = /\b(?:quotes|drafts)\s+(?:with|containing|that (?:have|contain))\s+(.+?)(?:\s+(?:with their|and (?:their|the)|for)\b|[.!?]|$)/i.exec(message)?.[1]?.trim().replace(/\s+(?:components|line items)$/i,'');
  return { numbers: numbers.slice(0, 8), ...(childFinal && childFinal.length<=120 && !/\b(?:and|then|except|without|not)\b/i.test(childFinal)?{child:childFinal}:{}), ...(customer && customer.length <= 120 && !/\b(?:and|then|except|without|not)\b/i.test(customer) ? { customer } : {}),
    ...(component && component.length <= 120 && !/^(?:their|linked|orders?|invoices?|customers?|status)\b/i.test(component) ? { component } : {}) };
}
function conflict(message: string): never { throw new RetrievalError('invalid_query', message); }
function addFilter(filters: unknown, field: string, values: (string | number)[]): Record<string, unknown>[] {
  if (filters !== undefined && (!Array.isArray(filters) || filters.some(x => !isRecord(x)))) conflict('Invalid filters; explicit identifiers cannot be discarded.');
  const result = [...(filters as Record<string, unknown>[] | undefined ?? [])];
  const prior = result.filter(f => f.field === field);
  for (const filter of prior) {
    const allowed = values.map(String), provided = filter.op === 'eq' ? [String(filter.value)] : filter.op === 'in' && Array.isArray(filter.value) ? filter.value.map(String) : [];
    if (!provided.length || provided.some(x => !allowed.some(y => y.toLowerCase() === x.toLowerCase()))) conflict(`The ${field} predicate contradicts an explicit user reference. Keep the exact reference; do not fuzzy-match another record.`);
  }
  if (!prior.length) result.push(values.length === 1 ? { field, op: 'eq', value: values[0] } : { field, op: 'in', value: values });
  return result;
}
/** Internal compiler pre-pass. Parameter values still go through the existing
 * strict schema/compiler and RLS invoker. Never removes a user qualifier. */
export function constrainPlan(raw: unknown, anchors: Anchors): unknown {
  if (!isRecord(raw)) return raw;
  const plan: Record<string, unknown> = JSON.parse(JSON.stringify(raw));
  const source = String(plan.source ?? '');
  for (const domain of ['quotes','orders','invoices'] as const) {
    const values = anchors.numbers.filter(n => n.domain === domain).map(n => domain === 'quotes' ? Number(n.number) : n.number);
    if (!values.length) continue;
    const field = domain === 'quotes' ? 'quote_number' : domain === 'orders' ? 'order_number' : 'invoice_number';
    const direct = domain === 'quotes' ? ['quotes','quote_components','customer_quote_lines','quote_areas','quote_entries']
      : domain === 'orders' ? ['orders','order_lines','order_text_lines'] : ['invoices','invoice_lines'];
    if (direct.includes(source)) plan.filters = addFilter(plan.filters, field, values);
    else if (domain === 'quotes' && ['orders','invoices'].includes(source)) {
      const related = Array.isArray(plan.related) ? [...plan.related] : [];
      const i = related.findIndex(r => isRecord(r) && r.relation === 'quote');
      if (i >= 0) related[i] = { ...related[i], filters: addFilter(related[i].filters, field, values) };
      else related.push({ relation: 'quote', filters: addFilter([], field, values) });
      plan.related = related;
    } else if (!['knowledge_documents','knowledge_chunks'].includes(source)) {
      conflict(`This source cannot establish the explicitly requested ${domain} relationship. Use the entity resolver instead of dropping that reference.`);
    }
    if (isRecord(plan.search) && typeof plan.search.text === 'string' && direct.includes(source)) {
      const n = normalizeName(plan.search.text).replace(/^(?:quote|order|invoice)\s+(?:number\s+)?/, '');
      if (values.some(value => normalizeName(String(value)) === n)) delete plan.search;
    }
  }
  if (anchors.customer) {
    const text = anchors.customer;
    if (['quotes','quote_components','customer_quote_lines','quote_areas','quote_entries','invoices','invoice_lines'].includes(source)) {
      const filters = Array.isArray(plan.filters) ? [...plan.filters] : [];
      // Retain narrower legitimate predicates, but independently bind the supplied customer.
      if (!filters.some(f => isRecord(f) && f.field === 'customer_name' && f.op === 'words' && f.value === text)) filters.push({ field: 'customer_name', op: 'words', value: text });
      plan.filters = filters;
      if (isRecord(plan.search) && typeof plan.search.text === 'string') {
        const searchText = plan.search.text.trim();
        const suffix = new RegExp(`\\s+(?:(?:quote|draft|invoice|job)\\s+)?for\\s+${escapeRegex(text)}[.!?]?$`, 'i');
        const stripped = searchText.replace(suffix, '').replace(/\s+(?:quote|draft|invoice|job)$/i, '').trim();
        if (stripped !== searchText) { if (stripped) plan.search = { ...plan.search, text: stripped }; else delete plan.search; }
      }
    } else if (source === 'orders') {
      const related = Array.isArray(plan.related) ? [...plan.related] : [];
      const i = related.findIndex(r => isRecord(r) && r.relation === 'quote');
      const q = i >= 0 ? related[i] : { relation: 'quote', filters: [] };
      const filters = Array.isArray(q.filters) ? [...q.filters] : [];
      filters.push({ field: 'customer_name', op: 'words', value: text });
      if (i >= 0) related[i] = { ...q, filters }; else related.push({ ...q, filters });
      plan.related = related;
    } else conflict('This source cannot preserve the explicit customer qualifier. Resolve the named parent first.');
  }
  if (anchors.component && source === 'quotes') {
    const related = Array.isArray(plan.related) ? [...plan.related] : [];
    const idx = related.findIndex(r => isRecord(r) && r.relation === 'components');
    const child = idx >= 0 ? related[idx] : { relation: 'components', filters: [] };
    const filters = Array.isArray(child.filters) ? [...child.filters] : [];
    if (!filters.some(f => isRecord(f) && f.field === 'name' && f.op === 'words' && f.value === anchors.component)) filters.push({ field: 'name', op: 'words', value: anchors.component });
    if (idx >= 0) related[idx] = { ...child, filters }; else related.push({ ...child, filters });
    plan.related = related;
    if (isRecord(plan.search) && normalizeName(String(plan.search.text)) === normalizeName(anchors.component)) delete plan.search;
  }
  if(anchors.child){
    const childFields:Record<string,string>={quote_components:'name',customer_quote_lines:'text',order_lines:'item_name',order_text_lines:'text',invoice_lines:'title'};
    const field=childFields[source];
    if(field){const filters=Array.isArray(plan.filters)?[...plan.filters]:[];filters.push({field,op:'words',value:anchors.child});plan.filters=filters;}
  }
  return plan;
}
export function constrainIntent(intent: ResolverIntent, anchors: Anchors): ResolverIntent {
  const next: ResolverIntent = { ...intent, ...(intent.parent ? { parent: { ...intent.parent } } : {}) };
  if (anchors.numbers.length > 1) conflict('This request contains several explicit record numbers. Use separate constrained queries; do not select one arbitrarily.');
  const number = anchors.numbers[0];
  if (number) {
    if (next.parent) {
      if (next.parent.domain !== number.domain || next.parent.number && normalizeName(next.parent.number) !== normalizeName(number.number)) conflict('The parent conflicts with the explicit record reference.');
      const { text: _text, current: _current, ...rest } = next.parent;
      // Keep an existing UUID only as a secondary revalidation constraint in query planning.
      if (rest.id) conflict('Use the explicit parent number for this request, rather than a model-selected UUID.');
      next.parent = { ...rest, number: number.number };
    } else if (next.task === 'propose_component' || ['components','library'].includes(next.domain) || next.task === 'charge' && next.query) {
      if (next.domain === 'library') conflict('A library record cannot satisfy an explicit quote/order/invoice parent.');
      next.parent = { domain: number.domain, number: number.number };
    } else {
      if (next.domain !== 'any' && next.domain !== number.domain) conflict('The requested entity type conflicts with the explicit record number.');
      if (next.number && normalizeName(next.number) !== normalizeName(number.number)) conflict('Do not replace an explicit record number.');
      if (next.id) conflict('Use the explicitly requested number rather than a model-selected record UUID.');
      next.domain = number.domain as ResolverDomain; next.number = number.number; next.current = false;
      if (next.query && [number.number, `${number.domain.slice(0,-1)} ${number.number}`].some(t => normalizeName(t) === normalizeName(next.query!))) delete next.query;
    }
  }
  if(anchors.child && (next.task==='propose_component'||next.domain==='components')){
    if(next.query && normalizeName(next.query)!==normalizeName(anchors.child))conflict('Preserve the component name supplied by the user, not a different model-selected component.');
    next.query=anchors.child;
  }
  if (anchors.customer) {
    const target = next.parent ?? next;
    if (target.customer && normalizeName(target.customer) !== normalizeName(anchors.customer)) conflict('Keep the complete customer qualifier supplied by the user.');
    target.customer = anchors.customer;
  }
  if (anchors.component && ['quotes','drafts'].includes(next.domain)) next.contains = anchors.component;
  return next;
}
export function escapeRegex(text: string): string { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
