/** Task metadata is NOT run state, entity authority or mutation approval. */
import { isRecord } from '../section-permissions';
import { isUuid } from '../v2/contracts';
import type { StoredResolution } from '../resolver/contracts';
export type TaskStatus = 'open' | 'awaiting_input' | 'answered' | 'closed';
export type TaskDisposition = 'new' | 'continue' | 'correct' | 'close' | 'ask_boundary';
export type TaskView = {
    id: string;
    version: number;
    status: TaskStatus;
    label: string;
    lastRunId: string;
    startedAt: string;
    updatedAt: string;
    expiresAt: string;
    closure: 'solved' | 'abandoned' | 'superseded' | null;
    boundary: boolean;
};
export type TaskSnapshot = {
    task: TaskView | null;
    resolution: StoredResolution | null;
    /** Only previously admitted, completed runs belonging to THIS task. */
    runIds: string[];
    pendingMessage: string | null;
};
const date = (value: unknown): value is string => typeof value === 'string' && Number.isFinite(Date.parse(value));
export function parseTaskView(value: unknown): TaskView | null {
    if (!isRecord(value) || !isUuid(value.id) || !Number.isSafeInteger(value.version) || Number(value.version) < 1
        || !['open', 'awaiting_input', 'answered', 'closed'].includes(String(value.status))
        || typeof value.label !== 'string' || value.label.length > 200 || /[\u0000-\u001f]/u.test(value.label)
        || !isUuid(value.lastRunId) || !date(value.startedAt) || !date(value.updatedAt) || !date(value.expiresAt)
        || ![null, 'solved', 'abandoned', 'superseded'].includes(value.closure as null) || typeof value.boundary !== 'boolean')
        return null;
    return value as TaskView;
}
export const emptyTaskSnapshot = (): TaskSnapshot => ({ task: null, resolution: null, runIds: [], pendingMessage: null });
