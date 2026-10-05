/** Deliberately small, whole-utterance grammar. An unmatched qualifier means LLM fallback. */
import type { EntityKind } from '../v2/contracts';

export type RecordRequest = {
  kind: EntityKind;
  selector: 'latest' | 'number' | 'list' | 'current' | 'search';
  query?: string;
  presentation: 'open' | 'read';
};
export type CountRequest = { kind: 'quote' | 'draft_quote'; period: 'all_time' | 'this_month'; owner: 'workspace' | 'me' };
export type FastIntent =
  | { type: 'records'; request: RecordRequest }
  | { type: 'count'; request: CountRequest }
  | { type: 'quote_total'; request: RecordRequest }
  | { type: 'capabilities' };
const kinds: Record<string, EntityKind> = {
  quote: 'quote', quotes: 'quote', draft: 'draft_quote', drafts: 'draft_quote',
  'draft quote': 'draft_quote', 'draft quotes': 'draft_quote',
  order: 'order', orders: 'order', 'material order': 'order', 'material orders': 'order',
  invoice: 'invoice', invoices: 'invoice', component: 'component', components: 'component',
  customer: 'customer', customers: 'customer',
};
const singular = '(draft quote|material order|quote|draft|order|invoice|component|customer)';
const plural = '(draft quotes|material orders|quotes|drafts|orders|invoices|components|customers)';
const verb = '(?:open|show(?: me)?|take me to|go to|pull up)';

export function parseFastIntent(raw: string): FastIntent | null {
  if (raw.length > 240 || /[\r\n\u0000-\u001f]/.test(raw)) return null;
  const text = raw.trim().toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, ' ')
    .replace(/^(?:please |can you |could you )/, '').replace(/(?:,? please)?[.!?]?$/, '');
  let m: RegExpMatchArray | null;
  if (/^(?:what can you (?:do|help me with)|help)$/.test(text)) return { type: 'capabilities' };
  if ((m = text.match(new RegExp(`^${verb} (?:my |the )?(?:latest|most recent|last) ${singular}$`)))) {
    return { type: 'records', request: { kind: kinds[m[1]], selector: 'latest', presentation: 'open' } };
  }
  // 2026-09-26 (owner test): question-form asks ("What's my latest quote",
  // "what is my most recent draft quote") fell through to the LLM - only
  // command verbs matched. Questions want the record read out, not opened.
  if ((m = text.match(new RegExp(`^(?:what's|what is|whats) (?:my |the )?(?:latest|most recent|last) ${singular}$`)))) {
    return { type: 'records', request: { kind: kinds[m[1]], selector: 'latest', presentation: 'read' } };
  }
  if ((m = text.match(new RegExp(`^(?:${verb}|list|find) (?:all |my |the |all my )?${plural}$`)))) {
    return { type: 'records', request: { kind: kinds[m[1]], selector: 'list', presentation: 'read' } };
  }
  if ((m = text.match(new RegExp(`^(?:what are|what's|whats) (?:all |my |the |all my )?${plural}$`)))) {
    return { type: 'records', request: { kind: kinds[m[1]], selector: 'list', presentation: 'read' } };
  }
  if ((m = text.match(new RegExp(`^${verb} (?:the )?${singular} (?:number |#)?([a-z]{0,8}-?\\d{1,12})$`)))) {
    // Components/customers have no unique record-number contract.
    const kind = kinds[m[1]];
    if (kind === 'component' || kind === 'customer' || (['quote', 'draft_quote'].includes(kind) && !/^\d+$/.test(m[2]))) return null;
    return { type: 'records', request: { kind, selector: 'number', query: m[2], presentation: 'open' } };
  }
  if ((m = text.match(new RegExp(`^${verb} (?:this|the current) ${singular}$`)))) {
    return { type: 'records', request: { kind: kinds[m[1]], selector: 'current', presentation: 'open' } };
  }
  if ((m = text.match(/^(?:what's|what is) (?:the )?(?:total|total price|price) (?:of|for|on) (?:my |the )?(latest|most recent|last) (quote|draft|draft quote)$/))) {
    return { type: 'quote_total', request: { kind: kinds[m[2]], selector: 'latest', presentation: 'read' } };
  }
  if ((m = text.match(/^(?:what's|what is) (?:the )?(?:total|total price|price) (?:of|for|on) (this|the current) (quote|draft|draft quote)$/))) {
    return { type: 'quote_total', request: { kind: kinds[m[2]], selector: 'current', presentation: 'read' } };
  }
  if ((m = text.match(/^(?:what's|what is) (?:the )?(?:total|total price|price) (?:of|for|on) (quote|draft|draft quote) (?:number |#)?(\d{1,12})$/))) {
    return { type: 'quote_total', request: { kind: kinds[m[1]], selector: 'number', query: m[2], presentation: 'read' } };
  }
  if ((m = text.match(/^how many (quotes|drafts|draft quotes) did (i|we) create this month$/))) {
    return { type: 'count', request: { kind: kinds[m[1]] as CountRequest['kind'], period: 'this_month', owner: m[2] === 'i' ? 'me' : 'workspace' } };
  }
  if ((m = text.match(/^(?:how many (quotes|drafts|draft quotes) (?:are there|do we have)|count (quotes|drafts|draft quotes))$/))) {
    return { type: 'count', request: { kind: kinds[m[1] || m[2]] as CountRequest['kind'], period: 'all_time', owner: 'workspace' } };
  }
  return null;
}
