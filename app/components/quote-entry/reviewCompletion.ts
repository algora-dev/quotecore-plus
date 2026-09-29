/** Experience 3: sequence existing operations, never calculate or create a document.
 * The /customer-edit page already chooses saved lines or initial component lines.
 * No store, pricing rule, lifecycle permission or quote number is owned here.
 */
export type ReviewDestination = 'customer-quote' | 'job-space';
export type ReviewMarginResult =
  | { status: 'saved' }
  | { status: 'unchanged' }
  | { status: 'not-saved'; message: string };
export type ReviewPreparation =
  | { status: 'ready'; margins: ReviewMarginResult }
  | { status: 'confirmation-failed'; margins: ReviewMarginResult }
  | { status: 'abandoned' };

export function reviewDestination(workspaceSlug: string, quoteId: string, destination: ReviewDestination): string {
  const base = `/${encodeURIComponent(workspaceSlug)}/quotes/${encodeURIComponent(quoteId)}`;
  return `${base}/${destination === 'customer-quote' ? 'customer-edit' : 'summary'}`;
}

/** Drafts use the existing idempotent confirmQuote action. Non-drafts retain the
 * old saveConfirmedQuoteAndRedirect semantics: no additional status mutation.
 * shouldContinue only cancels CLIENT continuation after unmount, not server work.
 */
export async function prepareReviewCompletion({ saveMargins, confirmDraft, needsConfirmation, onStage, shouldContinue }: {
  saveMargins?: () => Promise<ReviewMarginResult | void>;
  confirmDraft: () => Promise<void>;
  needsConfirmation: boolean;
  onStage?: (stage: 'saving' | 'confirming') => void;
  shouldContinue?: () => boolean;
}): Promise<ReviewPreparation> {
  const active = () => shouldContinue?.() !== false;
  if (!active()) return { status: 'abandoned' };
  onStage?.('saving');
  let margins: ReviewMarginResult = { status: 'unchanged' };
  try {
    margins = (await saveMargins?.()) ?? { status: 'unchanged' };
  } catch {
    margins = { status: 'not-saved', message: 'The margin changes could not be saved.' };
  }
  if (!active()) return { status: 'abandoned' };
  if (needsConfirmation) {
    onStage?.('confirming');
    try {
      await confirmDraft();
    } catch {
      return active() ? { status: 'confirmation-failed', margins } : { status: 'abandoned' };
    }
  }
  return active() ? { status: 'ready', margins } : { status: 'abandoned' };
}
