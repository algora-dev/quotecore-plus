import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { isRecord, type AssistantSection } from '../section-permissions';
import { batchClient, toJson } from './database';
import { isUuid, parseCard, parseMessage, parseRunOutcome, parseActionView, type Access, type CardContent, type SessionSnapshot } from './contracts';
import { pageHint } from './navigation';
import { AssistantV2Error, rpcError } from './runtime.server';
export async function readSession(client: SupabaseClient, access: Access, conversationId: string): Promise<SessionSnapshot> {
    if (!isUuid(conversationId))
        throw new AssistantV2Error('invalid', 'Choose a conversation first.');
    const { data, error } = await batchClient(client).rpc('sa_v2_session_read', { p_conversation_id: conversationId });
    if (error)
        throw rpcError(error);
    if (!isRecord(data) || !Array.isArray(data.cards) || !Array.isArray(data.actions))
        throw rpcError(null);
    const cards = data.cards.map(parseCard);
    const actions = data.actions.map(parseActionView);
    if (cards.some((c) => !c) || actions.some((a) => !a))
        throw rpcError(null);
    if (!Array.isArray(data.messages) || !Array.isArray(data.recent_runs))
        throw rpcError(null);
    const messages = data.messages.map(parseMessage);
    const runs = data.recent_runs.map(parseRunOutcome);
    if (runs.some(r => !r) || messages.some(m => !m))
        throw rpcError(null);
    return { access, runs: runs.filter(r => r !== null), messages: messages.filter(m => m !== null), activeRunId: isUuid(data.active_run_id) ? data.active_run_id : null,
        runStatus: typeof data.run_status === 'string' ? data.run_status : null, cards: cards.filter((c) => c !== null), actions: actions.filter((a) => a !== null), page: pageHint(data.pathname, access.workspaceSlug) };
}
export async function storePage(client: SupabaseClient, access: Access, conversationId: string, pathname: unknown): Promise<void> {
    if (!isUuid(conversationId))
        throw new AssistantV2Error('invalid', 'Choose a conversation first.');
    const hint = pageHint(pathname, access.workspaceSlug);
    const { error } = await batchClient(client).rpc('sa_v2_context_set', { p_conversation_id: conversationId, p_pathname: hint?.pathname ?? null });
    if (error)
        throw rpcError(error);
}
export async function addCard(runId: string, access: Access, key: string, sections: AssistantSection[], content: CardContent): Promise<string> {
    const { data, error } = await batchClient(createAdminClient()).rpc('sa_v2_card_add', {
        p_run_id: runId, p_user_id: access.userId, p_key: key, p_sections: [...new Set(sections)], p_content: toJson(content),
    });
    if (error)
        throw rpcError(error);
    if (!isRecord(data) || !isUuid(data.id))
        throw rpcError(null);
    return data.id;
}
/** Mark V2-origin history explicitly; rolled-back V1 turns must not leak into it. */
export async function bindRunScope(runId: string, access: Access): Promise<void> {
    const { error } = await batchClient(createAdminClient()).rpc('sa_v2_run_scope_add', { p_run_id: runId, p_user_id: access.userId, p_revision: access.permissionRevision });
    if (error)
        throw rpcError(error);
}
