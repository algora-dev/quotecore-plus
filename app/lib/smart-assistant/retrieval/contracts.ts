/** Constrained read plan. Tenant IDs, SQL, URLs and mutation payloads are NOT inputs. */
export type Scalar = string | number | boolean | null;
export type FieldType = 'text' | 'number' | 'boolean' | 'uuid' | 'date' | 'timestamp' | 'json';
export type Filter = { field: string; op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'words' | 'in' | 'is_null'; value: Scalar | Scalar[] };
export type Search = { text: string; match: 'natural' | 'words' | 'exact' };
export type Metric = { op: 'count' | 'sum' | 'min' | 'max' | 'avg'; field?: string };
export type RelatedFilter = { relation: string; filters: Filter[]; search?: Search };
export type QueryPlan = {
  version: 1; source: string; mode: 'rows' | 'aggregate'; fields: string[];
  filters: Filter[]; related: RelatedFilter[]; search?: Search;
  quoteScope: 'quotes' | 'drafts' | 'all_permitted'; owner: 'workspace' | 'me';
  period?: { field: string; preset: 'this_month' | 'last_month' | 'this_year' | 'last_year' };
  groupBy: string[]; metrics: Metric[];
  orderBy: { field: string; direction: 'asc' | 'desc' }[];
  limit: number; resolve: boolean; current: boolean;
};
export type RetrievalCode = 'invalid_query' | 'unsupported_source' | 'unsupported_field' | 'permission_denied' |
  'feature_disabled' | 'setup_required' | 'read_failed' | 'too_broad' | 'needs_context' | 'incomplete';
export class RetrievalError extends Error {
  constructor(readonly code: RetrievalCode, message: string) { super(message); }
}
export type QueryRow = Record<string, unknown>;
export type Resolution = {
  state: 'selected' | 'candidates' | 'empty' | 'broad';
  reason: 'exact_identity' | 'exact_name' | 'strong_phrase' | 'single_match' | 'ordered_selection' | 'near_tie' | 'weak_match' | 'none' | 'too_many';
  selectedIndex: number | null;
  signals: { tier: number; score: number; recency: string | null }[];
};
export type QueryData = {
  version: 1; schemaHash: string; source: string; mode: 'rows' | 'aggregate' | 'engine_inputs';
  rows: QueryRow[]; asOf: string; truncated: boolean; complete: boolean;
  groupBy: string[]; warnings: string[];
  snapshots?: unknown; status?: string;
};
export type RetrievalResult = {
  source: string; mode: string; state: 'ok' | 'empty' | 'ambiguous' | 'incomplete' | RetrievalCode;
  rows: QueryRow[]; asOf: string | null; complete: boolean; truncated: boolean;
  scope: string; warnings: string[]; answer: string; resolution?: Resolution;
  cardId?: string; code?: RetrievalCode;
};
