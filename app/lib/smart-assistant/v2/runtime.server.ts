import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { batchClient } from './database';
import { parseAccess, type Access, type Phase } from './contracts';
export class AssistantV2Error extends Error {
    constructor(public readonly code: string, message: string, public readonly status = 400) { super(message); }
}
export function v2SwitchOn(): boolean { return process.env.SMART_ASSISTANT_V2_ENABLED === 'true'; }
// Platform adaptation (Supabase PostgREST retries serialization-class 40001 indefinitely):
// deterministic workflow conflicts raise 23505 with these exact messages and must
// map to 'conflict' (as the original 40001 design intended), not 'pending_creation'.
const WORKFLOW_CONFLICT_MESSAGE = /^(workflow_changed|workflow_config_changed|workflow_task_changed|workflow_already_started|legacy_workflow_requires_review|not_committed|area_identity_changed|component_identity_changed|entry_identity_changed|edit_target_changed|draft_snapshot_changed|library_changed|proof_not_committed|Subscription ownership changed)$/;
export function rpcError(error: {
    code?: string;
    message?: string;
} | null): AssistantV2Error {
    if (error?.code === '23505' && WORKFLOW_CONFLICT_MESSAGE.test(error.message ?? '')) return new AssistantV2Error('conflict', 'The record changed. Review a fresh proposal before confirming.', 409);
    switch (error?.code) {
        case '42501': return new AssistantV2Error('forbidden', 'This action is not available with your current access.', 403);
        case 'P0004':
        case '23505': return new AssistantV2Error('pending_creation', 'An earlier assistant action is still saving or needs review. Refresh its status; ask your administrator to reconcile an uncertain draft before creating another.', 409);
        case 'P0002': return new AssistantV2Error('not_found', 'The record or conversation is no longer available.', 404);
        case '40001': return new AssistantV2Error('conflict', 'The record changed. Review a fresh proposal before confirming.', 409);
        case '22023': return new AssistantV2Error('invalid', 'The request could not be validated.', 400);
        case 'PGRST202':
        case 'PGRST205':
        case '42883':
        case '42P01':
            return new AssistantV2Error('migration_required', 'Assistant V2 setup is not ready. Ask your administrator to check the phase migrations.', 503);
        default: return new AssistantV2Error('unavailable', 'Could not verify the result. Refresh the assistant before trying again.', 503);
    }
}
export async function loadAccess(client: SupabaseClient): Promise<Access> {
    const { data, error } = await batchClient(client).rpc('sa_v2_runtime', {});
    if (error)
        throw rpcError(error);
    const access = parseAccess(data);
    if (!access)
        throw rpcError(null);
    if (!v2SwitchOn())
        access.phases = { p1: false, p2: false, p3: false, p4: false };
    return access;
}
export async function requestAccess(phase: Phase = 'p1'): Promise<{
    client: Awaited<ReturnType<typeof createSupabaseServerClient>>;
    access: Access;
}> {
    if (!v2SwitchOn())
        throw new AssistantV2Error('phase_off', 'This assistant phase is not enabled.', 404);
    const client = await createSupabaseServerClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user)
        throw new AssistantV2Error('unauthenticated', 'Sign in again to continue.', 401);
    const access = await loadAccess(client);
    if (access.userId !== user.id || !access.phases[phase])
        throw new AssistantV2Error('phase_off', 'This assistant phase is not enabled.', 404);
    return { client, access };
}
export async function freshAccess(client: SupabaseClient, previous: Access, phase: Phase = 'p1'): Promise<Access> {
    const next = await loadAccess(client);
    if (next.userId !== previous.userId || next.companyId !== previous.companyId || !next.phases[phase])
        throw new AssistantV2Error('access_changed', 'Your workspace or assistant access changed. Reopen the assistant.', 403);
    if (next.permissionRevision !== previous.permissionRevision)
        throw new AssistantV2Error('permissions_changed', 'Assistant permissions changed. Send a new request using the current access.', 409);
    return next;
}
