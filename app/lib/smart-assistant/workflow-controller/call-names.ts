import type { LibraryCatalogItem } from '../library-workflow/contracts';
import type { WorkingBrief } from './contracts';

/** Call names are identifiers, not fuzzy prose. Keep normalization identical to
 * the database migration so punctuation/case do not create accidental aliases. */
export const normalizeAssistantCallName = (value: unknown) => typeof value === 'string'
  ? value.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  : '';

function collections(catalog: readonly LibraryCatalogItem[]) {
  const seen = new Map<string, { id: string; name: string; callName: string | null }>();
  for (const item of catalog) if (!seen.has(item.collectionId)) {
    seen.set(item.collectionId, { id: item.collectionId, name: item.collectionName, callName: item.collectionCallName });
  }
  return [...seen.values()];
}

export function resolveLibraryCallName(raw: unknown, catalog: readonly LibraryCatalogItem[]) {
  const key = normalizeAssistantCallName(raw);
  if (!key) return null;
  const available = collections(catalog);
  const byCall = available.filter(item => item.callName && normalizeAssistantCallName(item.callName) === key);
  if (byCall.length === 1) return byCall[0];
  const byName = available.filter(item => normalizeAssistantCallName(item.name) === key);
  return byName.length === 1 ? byName[0] : null;
}

export function resolveComponentCallName(raw: unknown, catalog: readonly LibraryCatalogItem[], collectionId?: string | null) {
  const key = normalizeAssistantCallName(raw);
  if (!key) return null;
  const available = collectionId ? catalog.filter(item => item.collectionId === collectionId) : [...catalog];
  const byCall = available.filter(item => item.callName && normalizeAssistantCallName(item.callName) === key);
  if (byCall.length === 1) return byCall[0];
  const byName = available.filter(item => normalizeAssistantCallName(item.name) === key);
  return byName.length === 1 ? byName[0] : null;
}

/** Normalize model output before the WorkingBrief validates concepts. This is
 * what makes an arbitrary shortcut such as "1" deterministic rather than
 * forcing the model to guess which structural concept the component belongs to. */
export function applyCallNamesToPrepare(args: Record<string, unknown>, catalog: readonly LibraryCatalogItem[]) {
  const copy = structuredClone(args);
  let collectionId = typeof copy.collection_id === 'string' ? copy.collection_id : null;
  const selected = resolveLibraryCallName(copy.collection_name, catalog);
  if (selected) {
    copy.collection_id = selected.id;
    copy.collection_name = selected.name;
    collectionId = selected.id;
  }
  if (Array.isArray(copy.measurements)) copy.measurements = copy.measurements.map(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
    const measurement = { ...(raw as Record<string, unknown>) };
    const token = measurement.product_name ?? measurement.concept;
    const match = resolveComponentCallName(token, catalog, collectionId);
    if (match?.conceptKey) {
      measurement.concept = match.conceptKey;
      measurement.product_name = match.callName ?? match.name;
      // A globally unique component call name can safely identify its library.
      if (!collectionId) {
        copy.collection_id = match.collectionId;
        copy.collection_name = match.collectionName;
        collectionId = match.collectionId;
      }
    }
    return measurement;
  });
  return copy;
}

/** Existing working briefs already own a library. A shortcut supplied on an
 * add_measurement is promoted to add_component so the exact component remains
 * explicit instead of falling back to a concept default. */
export function applyCallNamesToRevision(args: Record<string, unknown>, catalog: readonly LibraryCatalogItem[], brief: WorkingBrief) {
  const copy = structuredClone(args);
  if (!Array.isArray(copy.deltas)) return copy;
  let collectionId = brief.collectionId;
  copy.deltas = copy.deltas.map(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return raw;
    const delta = { ...(raw as Record<string, unknown>) };
    if (delta.op === 'change_library' && typeof delta.collection_id === 'string') collectionId = delta.collection_id;
    if (delta.op !== 'add_component' && delta.op !== 'add_measurement') return delta;
    const match = resolveComponentCallName(delta.product_name ?? delta.concept, catalog, collectionId);
    if (match?.conceptKey) {
      delta.op = 'add_component';
      delta.concept = match.conceptKey;
      delta.product_name = match.callName ?? match.name;
    }
    return delta;
  });
  return copy;
}
