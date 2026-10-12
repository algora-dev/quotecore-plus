/** Material certificates bind reviewed inputs, not a temporary display URL.
 * The calculation worker still binds its full live request separately. */
import type { SolveRequest } from './types';
import { canonicalFingerprint } from './math';
export const CERTIFICATE_INPUT_MODEL = 'reviewed-input-without-image-url-v1' as const;
export function certificateInputFingerprint(r: SolveRequest): string {
  const roof = { ...r.roof };
  delete roof.imageUrl;
  return canonicalFingerprint([roof, r.faces, r.profile, r.settings]);
}
