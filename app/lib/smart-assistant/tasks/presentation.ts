/** Pure presentation rules for canonical failures. No provider error details or
 * speculation about successful/failed business writes. */
import type { ChatMessage, ConversationCard, RunOutcome } from '../v2/contracts';
import type { TaskView } from './contracts';
import { displayTaskMessage, isTaskMessage } from './wire';
import { isResolutionMessage } from '../resolver/wire';
const failed = new Set(['failed', 'cancelled', 'aborted', 'timed_out']);
export type FailedTurn = {
    runId: string;
    requestId: string;
    messageId: string;
    retryText: string;
    canRetry: boolean;
    copy: string;
};
export function failedTurns(messages: ChatMessage[], runs: RunOutcome[]): FailedTurn[] {
    const answered = new Set(messages.filter(m => m.role === 'assistant').map(m => m.runId));
    return runs.filter(r => failed.has(r.status) && !answered.has(r.id)).flatMap(r => {
        const message = messages.find(m => m.runId === r.id && m.role === 'user');
        const setup = r.errorCode === 'migration_required' || r.errorCode?.startsWith('pipeline_error::Task context setup is incomplete');
        const access = ['access_changed','permissions_changed','workspace_changed'].includes(r.errorCode ?? '');
        return message ? [{ runId: r.id, requestId: r.requestId, messageId: message.id, retryText: message.content,
                canRetry: !setup && !access && !isTaskMessage(message.content) && !isResolutionMessage(message.content),
                copy: setup ? 'Smart Assistant setup is incomplete on this deployment. An administrator needs to finish the assistant setup before this request can run.'
                    : access ? 'Your Smart Assistant access changed. Reopen the assistant before sending another request.'
                    : r.status === 'timed_out' ? 'This request timed out before a reply was confirmed.' : 'This request did not complete. No reply was confirmed.' }] : [];
    });
}
/** Old navigation stays useful. Only resolution/clarification buttons can revive
 * a task; those become inert when it is closed or superseded. SQL is authoritative. */
export function staleTaskCard(card: ConversationCard, task: TaskView | null | undefined): boolean {
    if (task === undefined || !['resolution', 'choices'].includes(card.content.kind))
        return false;
    if (!task || task.status === 'closed' || Date.parse(task.expiresAt) <= Date.now())
        return true;
    return Date.parse(card.createdAt) < Date.parse(task.startedAt);
}
/** Owner request 2026-09-29: when the assistant ends its turn explicitly asking
 * for confirmation to continue ("Shall I proceed with those prices?", "Is my
 * understanding correct?"), Done (task complete) and Not quite (correction) are
 * both wrong answers. This recognises that state from the task's latest reply
 * so the strip can offer Proceed. Pure heuristic: an answered/open task (a
 * resolver clarification is awaiting_input and keeps its own choice cards) whose
 * final line is a question phrased as confirmation-to-continue. */
export function awaitingProceed(task: TaskView | null | undefined, messages: ChatMessage[]): boolean {
    if (!task || (task.status !== 'answered' && task.status !== 'open')) return false;
    const reply = [...messages].reverse().find(m => m.role === 'assistant' && m.runId === task.lastRunId);
    if (!reply) return false;
    const lines = displayTaskMessage(reply.content).trim().split('\n').map(l => l.trim()).filter(Boolean);
    const last = lines[lines.length - 1] ?? '';
    if (!last.endsWith('?')) return false;
    return /\b(?:proceed|continue|go ahead|carry on|keep going)\b/i.test(last)
        || /\b(?:is|are|do|does|did)\s+(?:that|this|it|my understanding|everything|those|the)\b[^\n?]{0,80}\b(?:correct|right|accurate|good|okay|fine)\b/i.test(last)
        || /\b(?:sounds?|looks?)\s+(?:right|correct|good|okay|fine)\b/i.test(last)
        || /\b(?:shall|should|would|could|can)\s+i\b/i.test(last);
}
