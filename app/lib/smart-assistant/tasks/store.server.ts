import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isRecord } from '../section-permissions';
import { isUuid, type Access } from '../v2/contracts';
import { batchClient } from '../v2/database';
import { AssistantV2Error } from '../v2/runtime.server';
import { parseResolutionState } from '../resolver/state';
import { parseTaskView, type TaskSnapshot, type TaskView, type TaskStatus } from './contracts';
import type { TaskDecision } from './boundary';
function failure(code?: string): AssistantV2Error {
    if (code === 'P1721')
        return new AssistantV2Error('task_changed', 'This task has changed. Refresh the assistant before selecting an old option.', 409);
    if (code === 'P1722')
        return new AssistantV2Error('run_in_progress', 'A request is still being checked. Its outcome must be verified before moving on.', 409);
    if (code === '42501')
        return new AssistantV2Error('access_changed', 'Your workspace or assistant permissions changed. Reopen the assistant.', 403);
    if (['42883', '42P01', 'PGRST202', 'PGRST205'].includes(code ?? ''))
        return new AssistantV2Error('migration_required', 'Task context is enabled but its setup is incomplete. Ask the integrator to check the P1.7.2 migration.', 503);
    return new AssistantV2Error('task_unavailable', 'The task state could not be verified. Refresh before retrying.', 503);
}
export interface TaskStore {
    read(): Promise<TaskSnapshot>;
    begin(snapshot: TaskSnapshot, decision: TaskDecision, label: string): Promise<TaskView>;
    finish(status: Exclude<TaskStatus, 'closed'>, label: string): Promise<TaskView>;
}
export function decodeTaskSnapshot(data: unknown): TaskSnapshot {
    if (!isRecord(data) || !Array.isArray(data.runIds) || data.runIds.length > 100 || data.runIds.some(id => !isUuid(id))
        || !(data.pendingMessage === null || typeof data.pendingMessage === 'string' && data.pendingMessage.length > 0 && data.pendingMessage.length <= 16000))
        throw failure();
    const task = data.task === null ? null : parseTaskView(data.task);
    if (data.task !== null && !task)
        throw failure();
    let resolution: TaskSnapshot['resolution'] = null;
    if (data.resolution !== null) {
        const raw = data.resolution;
        if (!isRecord(raw) || !isUuid(raw.id) || typeof raw.expires_at !== 'string' || !Number.isFinite(Date.parse(raw.expires_at)))
            throw failure();
        const state = parseResolutionState(raw.state);
        if (!state)
            throw failure();
        resolution = { id: raw.id, expiresAt: raw.expires_at, state };
    }
    if (!task && (resolution || data.pendingMessage !== null || data.runIds.length))
        throw failure();
    return { task, resolution, runIds: data.runIds as string[], pendingMessage: data.pendingMessage as string | null };
}
export function createTaskStore(client: SupabaseClient, access: Access, runId: string, knowledgeRevision: string): TaskStore {
    const args = { p_run_id: runId, p_user_id: access.userId, p_revision: access.permissionRevision, p_knowledge_revision: knowledgeRevision };
    const admin = async () => batchClient((await import('@/app/lib/supabase/admin')).createAdminClient());
    const measure = async <T>(stage: 'read' | 'begin' | 'finish', execute: () => Promise<T>): Promise<T> => {
        const started = performance.now();
        let outcome = 'ok', code: string | null = null;
        try {
            return await execute();
        }
        catch (error) {
            outcome = 'error';
            if (error instanceof AssistantV2Error && ['task_changed', 'run_in_progress', 'access_changed', 'migration_required', 'task_unavailable'].includes(error.code))
                code = error.code;
            throw error;
        }
        finally {
            try {
                console.info('[smart-assistant:task-stage]', JSON.stringify({ event: 'sa_task_stage', runId, stage, ms: Math.round(performance.now() - started), outcome, code }));
            }
            catch { /* Diagnostics must not alter run state. No labels or user text logged. */ }
        }
    };
    return {
        async read() {
            return measure('read', async () => {
                const { data, error } = await batchClient(client).rpc('sa_v2_task_read', { p_run_id: runId, p_revision: access.permissionRevision });
                if (error)
                    throw failure(error.code);
                return decodeTaskSnapshot(data);
            });
        },
        async begin(snapshot, decision, label) {
            return measure('begin', async () => {
                const { data, error } = await (await admin()).rpc('sa_v2_task_begin', { ...args, p_expected_task: snapshot.task?.id ?? null, p_expected_version: snapshot.task?.version ?? null,
                    p_disposition: decision.disposition, p_reason: decision.reason, p_label: label,
                    p_pending_message: decision.disposition === 'ask_boundary' ? decision.message : null, p_closure: decision.closure ?? null });
                if (error)
                    throw failure(error.code);
                const view = parseTaskView(data);
                if (!view)
                    throw failure();
                return view;
            });
        },
        async finish(status, label) {
            return measure('finish', async () => {
                const { data, error } = await (await admin()).rpc('sa_v2_task_finish', { ...args, p_status: status, p_label: label });
                if (error)
                    throw failure(error.code);
                const view = parseTaskView(data);
                if (!view)
                    throw failure();
                return view;
            });
        },
    };
}
export async function taskSnapshot(client: SupabaseClient, conversationId: string): Promise<TaskView | null> {
    const { data, error } = await batchClient(client).rpc('sa_v2_task_snapshot', { p_conversation_id: conversationId });
    if (error)
        throw failure(error.code);
    if (data === null)
        return null;
    const view = parseTaskView(data);
    if (!view)
        throw failure();
    return view;
}
export async function closeTask(client: SupabaseClient, conversationId: string, taskId: string, version: number, closure: 'solved' | 'abandoned'): Promise<TaskView> {
    const { data, error } = await batchClient(client).rpc('sa_v2_task_close', { p_conversation_id: conversationId, p_task_id: taskId, p_version: version, p_closure: closure });
    if (error)
        throw failure(error.code);
    const view = parseTaskView(data);
    if (!view)
        throw failure();
    return view;
}
