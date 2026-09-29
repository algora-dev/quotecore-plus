/** Adapter metadata over the EXISTING business registry. No physical tables,
 * SQL, tenancy selectors or price formulas are added to the resolver API. */
import type { SectionPermissions } from '../section-permissions';
import { fieldAllowed, sourceAllowed, sourceSpec } from '../retrieval/registry';
import { compileIntelligentPlan } from '../retrieval/semantics';
import { RetrievalError, type Filter, type QueryPlan } from '../retrieval/contracts';
import type { RecordTarget } from '../v2/contracts';
import type { CandidateRef, Parent, ResolverIntent } from './contracts';
import { componentWords, componentSource } from './vocabulary';
import { companyScoped } from './anchors';
import { RESOLVER_LIMITS } from './config';

export const SOURCE_ADAPTERS = {
  quotes: { name: ['job_name','customer_name'], number: 'quote_number', parent: null, domain: 'quotes', caption: 'Quote or draft' },
  orders: { name: ['job_name','reference','supplier_name'], number: 'order_number', parent: null, domain: 'orders', caption: 'Material order' },
  invoices: { name: ['customer_name'], number: 'invoice_number', parent: null, domain: 'invoices', caption: 'Invoice' },
  quote_components: { name: ['name'], number: null, parent: 'quote_id', domain: 'components', caption: 'Placed quote component' },
  customer_quote_lines: { name: ['text'], number: null, parent: 'quote_id', domain: 'components', caption: 'Saved customer quote line' },
  quote_areas: { name: ['label'], number: null, parent: 'quote_id', domain: 'components', caption: 'Quote area' },
  component_library: { name: ['name','sku'], number: null, parent: null, domain: 'library', caption: 'Component library' },
  component_collections: { name: ['name'], number: null, parent: null, domain: 'library', caption: 'Library collection' },
  order_lines: { name: ['item_name'], number: null, parent: 'order_id', domain: 'orders', caption: 'Material order line' },
  order_text_lines: { name: ['text'], number: null, parent: 'order_id', domain: 'orders', caption: 'Line-by-line material order' },
  invoice_lines: { name: ['title','description'], number: null, parent: 'invoice_id', domain: 'invoices', caption: 'Invoice line' },
  catalogues: { name: ['name','original_filename'], number: null, parent: null, domain: 'catalogues', caption: 'Catalogue' },
  catalogue_rows: { name: ['description'], number: null, parent: 'catalogue_id', domain: 'catalogues', caption: 'Catalogue item' },
} as const;
export type ResolverSource = keyof typeof SOURCE_ADAPTERS;
export function adapter(name: string) {
  if (!Object.hasOwn(SOURCE_ADAPTERS, name)) throw new RetrievalError('unsupported_source', 'This record kind is not an entity-resolution source. Use the registered query reader for other information.');
  return SOURCE_ADAPTERS[name as ResolverSource];
}
const metadata = ['id','quote_id','order_id','invoice_id','catalogue_id','quote_number','quote_status','status','order_number','invoice_number','customer_name','job_name','supplier_name','collection_name','catalogue_name','created_at','updated_at','is_active'];
export function identityFields(source: string, permissions: SectionPermissions): string[] {
  const a = adapter(source), s = sourceSpec(source);
  return [...new Set(['id', ...a.name, ...(a.number ? [a.number] : []), ...metadata])]
    .filter(k => s.fields[k] && fieldAllowed(s.fields[k], permissions)).slice(0, 16);
}
export function factFields(source: string, task: ResolverIntent['task'], permissions: SectionPermissions): string[] {
  const fields: Record<string, string[]> = {
    quotes: ['id','quote_number','job_name','customer_name','status','customer_total','currency','updated_at'],
    quote_components: ['id','name','quote_id','quote_number','quote_status','job_name','customer_name','unit','material_rate','labour_rate','material_cost','labour_cost','final_quantity','pricing_unit','priced_quantity','currency'],
    quote_areas: ['id','label','quote_id','quote_number','job_name','computed_sqm','plan_sqm','pitch_degrees','is_locked','updated_at'],
    customer_quote_lines: ['id','text','quote_id','quote_number','quote_status','job_name','customer_name','amount','unit_price','quantity_text','currency','is_visible','include_in_total'],
    component_library: ['id','name','collection_name','default_material_rate','default_labour_rate','unit','currency','pricing_strategy','pack_size','pack_price','is_active'],
    order_lines: ['id','item_name','order_id','order_number','job_name','quantity','unit','measurement_display','priced_quantity'],
    order_text_lines: ['id','text','order_id','order_number','job_name','quantity_text','saved_amount','saved_unit_price','saved_quantity'],
    invoice_lines: ['id','title','invoice_id','invoice_number','customer_name','quantity','unit','unit_price','line_total','currency','is_visible','include_in_total'],
    invoices: ['id','invoice_number','customer_name','status','total','currency','due_date','paid_at'],
    catalogue_rows: ['id','description','catalogue_id','catalogue_name','row_index','mapped_price_text','mapped_quantity_text','currency'],
  };
  const s = sourceSpec(source);
  // Roof areas are a value source: their facts (m2/pitch) are the answer even
  // for a plain find, not only cost/charge tasks.
  return (task === 'cost' || task === 'charge' || source === 'quote_areas' ? fields[source] ?? identityFields(source, permissions) : identityFields(source, permissions))
    .filter(k => s.fields[k] && fieldAllowed(s.fields[k], permissions));
}
export function visibleResolverSources(permissions: SectionPermissions, catalogues: boolean): ResolverSource[] {
  return (Object.keys(SOURCE_ADAPTERS) as ResolverSource[]).filter(name => sourceAllowed(sourceSpec(name), permissions) && (catalogues || sourceSpec(name).feature !== 'catalogs'));
}
export function sourcesFor(intent: ResolverIntent, visible: ResolverSource[], parent?: Parent): ResolverSource[] {
  let names: ResolverSource[];
  const itemRequest = ['cost','charge','propose_component'].includes(intent.task) && !!intent.query || intent.domain === 'components';
  if ((intent.number || intent.id || intent.current) && ['quotes','drafts','orders','invoices'].includes(intent.domain) && !parent) names = [intent.domain === 'drafts' ? 'quotes' : intent.domain] as ResolverSource[];
  else if (!parent && ['quotes','drafts'].includes(intent.domain)) names = ['quotes'];
  else if (intent.task === 'propose_component') names = ['quote_components'];
  else if (intent.task === 'charge') names = parent?.domain === 'invoices' || intent.domain === 'invoices' ? ['invoice_lines'] : ['customer_quote_lines','invoice_lines'];
  else if (parent) {
    names = parent.domain === 'orders' ? ['order_lines','order_text_lines'] : parent.domain === 'invoices' ? ['invoice_lines']
      : intent.task === 'cost' ? ['quote_components','customer_quote_lines'] : ['quote_components','customer_quote_lines','quote_areas'];
  } else if (intent.domain === 'quotes' || intent.domain === 'drafts') names = ['quotes'];
  else if (intent.domain === 'orders') names = itemRequest ? ['orders','order_lines','order_text_lines'] : ['orders'];
  else if (intent.domain === 'invoices') names = itemRequest ? ['invoices','invoice_lines'] : ['invoices'];
  else if (intent.domain === 'library') names = intent.task === 'cost' ? ['component_library'] : ['component_library','component_collections'];
  else if (intent.domain === 'catalogues') names = intent.task === 'cost' ? ['catalogue_rows'] : ['catalogues','catalogue_rows'];
  else if (intent.domain === 'components') names = ['quote_components','customer_quote_lines','component_library','order_lines','order_text_lines','invoice_lines','catalogue_rows'];
  else names = intent.task === 'cost' ? ['quote_components','customer_quote_lines','component_library','order_lines','order_text_lines','invoice_lines','catalogue_rows','quotes','orders','invoices']
    : ['quotes','orders','invoices','quote_components','customer_quote_lines','quote_areas','component_library','component_collections','order_lines','order_text_lines','invoice_lines','catalogues','catalogue_rows'];
  return names.filter(n => visible.includes(n));
}
export function qualifiers(source: string, intent: Pick<ResolverIntent,'customer'|'job'|'period'>): { filters: Filter[]; related: QueryPlan['related'] } {
  const spec = sourceSpec(source), filters: Filter[] = [], related: QueryPlan['related'] = [];
  for (const [key, field] of [['customer','customer_name'],['job','job_name']] as const) {
    if (!intent[key]) continue;
    if (spec.fields[field] && !spec.fields[field].internal) filters.push({ field, op: 'words', value: intent[key]! });
    else if (spec.relations.quote) {
      let relation = related.find(r => r.relation === 'quote');
      if (!relation) { relation = { relation: 'quote', filters: [] }; related.push(relation); }
      relation.filters.push({ field, op: 'words', value: intent[key]! });
    } else if (companyScoped(source)) {
      // Company-scoped library/catalogue sources carry no customer/job dimension
      // and require no resolved parent (draft creation queries prices before any
      // parent record exists). The qualifier does not apply; the query stands.
    } else throw new RetrievalError('unsupported_field', `The ${source} reader cannot preserve this ${key} qualifier without a parent. Select the parent record first.`);
  }
  if (intent.period) {
    const p = intent.period;
    const field = p.basis === 'ordered' ? 'order_date' : p.basis === 'updated' ? 'updated_at' : 'created_at';
    if (!spec.fields[field]) throw new RetrievalError('unsupported_field', `This source has no registered ${p.basis} date. The date constraint was not dropped.`);
    const isDate = spec.fields[field].type === 'date';
    filters.push({ field, op: 'gte', value: isDate ? p.from.slice(0,10) : p.from }, { field, op: 'lt', value: isDate ? p.to.slice(0,10) : p.to });
  }
  return { filters, related };
}
export function parentQuery(parent: Parent, permissions: SectionPermissions): QueryPlan {
  const source = parent.domain === 'drafts' ? 'quotes' : parent.domain;
  const a = adapter(source), q = qualifiers(source, parent);
  if (parent.id) q.filters.push({ field: 'id', op: 'eq', value: parent.id });
  if (parent.number) q.filters.push({ field: a.number!, op: 'eq', value: source === 'quotes' ? Number(parent.number) : parent.number });
  return compileIntelligentPlan({ version: 1, source, mode: 'rows', fields: identityFields(source, permissions),
    ...q, ...(parent.text ? { search: { text: parent.text, match: 'words' } } : {}), current: !!parent.current,
    quoteScope: source === 'quotes' ? parent.quoteScope ?? (parent.domain === 'drafts' ? 'drafts' : 'quotes') : 'all_permitted', resolve: false, limit: RESOLVER_LIMITS.rowsPerSource,
  }, permissions).plan;
}
export function discoveryQuery(source: string, intent: ResolverIntent, permissions: SectionPermissions, parentId?: string, match: 'words'|'natural' = 'words'): QueryPlan {
  const a = adapter(source), spec = sourceSpec(source);
  const q = qualifiers(source, intent);
  if (parentId) {
    if (!a.parent) throw new RetrievalError('invalid_query', 'This source has no registered parent identity.');
    q.filters.push({ field: a.parent, op: 'eq', value: parentId });
  }
  if (intent.id) q.filters.push({ field: 'id', op: 'eq', value: intent.id });
  if (intent.number) {
    if (!a.number) throw new RetrievalError('invalid_query', 'The exact number needs its header source.');
    q.filters.push({ field: a.number, op: 'eq', value: source === 'quotes' ? Number(intent.number) : intent.number });
  }
  if (intent.contains && source === 'quotes') q.related.push({ relation: 'components', filters: [{ field: 'name', op: 'words', value: componentWords(intent.contains) }] });
  let search: { text: string; match: 'words'|'natural'; field?: string } | undefined;
  if (intent.query && !intent.contains) search = { text: componentSource(source) ? componentWords(intent.query) : intent.query, match,
    // A parent name in a child's _search is not evidence that the child name matches.
    ...(a.name.length === 1 && source !== 'catalogue_rows' ? { field: a.name[0] } : {}) };
  return compileIntelligentPlan({ version: 1, source, mode: 'rows', fields: identityFields(source, permissions), ...q,
    ...(search ? { search } : {}), quoteScope: spec.quoteScoped ? (intent.parent?.quoteScope ?? (intent.parent?.domain === 'drafts' || intent.domain === 'drafts' ? 'drafts' : intent.domain === 'quotes' || intent.parent?.domain === 'quotes' ? 'quotes' : 'all_permitted')) : 'all_permitted',
    ...(intent.selection ? { orderBy: [{field:'created_at',direction:intent.selection==='latest'?'desc':'asc'}, {field:'id',direction:'asc'}] } : {}),
    limit: intent.selection ? 1 : RESOLVER_LIMITS.rowsPerSource, resolve: false, current: !!intent.current,
  }, permissions).plan;
}
export function rereadQuery(ref: CandidateRef, intent: ResolverIntent, permissions: SectionPermissions, facts: boolean): QueryPlan {
  const a = adapter(ref.source);
  const q = qualifiers(ref.source, intent);
  q.filters.push({ field: 'id', op: 'eq', value: ref.id });
  if (intent.number && a.number) q.filters.push({ field: a.number, op: 'eq', value: ref.source === 'quotes' ? Number(intent.number) : intent.number });
  if (ref.parentId && a.parent) q.filters.push({ field: a.parent, op: 'eq', value: ref.parentId });
  if (intent.contains && ref.source === 'quotes') q.related.push({ relation: 'components', filters: [{ field: 'name', op: 'words', value: componentWords(intent.contains) }] });
  return compileIntelligentPlan({ version: 1, source: ref.source, mode: 'rows', fields: facts ? factFields(ref.source, intent.task, permissions) : identityFields(ref.source, permissions), ...q,
    quoteScope: sourceSpec(ref.source).quoteScoped ? intent.parent?.quoteScope ?? (intent.domain === 'drafts' || intent.parent?.domain === 'drafts' ? 'drafts' : intent.domain === 'quotes' || intent.parent?.domain === 'quotes' ? 'quotes' : 'all_permitted') : 'all_permitted', resolve: false, limit: 2,
  }, permissions).plan;
}
export function currentParent(target: RecordTarget | null): Parent | null {
  if (!target) return null;
  const domain = target.kind === 'draft_quote' ? 'drafts' : target.kind === 'quote' ? 'quotes' : target.kind === 'order' ? 'orders' : target.kind === 'invoice' ? 'invoices' : null;
  return domain ? { domain, id: target.id, ...(target.kind==='quote'?{quoteScope:'all_permitted' as const}:{}) } : null;
}
