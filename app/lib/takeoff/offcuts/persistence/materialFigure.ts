/** A saved image is a record, not live quantity authority. Only expose a figure
 * after restoring and validating the selected structured review in its scope. */
import { restoreReviewDocument, sameReviewScope, type ReviewScope } from './reviews';
import { quantitySummary, type QuoteQuantityProposal } from '../core/quantities';
export interface OffcutAreaFigure {
  m2: number;
  purchasedLinealM: number;
  layoutId: string;
  sourceRevision: string;
  facesRevision: string;
  scope: ReviewScope;
}
export function checkedReviewFigure(document: unknown, scope: ReviewScope): OffcutAreaFigure | null {
  try {
    const restored = restoreReviewDocument(document, scope), s = restored.draft.solution;
    if (!s) return null;
    const q = quantitySummary(s);
    if (!Number.isFinite(q.suppliedCoverAreaM2) || q.suppliedCoverAreaM2 <= 0) return null;
    return { m2: q.suppliedCoverAreaM2, purchasedLinealM: q.purchasedLinealM, layoutId: s.layoutId ?? '',
      sourceRevision: s.sourceRevision, facesRevision: s.facesRevision, scope: { ...scope } };
  } catch { return null; }
}
export function proposalCoverFigure(p: QuoteQuantityProposal, scope: ReviewScope): OffcutAreaFigure | null {
  if (!sameReviewScope(p, scope) || !Number.isFinite(p.suppliedCoverAreaM2) || p.suppliedCoverAreaM2 <= 0 || !Number.isFinite(p.purchasedLinealM)) return null;
  // The existing attachment dropdown prices COVER m². A profile-width or lm
  // selection must not be mislabeled as cover m²; use the explicit cover field.
  return { m2: p.suppliedCoverAreaM2, purchasedLinealM: p.purchasedLinealM, layoutId: p.layoutId,
    sourceRevision: p.sourceRevision, facesRevision: p.facesRevision, scope: { ...scope } };
}
