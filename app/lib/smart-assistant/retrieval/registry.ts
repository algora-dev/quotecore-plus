/** Server-side registry; never send its SQL expressions or full manifest to the model. */
import manifest from './schema.json';
import type { AssistantSection, SectionPermissions } from '../section-permissions';
import { isRecord } from '../section-permissions';
import { RetrievalError, type FieldType, type QueryPlan, type Filter, type Search, type Metric } from './contracts';
export interface FieldSpec {
  sql?: string; type: FieldType; label?: string; engine?: 'builder' | 'customer';
  permissions?: AssistantSection[]; aggregate?: boolean; dimension?: string; dimensions?: string[]; internal?: boolean;
}
export interface SourceSpec {
  label: string; from: string; scope: string; requiredSections: AssistantSection[]; quoteScoped: boolean;
  fields: Record<string, FieldSpec>; defaults: string[]; nameFields: string[]; searchFields: string[];
  relations: Record<string, {source: string; local: string; foreign: string}>;
  quoteStatus?: string; ownerField?: string; targetKindSql?: string; targetId?: string; sectionSql?: string;
  feature?: string; knowledge?: boolean; note: string;
}
export const REGISTRY_VERSION = 1;
export const SOURCES = manifest.sources as unknown as Record<string, SourceSpec>;
export const LIMITS = { fields: 16, filters: 8, related: 2, metrics: 3, groups: 3, rows: 20, search: 120, planBytes: 12_000, outputBytes: 262_144, engineQuotes: 200 } as const;
const owns = (o: object, k: string) => Object.hasOwn(o, k);
const readable = (level: unknown) => level === 'read_only' || level === 'edit';
export function sourceSpec(name: string): SourceSpec {
  if (!owns(SOURCES, name)) throw new RetrievalError('unsupported_source', 'That business source is not registered. This is a capability limit, not a missing record or a permission decision.');
  return SOURCES[name];
}
export function sourceAllowed(spec: SourceSpec, permissions: SectionPermissions): boolean {
  return (!spec.knowledge || Object.values(permissions).some(readable)) && spec.requiredSections.every(s => readable(permissions[s])) && (!spec.quoteScoped || readable(permissions.quotes) || readable(permissions.draft_quotes));
}
export function fieldAllowed(field: FieldSpec, permissions: SectionPermissions): boolean {
  return !field.internal && (field.permissions ?? []).every(s => readable(permissions[s]));
}
export function visibleSources(permissions: SectionPermissions, knowledge = false): string[] {
  return Object.keys(SOURCES).filter(name => sourceAllowed(SOURCES[name], permissions) && (!SOURCES[name].knowledge || knowledge));
}
export function describeSources(permissions: SectionPermissions, names: string[], knowledge = false) {
  return names.map(name => {
    const s = sourceSpec(name);
    if (!sourceAllowed(s, permissions)) throw new RetrievalError('permission_denied', 'That section is hidden in Smart Assistant permissions. No data was searched.');
    if (s.knowledge && !knowledge) throw new RetrievalError('feature_disabled', 'Classified document retrieval is not enabled for this workspace.');
    return { source: name, description: s.note, quoteScope: s.quoteScoped, ownerFilter: !!s.ownerField,
      defaults: s.defaults.filter(k => fieldAllowed(s.fields[k], permissions)),
      fields: Object.fromEntries(Object.entries(s.fields).filter(([,f]) => fieldAllowed(f, permissions)).map(([k,f]) => [k, {
        type: f.type, label: f.label ?? k.replaceAll('_', ' '), aggregate: f.aggregate === true, engine: f.engine ?? null,
        dimensions: f.dimensions ?? (f.dimension ? [f.dimension] : []),
      }])),
      relations: Object.fromEntries(Object.entries(s.relations).filter(([,r]) => sourceAllowed(SOURCES[r.source], permissions) && (!SOURCES[r.source].knowledge || knowledge)).map(([k,r]) => [k, r.source])) };
  });
}
function object(value: unknown, keys: string[], label: string): Record<string, unknown> {
  if (!isRecord(value) || Object.keys(value).some(k => !keys.includes(k))) throw new RetrievalError('invalid_query', `Invalid ${label}; unknown keys are not ignored.`);
  return value;
}
function list(value: unknown, max: number, label: string): unknown[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > max) throw new RetrievalError('invalid_query', `Too many or invalid ${label}.`);
  return value;
}
function string(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) throw new RetrievalError('invalid_query', 'Use a short, non-empty text value without control characters.');
  return value;
}
function enumValue<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !choices.includes(value as T)) throw new RetrievalError('invalid_query', 'Unsupported query option.');
  return value as T;
}
function field(spec: SourceSpec, value: unknown, permissions: SectionPermissions): [string, FieldSpec] {
  const name = string(value, 60);
  if (!owns(spec.fields, name) || spec.fields[name].internal) throw new RetrievalError('unsupported_field', 'That field is not registered for this source. Use describe_workspace_sources for supported fields; do not infer a permission failure.');
  const f = spec.fields[name];
  if (!fieldAllowed(f, permissions)) throw new RetrievalError('permission_denied', 'That field requires a section that is hidden. No data was searched.');
  return [name, f];
}
const numeric = /^-?(?:0|[1-9]\d{0,29})(?:\.\d{1,12})?$/;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateScalar(value: unknown, type: FieldType): void {
  if (value === null) throw new RetrievalError('invalid_query', 'Use is_null rather than comparing null values.');
  if (type === 'json') throw new RetrievalError('unsupported_field', 'Raw JSON is read-only data; arbitrary JSON paths and comparisons are not supported.');
  if (type === 'boolean') { if (typeof value === 'boolean') return; }
  else if (type === 'number') { if ((typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER && numeric.test(String(value))) || (typeof value === 'string' && numeric.test(value))) return; }
  else if (typeof value === 'string' && value.length <= 300 && !/[\u0000-\u001f]/.test(value)) {
    if (type === 'text') return;
    if (type === 'uuid' && uuid.test(value)) return;
    if (type === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value) return;
    if (type === 'timestamp' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?Z$/.test(value) && !Number.isNaN(Date.parse(value))) return;
  }
  throw new RetrievalError('invalid_query', `A valid ${type} filter value is required.`);
}
function filters(value: unknown, spec: SourceSpec, permissions: SectionPermissions): Filter[] {
  return list(value, LIMITS.filters, 'filters').map(raw => {
    const obj = object(raw, ['field','op','value'], 'filter');
    const [key,f] = field(spec,obj.field,permissions);
    if (f.engine) throw new RetrievalError('unsupported_field', 'Filtering on derived totals is not implemented. Rank or aggregate the authoritative totals, or narrow by stored fields first.');
    const op = enumValue(obj.op, ['eq','neq','gt','gte','lt','lte','contains','words','in','is_null'] as const, 'eq');
    if (!owns(obj,'value')) throw new RetrievalError('invalid_query', 'A filter value is required.');
    if (op === 'is_null') { if (typeof obj.value !== 'boolean') throw new RetrievalError('invalid_query','is_null requires true or false.'); }
    else {
      if ((op === 'contains' || op === 'words') && f.type !== 'text') throw new RetrievalError('invalid_query','Text matching requires a text field.');
      if (['gt','gte','lt','lte'].includes(op) && !['number','date','timestamp'].includes(f.type)) throw new RetrievalError('invalid_query','Ordered comparisons require a number or date field.');
      if (op === 'in') { const values = list(obj.value, 20, 'filter values'); if (!values.length) throw new RetrievalError('invalid_query','An empty in-filter is not allowed.'); values.forEach(v => validateScalar(v,f.type)); }
      else validateScalar(obj.value,f.type);
    }
    return {field:key,op,value:obj.value as Filter['value']};
  });
}
function search(value: unknown, spec: SourceSpec, permissions: SectionPermissions, fieldSearch = false): Search | undefined {
  if (value === undefined) return undefined;
  const s = object(value,fieldSearch?['text','match','field']:['text','match'],'search');
  const text = string(s.text,LIMITS.search).trim();
  if (!/[\p{L}\p{N}]/u.test(text)) throw new RetrievalError('invalid_query','Search must contain a word or record identifier.');
  let selectedField: string | undefined;
  if(s.field!==undefined){const [name,f]=field(spec,s.field,permissions);if(f.type!=='text'||f.engine)throw new RetrievalError('invalid_query','Field-specific search requires an authorised stored text field.');selectedField=name;}
  return {text,match:enumValue(s.match,['natural','words','exact'] as const,'natural'),...(selectedField?{field:selectedField}:{})};
}
export function parseQueryPlan(value: unknown, permissions: SectionPermissions, knowledge = false, fieldSearch = false): QueryPlan {
  if (JSON.stringify(value)?.length > LIMITS.planBytes) throw new RetrievalError('invalid_query','The retrieval plan is too large.');
  const raw = object(value,['version','source','mode','fields','filters','related','search','quoteScope','owner','period','groupBy','metrics','orderBy','limit','resolve','current'],'retrieval plan');
  if (raw.version !== 1) throw new RetrievalError('invalid_query','Retrieval plan version 1 is required.');
  const name=string(raw.source,60), spec=sourceSpec(name);
  if (!sourceAllowed(spec,permissions)) throw new RetrievalError('permission_denied','That source requires hidden sections. No data was searched.');
  if (spec.knowledge && !knowledge) throw new RetrievalError('feature_disabled','Classified upload retrieval is not enabled.');
  const mode=enumValue(raw.mode,['rows','aggregate'] as const,'rows');
  const selected=raw.fields === undefined ? spec.defaults.filter(k=>fieldAllowed(spec.fields[k],permissions)) : list(raw.fields,LIMITS.fields,'fields').map(v=>field(spec,v,permissions)[0]);
  // Numeric row facts need their interpretation dimensions too, not only
  // aggregates. A rate without currency/unit is not an authoritative answer.
  if(mode==='rows'){
    for(const k of [...selected])for(const dimension of spec.fields[k].dimensions??(spec.fields[k].dimension?[spec.fields[k].dimension!]:[])){
      field(spec,dimension,permissions);if(!selected.includes(dimension))selected.push(dimension);
    }
    if(selected.length>LIMITS.fields)throw new RetrievalError('invalid_query','Request fewer fields so currency/unit context also fits.');
  }
  const fs=filters(raw.filters,spec,permissions), ss=search(raw.search,spec,permissions,fieldSearch);
  if (mode==='aggregate' && ss?.match==='natural') throw new RetrievalError('invalid_query','Aggregates require exact or words matching; fuzzy matches must be reviewed before aggregating.');
  const quoteScope=enumValue(raw.quoteScope,['quotes','drafts','all_permitted'] as const,'all_permitted');
  if (spec.quoteScoped && ((quoteScope==='quotes' && !readable(permissions.quotes)) || (quoteScope==='drafts' && !readable(permissions.draft_quotes)))) throw new RetrievalError('permission_denied','The requested quote/draft section is hidden.');
  if (!spec.quoteScoped && raw.quoteScope !== undefined && quoteScope !== 'all_permitted') throw new RetrievalError('invalid_query','quoteScope is only valid on quote-owned sources.');
  const owner=enumValue(raw.owner,['workspace','me'] as const,'workspace');
  if (owner==='me' && !spec.ownerField) throw new RetrievalError('unsupported_field','This source does not have an authoritative creator field. Do not guess its owner.');
  const related=list(raw.related,LIMITS.related,'relationships').map(v=>{
    const r=object(v,['relation','filters','search'],'relationship'),key=string(r.relation,60);
    if (!owns(spec.relations,key)) throw new RetrievalError('unsupported_field','That relationship is not registered.');
    const child=sourceSpec(spec.relations[key].source);
    if (!sourceAllowed(child,permissions)) throw new RetrievalError('permission_denied','The related source requires hidden sections.');
    if (child.knowledge && !knowledge) throw new RetrievalError('feature_disabled','Document retrieval is not enabled.');
    const s=search(r.search,child,permissions);
    if (s?.match==='natural') throw new RetrievalError('invalid_query','Related-record constraints require words or exact matching; never relax relationship qualifiers.');
    return {relation:key,filters:filters(r.filters,child,permissions),...(s?{search:s}:{})};
  });
  const groupBy=list(raw.groupBy,LIMITS.groups,'group fields').map(v=>{const[k,f]=field(spec,v,permissions);if(f.engine || f.type==='json')throw new RetrievalError('invalid_query','Group by a stored scalar field.');return k;});
  const metrics:Metric[]=list(raw.metrics,LIMITS.metrics,'metrics').map(v=>{
    const m=object(v,['op','field'],'metric'),op=enumValue(m.op,['count','sum','min','max','avg'] as const,'count');
    if(op==='count' && m.field===undefined)return {op};
    const[k,f]=field(spec,m.field,permissions);
    if(op!=='count' && (!f.aggregate || f.type!=='number'))throw new RetrievalError('unsupported_field','That field does not have a validated numeric aggregation. Raw imported values cannot be summed.');
    return {op,field:k};
  });
  if(mode==='aggregate' && !metrics.length)throw new RetrievalError('invalid_query','An aggregate needs at least one metric.');
  if(mode==='rows' && (metrics.length || groupBy.length))throw new RetrievalError('invalid_query','Metrics/groupBy require aggregate mode.');
  if(mode==='aggregate' && raw.fields!==undefined && selected.length)throw new RetrievalError('invalid_query','Aggregate output uses groupBy and metric_N fields, not row fields.');
  for(const m of metrics){const f=m.field?spec.fields[m.field]:null;if(m.op!=='count'&&f)for(const d of f.dimensions??(f.dimension?[f.dimension]:[]))if(!groupBy.includes(d))groupBy.push(d);}
  if(groupBy.length>5)throw new RetrievalError('invalid_query','Too many dimensions. Narrow the question.');
  const orderBy=list(raw.orderBy,3,'sort fields').map(v=>{
    const o=object(v,['field','direction'],'ordering'),key=string(o.field,60);
    if(mode==='aggregate'){if(!groupBy.includes(key)&&!/^metric_[0-2]$/.test(key))throw new RetrievalError('invalid_query','Sort aggregates by a group field or metric_N.');if(key.startsWith('metric_')&&Number(key.slice(7))>=metrics.length)throw new RetrievalError('invalid_query','Unknown metric index.');}
    else if(field(spec,key,permissions)[1].type==='json')throw new RetrievalError('invalid_query','Raw JSON fields are not sortable.');
    return {field:key,direction:enumValue(o.direction,['asc','desc'] as const,'asc')};
  });
  let period: QueryPlan['period'];
  if(raw.period!==undefined){const p=object(raw.period,['field','preset'],'period');const[k,f]=field(spec,p.field,permissions);if(!['date','timestamp'].includes(f.type))throw new RetrievalError('invalid_query','A period requires a date field.');period={field:k,preset:enumValue(p.preset,['this_month','last_month','this_year','last_year'] as const,'this_month')};}
  if(raw.limit!==undefined && (!Number.isInteger(raw.limit)||Number(raw.limit)<1||Number(raw.limit)>LIMITS.rows))throw new RetrievalError('invalid_query','Row limit must be 1–20.');
  for(const k of ['resolve','current'])if(raw[k]!==undefined && typeof raw[k]!=='boolean')throw new RetrievalError('invalid_query',`${k} must be true or false.`);
  if(mode==='aggregate' && raw.resolve===true)throw new RetrievalError('invalid_query','Aggregates do not select a single record.');
  return {version:1,source:name,mode,fields:mode==='aggregate'?[]:[...new Set(selected)],filters:fs,related,...(ss?{search:ss}:{}),quoteScope,owner,...(period?{period}:{}),groupBy:[...new Set(groupBy)],metrics,orderBy,limit:raw.resolve===true?Math.max(5,Number(raw.limit??5)):Number(raw.limit??10),resolve:raw.resolve===true,current:raw.current===true};
}
