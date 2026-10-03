import 'server-only';
import { AssistantV2Error, rpcError } from './runtime.server';

// Platform adaptation (Supabase PostgREST retries serialization-class 40001 indefinitely,
// the recorded offcuts incident): the workflow-controller SQL raises deterministic conflicts
// as 23505 with these exact messages. Map them to 'conflict' (the original 40001 design
// intent) instead of the unique-violation 'pending_creation' path, so stale settings epochs,
// stale revisions, external draft edits and duplicate confirms surface a clean 409.
const WORKFLOW_CONFLICT_MESSAGE = /^(workflow_changed|workflow_config_changed|workflow_task_changed|workflow_already_started|legacy_workflow_requires_review|not_committed|area_identity_changed|component_identity_changed|entry_identity_changed|edit_target_changed|draft_snapshot_changed|library_changed|proof_not_committed|Subscription ownership changed)$/;

export function workflowRpcError(error: { code?: string; message?: string } | null): AssistantV2Error {
    if (error?.code === '23505' && WORKFLOW_CONFLICT_MESSAGE.test(error.message ?? '')) {
        return new AssistantV2Error('conflict', 'The record changed. Review a fresh proposal before confirming.', 409);
    }
    return rpcError(error);
}
