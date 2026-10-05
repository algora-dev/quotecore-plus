/** Registered composite identity paths. No table names or join expressions are
 * accepted from a model. Bindings are checked against the existing registry.
 */
import { isRecord, type SectionPermissions } from '../section-permissions';
import { RetrievalError, type QueryPlan, type RetrievalResult } from './contracts';
import { fieldAllowed, sourceAllowed, sourceSpec } from './registry';
import { compileIntelligentPlan } from './semantics';

type Connection = { parent: string; child: string; nameField: string; parentRelation?: string; childRelation?: string };
export const RELATIONSHIPS: Readonly<Record<string, Connection>> = {
  'quotes.components': { parent: 'quotes', child: 'quote_components', nameField: 'name', parentRelation: 'components', childRelation: 'quote' },
  'quotes.areas': { parent: 'quotes', child: 'quote_areas', nameField: 'label', parentRelation: 'areas', childRelation: 'quote' },
  'quotes.customer_lines': { parent: 'quotes', child: 'customer_quote_lines', nameField: 'text', parentRelation: 'customer_lines', childRelation: 'quote' },
  'quotes.orders': { parent: 'quotes', child: 'orders', nameField: 'supplier_name', childRelation: 'quote' },
  'quotes.invoices': { parent: 'quotes', child: 'invoices', nameField: 'customer_name', childRelation: 'quote' },
  'orders.lines': { parent: 'orders', child: 'order_lines', nameField: 'item_name', parentRelation: 'lines' },
  'orders.text_lines': { parent: 'orders', child: 'order_text_lines', nameField: 'text', parentRelation: 'text_lines' },
  'invoices.lines': { parent: 'invoices', child: 'invoice_lines', nameField: 'title', parentRelation: 'lines' },
  'catalogues.rows': { parent: 'catalogues', child: 'catalogue_rows', nameField: 'description', parentRelation: 'rows', childRelation: 'catalogue' },
  'component_collections.components': { parent: 'component_collections', child: 'component_library', nameField: 'name', childRelation: 'collection' },
};
export type IdentitySelector = {
  id?: string; text?: string; current?: boolean;
  quoteScope?: QueryPlan['quoteScope']; owner?: QueryPlan['owner'];
};
export type CompositeSelection = {
  relationship: string; parent: IdentitySelector; child?: { id?: string; text?: string };
  fields?: string[]; limit?: number;
};
export type CompositeResult = RetrievalResult & {
  relationship?: { name: string; parentSource: string; parentId: string; childSource: string; verified: boolean };
  stoppedAt?: 'parent' | 'child';
};
function invalid(message: string): never { throw new RetrievalError('invalid_query', message); }
function object(v: unknown, keys: string[], label: string): Record<string, unknown> {
  if (!isRecord(v) || Object.keys(v).some(k => !keys.includes(k))) invalid(`Invalid ${label}; unknown keys are not ignored.`);
  return v;
}
function selector(v: unknown, parent: boolean): IdentitySelector {
  const x = object(v, parent ? ['id', 'text', 'current', 'quoteScope', 'owner'] : ['id', 'text'], 'identity selector');
  const count = Number(x.id !== undefined) + Number(x.text !== undefined) + Number(x.current === true);
  if (count !== 1 || (x.current !== undefined && x.current !== true)) invalid('Choose exactly one identity hint: id, text, or current=true for the parent.');
  if (x.id !== undefined && (typeof x.id !== 'string' || !x.id || x.id.length > 150)) invalid('Use a bounded record identity.');
  if (x.text !== undefined && (typeof x.text !== 'string' || !x.text.trim() || x.text.length > 120 || /[\u0000-\u001f]/.test(x.text))) invalid('Use a short non-empty record name.');
  return x as IdentitySelector;
}
export function connectionFor(name: string): Connection {
  if (!Object.hasOwn(RELATIONSHIPS, name)) throw new RetrievalError('unsupported_field', 'That parent/child relationship is not registered.');
  const c = RELATIONSHIPS[name], p = sourceSpec(c.parent), child = sourceSpec(c.child);
  if (!child.fields[c.nameField] || child.fields[c.nameField].type !== 'text') throw new RetrievalError('setup_required', 'The composite identity registry is inconsistent.');
  if (c.childRelation) {
    const r = child.relations[c.childRelation];
    if (!r || r.source !== c.parent || r.foreign !== 'id') throw new RetrievalError('setup_required', 'The reverse identity relationship is inconsistent.');
  } else {
    const r = p.relations[c.parentRelation!];
    if (!r || r.source !== c.child || r.local !== 'id' || !child.fields[r.foreign]) throw new RetrievalError('setup_required', 'The forward identity relationship is inconsistent.');
  }
  return c;
}
export function visibleRelationships(permissions: SectionPermissions, catalogues: boolean): string[] {
  return Object.keys(RELATIONSHIPS).filter(name => {
    const c = connectionFor(name), p = sourceSpec(c.parent), child = sourceSpec(c.child);
    return sourceAllowed(p, permissions) && sourceAllowed(child, permissions) && fieldAllowed(child.fields[c.nameField], permissions)
      && (catalogues || (p.feature !== 'catalogs' && child.feature !== 'catalogs'));
  });
}
export function parseCompositeSelection(raw: unknown, permissions: SectionPermissions, catalogues: boolean): CompositeSelection {
  if (JSON.stringify(raw)?.length > 12_000) invalid('The composite selection is too large.');
  const x = object(raw, ['relationship', 'parent', 'child', 'fields', 'limit'], 'composite selection');
  if (typeof x.relationship !== 'string') invalid('Choose a registered relationship.');
  const c = connectionFor(x.relationship);
  if (!sourceAllowed(sourceSpec(c.parent), permissions) || !sourceAllowed(sourceSpec(c.child), permissions)) throw new RetrievalError('permission_denied', 'Both sides of this relationship require visible assistant sections. No records were searched.');
  if (!catalogues && [sourceSpec(c.parent), sourceSpec(c.child)].some(s => s.feature === 'catalogs')) throw new RetrievalError('feature_disabled', 'Catalogue access is not enabled by this workspace entitlement.');
  const parent = selector(x.parent, true), child = x.child === undefined ? undefined : selector(x.child, false);
  if (x.fields !== undefined && (!Array.isArray(x.fields) || x.fields.length > 16 || !x.fields.every(v => typeof v === 'string'))) invalid('Choose at most sixteen registered child fields.');
  if (x.limit !== undefined && (!Number.isInteger(x.limit) || Number(x.limit) < 1 || Number(x.limit) > 20)) invalid('Choose a result limit from 1 to 20.');
  const selection = { relationship: x.relationship, parent, ...(child ? { child } : {}), ...(x.fields ? { fields: x.fields as string[] } : {}), ...(x.limit ? { limit: Number(x.limit) } : {}) };
  // Validate BOTH shapes/permissions before the first data read, even if the
  // parent would turn out to be ambiguous. The temporary UUID is never queried.
  parentPlan(selection, permissions);
  childPlan(selection, '00000000-0000-0000-0000-000000000000', permissions);
  return selection;
}
export function parentPlan(selection: CompositeSelection, permissions: SectionPermissions): QueryPlan {
  const c = connectionFor(selection.relationship), s = selection.parent;
  return compileIntelligentPlan({ version: 1, source: c.parent, mode: 'rows', resolve: true,
    ...(s.id ? { filters: [{ field: 'id', op: 'eq', value: s.id }] } : {}),
    ...(s.text ? { search: { text: s.text, match: 'natural' } } : {}), ...(s.current ? { current: true } : {}),
    ...(s.quoteScope ? { quoteScope: s.quoteScope } : {}), ...(s.owner ? { owner: s.owner } : {}),
  }, permissions).plan;
}
export function childPlan(selection: CompositeSelection, parentId: string, permissions: SectionPermissions): QueryPlan {
  const c = connectionFor(selection.relationship), p = sourceSpec(c.parent), child = selection.child;
  const binding = c.childRelation
    ? { related: [{ relation: c.childRelation, filters: [{ field: 'id', op: 'eq', value: parentId }] }] }
    : { filters: [{ field: p.relations[c.parentRelation!].foreign, op: 'eq', value: parentId }] };
  const filters = [...(binding.filters ?? []), ...(child?.id ? [{ field: 'id', op: 'eq', value: child.id }] : [])];
  return compileIntelligentPlan({ version: 1, source: c.child, mode: 'rows', ...binding, filters,
    ...(child?.text ? { search: { text: child.text, match: 'natural', field: c.nameField } } : {}),
    ...(sourceSpec(c.child).quoteScoped && selection.parent.quoteScope ? { quoteScope: selection.parent.quoteScope } : {}),
    ...(selection.fields ? { fields: selection.fields } : {}), resolve: !!child, limit: selection.limit ?? 10,
  }, permissions).plan;
}
/** Only authoritative resolver results select a parent. Display labels/recency
 * are not a second source of identity. A bounded list is never a unique match.
 */
export function selectedRow(result: RetrievalResult): Record<string, unknown> | null {
  return result.state === 'ok' && result.complete && result.resolution?.state === 'selected' && result.rows.length === 1 ? result.rows[0] : null;
}
