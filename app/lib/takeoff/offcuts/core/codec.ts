import type { Draft, RoofInput, RoofFace } from './types';
import { DEFAULT_PROFILE, DEFAULT_SETTINGS } from './types';
import { validateRing } from './math';
import { roofRevision } from '../adapters/quotecore';
/** Browser-local interchange only. Auth/tenant ownership MUST be established by
 * the server if an agent later adds persistence. Serialized IDs prove nothing. */
export function exportDraft(draft: Draft): string {
  const copy = structuredClone(draft); delete copy.roof.imageUrl;
  copy.exportedAt = new Date().toISOString();
  return JSON.stringify(copy, null, 2);
}
export function parseDraft(text: string): Draft {
  if (text.length > 8_000_000) throw new Error('Draft exceeds the 8 MB import limit.');
  const data = JSON.parse(text) as Record<string, unknown>;
  if (data.schemaVersion !== 1 || !data.roof || typeof data.roof !== 'object') throw new Error('Unsupported draft schema.');
  const roof = data.roof as RoofInput;
  if (!Array.isArray(roof.outlines) || !Array.isArray(roof.edges) || roof.edges.length > 1200 || roof.outlines.length > 100) throw new Error('Invalid or oversized roof geometry.');
  if (!['quoteId', 'pageId', 'imageRevision'].every(k => typeof (roof as unknown as Record<string, unknown>)[k] === 'string')) throw new Error('Missing page/quote/revision identifiers.');
  if (![roof.sceneWidth, roof.sceneHeight, roof.mmPerSceneUnit].every(n => Number.isFinite(n) && n > 0)) throw new Error('Invalid scene dimensions or calibration.');
  for (const o of roof.outlines) {
    if (!o || typeof o.id !== 'string' || !Array.isArray(o.polygon)) throw new Error('Invalid outline.');
    const error = validateRing(o.polygon); if (error) throw new Error(error);
  }
  for (const e of roof.edges) if (!e || !e.a || !e.b || ![e.a.x, e.a.y, e.b.x, e.b.y].every(Number.isFinite) || !['ridge','hip','valley','broken_hip','barge','spouting','unknown'].includes(e.kind)) throw new Error('Invalid roof edge.');
  const faces = (Array.isArray(data.faces) ? data.faces : []) as RoofFace[];
  if (faces.length > 200) throw new Error('Too many faces.');
  for (const f of faces) {
    if (!f || typeof f.id !== 'string' || !Array.isArray(f.polygon)) throw new Error('Invalid face.');
    const error = validateRing(f.polygon); if (error) throw new Error(error);
    f.boundary = Array.isArray(f.boundary) ? f.boundary : [];
    delete f.directionApproval; f.confirmed = false; // imported geometry always needs fresh human review
  }
  // Do NOT hydrate executable URLs or trust precomputed material allocations.
  delete roof.imageUrl; roof.sourceRevision = roofRevision(roof);
  return { schemaVersion: 1, roof, faces, profile: { ...DEFAULT_PROFILE, ...(data.profile as object ?? {}), rulesConfirmed: false },
    settings: { ...DEFAULT_SETTINGS, ...(data.settings as object ?? {}) }, solution: null };
}
