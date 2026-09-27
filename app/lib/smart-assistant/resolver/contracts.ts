import { isRecord, type AssistantSection } from '../section-permissions';
import { isUuid } from '../v2/contracts';
import { RetrievalError, type QueryRow } from '../retrieval/contracts';

export const DOMAINS = ['any', 'quotes', 'drafts', 'orders', 'invoices', 'components', 'library', 'catalogues'] as const;
export type ResolverDomain = typeof DOMAINS[number];
export type ReadTask = 'find' | 'open' | 'cost' | 'charge';
export type Period = { from: string; to: string; basis: 'created' | 'updated' | 'ordered'; label: string };
export type Parent = { domain: 'quotes' | 'drafts' | 'orders' | 'invoices'; id?: string; number?: string; text?: string; current?: true; customer?: string; job?: string; quoteScope?: 'quotes'|'drafts'|'all_permitted' };
export type ProposalInput = { changes: Record<string, unknown>; quantity_unit: string | null; rate_unit: string | null };
export type ResolverIntent = {
  version: 1; task: ReadTask | 'propose_component'; domain: ResolverDomain;
  query?: string; id?: string; number?: string; parent?: Parent;
  customer?: string; job?: string; period?: Period; current?: boolean;
  contains?: string; nameOrContents?: boolean; list?: boolean;
  include?: ('orders' | 'invoices')[];
  /** Server-only: this operation is supplied by the existing P3 adapter. */
  proposal?: ProposalInput;
};
export type QuestionKey = 'domain' | 'parent' | 'customer' | 'job' | 'date' | 'name';
export type ResolutionStatus = 'resolved' | 'candidates' | 'needs_discriminator' | 'no_meaningful_match' | 'not_found'
  | 'permission_denied' | 'feature_disabled' | 'setup_required' | 'read_failed' | 'too_broad' | 'expired' | 'cancelled' | 'proposal_refused';
export type Evidence = { level: 'identity' | 'exact' | 'phrase' | 'words' | 'spelling'; score: number; reasons: string[] };
export type CandidateRef = {
  choiceId: string; key: string; source: string; id: string; parentId?: string;
  stage: 'parent' | 'entity'; label: string; detail: string;
  /** Bounded identity metadata, never cached financial answers. */
  names: string[]; customer?: string; job?: string; date?: string;
};
export type Candidate = CandidateRef & { evidence: Evidence; row: QueryRow };
export type DiscoveryCoverage = {
  searched: string[]; failed: string[]; truncated: string[]; skipped: string[];
  reads: number; broadened: boolean;
};
export type ResolverResult = {
  state: ResolutionStatus; answer: string; candidates: CandidateRef[];
  question?: { key: QuestionKey; text: string }; canClarify: boolean;
  coverage: DiscoveryCoverage; cardId?: string; stateId?: string;
  selected?: { source: string; id: string; parentId?: string };
  applied: false; proposalPrepared?: boolean;
};
export type ResolutionState = {
  version: 1; status: 'pending' | 'resolved' | 'closed'; intent: ResolverIntent;
  candidates: CandidateRef[]; rejected: string[]; clarifications: number;
  question: { key: QuestionKey; text: string }; previousStateId?: string;
  /** True only when the entire credible first-pass candidate population was saved. */
  candidateSetComplete?: boolean;
};
export type StoredResolution = { id: string; expiresAt: string; state: ResolutionState };

export function bounded(value: unknown, max = 120): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\u0000-\u001f]/u.test(value);
}
function invalid(message: string): never { throw new RetrievalError('invalid_query', message); }
export function strictObject(value: unknown, keys: readonly string[], what: string): Record<string, unknown> {
  if (!isRecord(value) || Object.keys(value).some(k => !keys.includes(k))) invalid(`Invalid ${what}; unknown qualifiers are not ignored.`);
  return value;
}
export function parseParent(value: unknown): Parent {
  const p = strictObject(value, ['domain', 'id', 'number', 'text', 'current', 'customer', 'job', 'quoteScope'], 'parent selector');
  if (!['quotes', 'drafts', 'orders', 'invoices'].includes(String(p.domain))) invalid('Choose a quote, draft, order or invoice parent.');
  if ([p.id !== undefined, p.number !== undefined, p.text !== undefined, p.current === true].filter(Boolean).length !== 1) invalid('A parent needs exactly one ID, number, name or current-page hint.');
  if (p.id !== undefined && !isUuid(p.id)) invalid('A parent ID must be a UUID returned by this workspace.');
  for (const key of ['text', 'number', 'customer', 'job']) if (p[key] !== undefined && !bounded(p[key], key === 'number' ? 60 : 120)) invalid(`Invalid parent ${key}.`);
  if (p.current !== undefined && p.current !== true) invalid('Use current=true only for an explicit page hint.');
  if (p.domain === 'drafts' && p.number !== undefined) invalid('Drafts have names, not quote numbers.');
  if (p.domain === 'quotes' && p.number !== undefined && !/^[1-9]\d{0,9}$/.test(String(p.number))) invalid('Use the exact positive quote number.');
  if (p.quoteScope !== undefined && (!['quotes','drafts'].includes(String(p.domain)) || !['quotes','drafts','all_permitted'].includes(String(p.quoteScope)) || (p.domain === 'drafts' && p.quoteScope !== 'drafts'))) invalid('Invalid parent quote scope.');
  return p as Parent;
}
/** Strict public read contract. Mutation inputs and policy/tenant IDs are absent. */
export function parseResolverIntent(value: unknown): ResolverIntent {
  if (JSON.stringify(value)?.length > 6_000) invalid('The entity request is too large.');
  const v = strictObject(value, ['version', 'task', 'domain', 'query', 'id', 'number', 'parent', 'customer', 'job', 'period', 'current', 'contains', 'list', 'include'], 'entity request');
  if (v.version !== 1 || !['find', 'open', 'cost', 'charge'].includes(String(v.task)) || !DOMAINS.includes(v.domain as ResolverDomain)) invalid('Choose a registered read task and business domain.');
  for (const key of ['query', 'customer', 'job', 'number', 'contains']) if (v[key] !== undefined && !bounded(v[key], key === 'number' ? 60 : 120)) invalid(`Invalid ${key} clue.`);
  if (v.id !== undefined && !isUuid(v.id)) invalid('Use a UUID from an authorised result.');
  if (v.number !== undefined && !['quotes', 'orders', 'invoices'].includes(String(v.domain))) invalid('An exact number needs its quote/order/invoice domain.');
  if (v.domain === 'quotes' && v.number !== undefined && !/^[1-9]\d{0,9}$/.test(String(v.number))) invalid('Use the exact positive quote number.');
  if (v.number !== undefined && v.id !== undefined) invalid('Choose one exact identity, not two.');
  for (const key of ['current', 'list']) if (v[key] !== undefined && typeof v[key] !== 'boolean') invalid(`Invalid ${key} flag.`);
  if (v.contains !== undefined && !['quotes', 'drafts'].includes(String(v.domain))) invalid('The contains clue currently describes components within quotes or drafts.');
  if (v.include !== undefined && (!Array.isArray(v.include) || v.include.length > 2 || new Set(v.include).size !== v.include.length || v.include.some(x => !['orders', 'invoices'].includes(String(x))) || !['quotes', 'drafts'].includes(String(v.domain)))) invalid('Related status expansion is registered only for quotes/drafts → orders/invoices.');
  const parent = v.parent === undefined ? undefined : parseParent(v.parent);
  let period: Period | undefined;
  if (v.period !== undefined) {
    const p = strictObject(v.period, ['from', 'to', 'basis', 'label'], 'date range');
    const iso = (x: unknown): x is string => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(x) && Number.isFinite(Date.parse(x)) && new Date(x).toISOString() === x;
    if (!iso(p.from) || !iso(p.to) || p.from >= p.to || !['created', 'updated', 'ordered'].includes(String(p.basis)) || !bounded(p.label, 100)) invalid('Use a finite, labelled UTC calendar range.');
    period = p as Period;
  }
  return { ...v, ...(parent ? { parent } : {}), ...(period ? { period } : {}) } as ResolverIntent;
}
export function candidateKey(source: string, id: string, parentId?: string): string {
  // Order-text line IDs are not globally unique; the parent is part of identity.
  return `${source}:${parentId ?? ''}:${id}`;
}
export function parseCandidateRef(value: unknown): CandidateRef | null {
  if (!isRecord(value) || Object.keys(value).some(k => !['choiceId','key','source','id','parentId','stage','label','detail','names','customer','job','date'].includes(k))
      || !isUuid(value.choiceId) || !bounded(value.source, 60) || !bounded(value.id, 150)
      || (value.parentId !== undefined && !isUuid(value.parentId)) || !['parent','entity'].includes(String(value.stage))
      || !bounded(value.label, 300) || typeof value.detail !== 'string' || value.detail.length > 600
      || !Array.isArray(value.names) || value.names.length > 8 || value.names.some(n => !bounded(n, 300))) return null;
  for (const key of ['customer','job','date']) if (value[key] !== undefined && !bounded(value[key], 300)) return null;
  if (value.key !== candidateKey(value.source, value.id, value.parentId as string | undefined)) return null;
  return value as CandidateRef;
}
export function sourceSections(sources: string[], quoteScope: ResolverDomain): AssistantSection[] {
  const sections = new Set<AssistantSection>();
  for (const source of sources) {
    if (['quotes','quote_components','quote_areas','customer_quote_lines'].includes(source)) {
      if (quoteScope !== 'drafts') sections.add('quotes');
      if (quoteScope !== 'quotes') sections.add('draft_quotes');
    }
    if (['quote_components','component_library','component_collections','catalogues','catalogue_rows'].includes(source)) sections.add('components');
    if (source.startsWith('order')) sections.add('orders');
    if (source.startsWith('invoice')) sections.add('invoices');
  }
  return [...sections];
}
