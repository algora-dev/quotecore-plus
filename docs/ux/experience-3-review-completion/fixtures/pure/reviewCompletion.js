"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewDestination = reviewDestination;
exports.prepareReviewCompletion = prepareReviewCompletion;
function reviewDestination(workspaceSlug, quoteId, destination) {
    const base = `/${encodeURIComponent(workspaceSlug)}/quotes/${encodeURIComponent(quoteId)}`;
    return `${base}/${destination === 'customer-quote' ? 'customer-edit' : 'summary'}`;
}
/** Drafts use the existing idempotent confirmQuote action. Non-drafts retain the
 * old saveConfirmedQuoteAndRedirect semantics: no additional status mutation.
 * shouldContinue only cancels CLIENT continuation after unmount, not server work.
 */
async function prepareReviewCompletion({ saveMargins, confirmDraft, needsConfirmation, onStage, shouldContinue }) {
    const active = () => shouldContinue?.() !== false;
    if (!active())
        return { status: 'abandoned' };
    onStage?.('saving');
    let margins = { status: 'unchanged' };
    try {
        margins = (await saveMargins?.()) ?? { status: 'unchanged' };
    }
    catch {
        margins = { status: 'not-saved', message: 'The margin changes could not be saved.' };
    }
    if (!active())
        return { status: 'abandoned' };
    if (needsConfirmation) {
        onStage?.('confirming');
        try {
            await confirmDraft();
        }
        catch {
            return active() ? { status: 'confirmation-failed', margins } : { status: 'abandoned' };
        }
    }
    return active() ? { status: 'ready', margins } : { status: 'abandoned' };
}
