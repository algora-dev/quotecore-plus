/** Small explicit business vocabulary, NOT fuzzy SQL generation.
 * Every expanded plan still passes the existing field/permission compiler and
 * database validation. Normalisation never removes tenant/parent/date filters.
 */
import { isRecord, type SectionPermissions } from '../section-permissions';
import { RetrievalError, type QueryPlan } from './contracts';
import { parseQueryPlan, sourceSpec } from './registry';

export const STATUS_VALUES = {
  quotes: ['draft', 'confirmed', 'sent', 'accepted', 'declined', 'expired', 'archived'],
  invoices: ['draft', 'sent', 'viewed', 'payment_reported', 'paid', 'disputed', 'cancelled'],
  orders: ['ready', 'ordered'],
} as const;
export const CONCEPTS = ['unpaid_invoices'] as const;
const ALIASES: Record<string, Record<string, string>> = {
  quotes: { quote_value: 'customer_total', saved_quote_total: 'customer_total', current_builder_total: 'builder_total' },
  invoices: { invoice_total: 'total' },
};
const own = (o: object, key: string) => Object.hasOwn(o, key);
function invalid(message: string): never { throw new RetrievalError('invalid_query', message); }

export type NormalizedPlan = { plan: QueryPlan; normalizations: string[] };
export function compileIntelligentPlan(raw: unknown, permissions: SectionPermissions, knowledge = false): NormalizedPlan {
  // Bound the original input BEFORE expansion, including rejected extra keys.
  if (!isRecord(raw) || JSON.stringify(raw).length > 12_000) invalid('Use one bounded version-1 retrieval plan.');
  const source = typeof raw.source === 'string' ? raw.source : '';
  const spec = sourceSpec(source);
  const notes = new Set<string>();
  const alias = (name: unknown, sourceName: string): unknown => {
    if (typeof name !== 'string') return name;
    const map = ALIASES[sourceName];
    if (map && own(map, name)) { notes.add('canonical_field_alias'); return map[name]; }
    return name;
  };
  const unpaid = () => [
    { field: 'paid_at', op: 'is_null', value: true },
    { field: 'status', op: 'neq', value: 'cancelled' },
  ];
  const normalizeFilters = (value: unknown, sourceName: string): unknown => {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 8) return value; // strict compiler supplies the error
    return value.flatMap(item => {
      if (!isRecord(item)) return [item];
      const f: Record<string, unknown> = { ...item, field: alias(item.field, sourceName) };
      const statusDomain = f.field === 'quote_status' ? STATUS_VALUES.quotes
        : f.field === 'status' && own(STATUS_VALUES, sourceName) ? STATUS_VALUES[sourceName as keyof typeof STATUS_VALUES] : null;
      if (!statusDomain || f.op === 'is_null') return [f];
      // Unknown keys must not disappear when one filter expands into two.
      if (Object.keys(f).some(k => !['field', 'op', 'value'].includes(k))) invalid('Unknown status-filter keys are not ignored.');
      const normalizeStatus = (v: unknown): unknown => typeof v === 'string' ? v.trim().toLowerCase() : v;
      const values = f.op === 'in' && Array.isArray(f.value) ? f.value.map(normalizeStatus) : [normalizeStatus(f.value)];
      const isUnpaid = (v: unknown) => typeof v === 'string' && ['unpaid', 'not paid', 'not_paid'].includes(v);
      if (sourceName === 'invoices' && values.some(isUnpaid)) {
        if ((f.op !== 'eq' && f.op !== 'in') || values.length !== 1) invalid('Use concepts:["unpaid_invoices"] alone, or explicit canonical status filters. Negating or mixing "unpaid" needs a different predicate; it is not an invoice status.');
        notes.add('unpaid_invoice_predicate');
        return unpaid();
      }
      if (!['eq', 'neq', 'in'].includes(String(f.op))) invalid('Use eq, neq or in with a documented status, not fuzzy status matching.');
      if (values.some(v => typeof v !== 'string' || !(statusDomain as readonly string[]).includes(v))) invalid(`Unsupported ${sourceName} status. Allowed values: ${statusDomain.join(', ')}. For unpaid invoices use concepts:["unpaid_invoices"]; do not invent open/due/overdue statuses.`);
      const normalizedValue = f.op === 'in' ? values : values[0];
      if (JSON.stringify(f.value) !== JSON.stringify(normalizedValue)) notes.add('canonical_status_case');
      return [{ ...f, value: normalizedValue }];
    });
  };
  const normalized: Record<string, unknown> = { ...raw, filters: normalizeFilters(raw.filters, source) };
  if (raw.concepts !== undefined) {
    if (!Array.isArray(raw.concepts) || raw.concepts.length > 3 || !raw.concepts.every(c => c === 'unpaid_invoices')) invalid('Unsupported business concept. Currently the explicit concept is unpaid_invoices.');
    if (raw.concepts.length && source !== 'invoices') invalid('unpaid_invoices applies only to invoices. No source was substituted.');
    if (raw.concepts.length) {
      if (!Array.isArray(normalized.filters)) invalid('Filters must be an array.');
      normalized.filters = [...normalized.filters, ...unpaid()];
      notes.add('unpaid_invoice_predicate');
    }
    delete normalized.concepts;
  }
  if (Array.isArray(normalized.filters)) {
    // Deduplicate exact predicates, never weaken distinct constraints.
    normalized.filters = [...new Map(normalized.filters.map(f => [JSON.stringify(f), f])).values()];
    const fs = normalized.filters as Record<string, unknown>[];
    if (source === 'invoices' && notes.has('unpaid_invoice_predicate') && fs.some(f => isRecord(f) &&
      ((f.field === 'paid_at' && f.op === 'is_null' && f.value === false) ||
       (f.field === 'status' && f.op === 'eq' && ['paid', 'cancelled'].includes(String(f.value)))))) invalid('The unpaid-invoice concept conflicts with a paid/cancelled predicate. Choose which set you want; no conflicting filter was discarded.');
  }
  for (const key of ['fields', 'groupBy']) if (Array.isArray(raw[key])) normalized[key] = (raw[key] as unknown[]).map(v => alias(v, source));
  for (const key of ['metrics', 'orderBy']) if (Array.isArray(raw[key])) normalized[key] = (raw[key] as unknown[]).map(v => {
    if (!isRecord(v)) return v;
    const item = { ...v };
    if (own(item, 'field')) item.field = alias(item.field, source);
    if (key === 'metrics' && item.op === 'average') { item.op = 'avg'; notes.add('canonical_average_operator'); }
    return item;
  });
  if (Array.isArray(raw.related)) normalized.related = raw.related.map(value => {
    if (!isRecord(value) || typeof value.relation !== 'string' || !own(spec.relations, value.relation)) return value;
    const relatedSource = spec.relations[value.relation].source;
    const relation: Record<string, unknown> = { ...value, filters: normalizeFilters(value.filters, relatedSource) };
    if (isRecord(value.search) && value.search.match === 'natural') {
      // Exact same text, stricter membership; no qualifier is removed.
      relation.search = { ...value.search, match: 'words' };
      notes.add('related_search_constrained_to_words');
    }
    return relation;
  });
  // First pass proves all names and permissions before adding dimensions needed
  // to interpret a ranked list. Quotes cannot rank by a hidden builder total.
  let plan = parseQueryPlan(normalized, permissions, knowledge, true);
  if (plan.mode === 'rows' && plan.orderBy.length) {
    const first = spec.fields[plan.orderBy[0].field];
    if (first.type === 'number') {
      if (plan.search?.match === 'natural') invalid('A numeric ranking needs a definite matching set. Use words/exact search or resolve the named record first; fuzzy relevance is not value ordering.');
      const fields = [...new Set([...plan.fields, ...plan.orderBy.map(o => o.field)])];
      plan = parseQueryPlan({ ...plan, fields }, permissions, knowledge, true);
    }
  }
  return { plan, normalizations: [...notes] };
}
