/** Pure presentation rules for canonical failures. No provider error details or
 * speculation about successful/failed business writes. */
import type { ChatMessage, ConversationCard, RunOutcome } from '../v2/contracts';
import type { TaskView } from './contracts';
import { isTaskMessage } from './wire';
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
        return message ? [{ runId: r.id, requestId: r.requestId, messageId: message.id, retryText: message.content,
                canRetry: !isTaskMessage(message.content) && !isResolutionMessage(message.content),
                copy: r.status === 'timed_out' ? 'This request timed out before a reply was confirmed.' : 'This request did not complete. No reply was confirmed.' }] : [];
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
