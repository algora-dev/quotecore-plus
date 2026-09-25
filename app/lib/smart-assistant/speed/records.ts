/** Shared deterministic entity planner. No DB, model, HTTP or privileged client here. */
import { ENTITY_SECTIONS, type EntityHit, type RecordTarget } from '../v2/contracts';
import type { SectionPermissions } from '../section-permissions';
import type { RecordRequest } from './intent';
export interface RecordPorts {
  permissions: SectionPermissions;
  search: (kind: RecordRequest['kind'], query: string) => Promise<EntityHit[]>;
  read: (target: RecordTarget) => Promise<EntityHit>;
  current: () => Promise<RecordTarget | null>;
}
export type Resolution = {
  state: 'selected' | 'choices' | 'empty' | 'hidden' | 'clarify';
  records: EntityHit[];
  autoOpen: boolean;
  answer: string;
};
const empty = (state: Resolution['state'], answer: string): Resolution => ({ state, answer, records: [], autoOpen: false });
export function exactRecordNumber(hit: EntityHit, requested: string): boolean {
  const field = hit.kind === 'quote' || hit.kind === 'draft_quote' ? 'quote_number' : `${hit.kind}_number`;
  const actual = hit.fields[field];
  if (typeof actual !== 'string' && typeof actual !== 'number') return false;
  if ((hit.kind === 'quote' || hit.kind === 'draft_quote') && /^\d+$/.test(requested)) {
    return String(actual).replace(/^0+(?=\d)/, '') === requested.replace(/^0+(?=\d)/, '');
  }
  return String(actual).toLowerCase() === requested.toLowerCase();
}
export function compactHit(hit: EntityHit): EntityHit {
  const { components, roof_areas, children_note, ...fields } = hit.fields;
  return { ...hit, fields: { ...fields, ...((components || roof_areas) ? {
    detail_note: 'Child rows omitted from this summary. Use read_record for bounded component/roof detail; never infer totals from these omissions.',
  } : {}) } };
}
export async function resolveRecords(request: RecordRequest, ports: RecordPorts): Promise<Resolution> {
  // A current quote URL may actually be a draft; authorise its real kind below.
  if (request.selector !== 'current' && ports.permissions[ENTITY_SECTIONS[request.kind]] === 'hidden') {
    return empty('hidden', 'That section is hidden in your Smart Assistant permissions.');
  }
  let records: EntityHit[];
  if (request.selector === 'current') {
    const target = await ports.current();
    if (!target) return empty('clarify', 'Which record do you mean? Give me its name or number.');
    const quoteKinds = ['quote', 'draft_quote'];
    if (target.kind !== request.kind && !(quoteKinds.includes(target.kind) && quoteKinds.includes(request.kind))) {
      return empty('clarify', 'The page behind the assistant is a different record type. Which record do you mean?');
    }
    const hit = await ports.read(target); // status/permissions resolved authoritatively, never trust the URL
    if (request.kind === 'draft_quote' && hit.kind !== 'draft_quote') return empty('clarify', 'This record is not a draft. Which draft do you mean?');
    records = [hit];
  } else {
    const hits = await ports.search(request.kind, request.query ?? '');
    // Defence in depth: never let a fuzzy/inexact match trigger navigation.
    records = hits.filter(hit => hit.kind === request.kind);
    if (request.selector === 'number') records = records.filter(hit => exactRecordNumber(hit, request.query ?? ''));
    if (request.selector === 'latest') records = records.slice(0, 1);
  }
  records = records.filter(hit => ports.permissions[hit.section] !== 'hidden');
  if (!records.length) return empty('empty', request.selector === 'number' ? 'No accessible record with that exact number was found.' : 'No accessible matching records were found.');
  if (request.selector === 'list' || records.length > 1) return {
    state: 'choices', records, autoOpen: false,
    answer: request.selector === 'list' ? 'Here are the newest accessible records (up to ten), ordered by last update.' : 'Choose the matching record below.',
  };
  const record = records[0];
  const prefix = request.selector === 'latest' ? "Your workspace's most recently updated record is " : '';
  return { state: 'selected', records, autoOpen: request.presentation === 'open',
    answer: request.presentation === 'open'
      ? `${prefix}${record.label} will open. Your conversation will stay available.`
      : `${prefix}${record.label}.` };
}
