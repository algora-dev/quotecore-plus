import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isRecord, type AssistantSection } from '../section-permissions';
import { batchClient, toJson } from '../v2/database';
import { isUuid, type Access } from '../v2/contracts';
import { AssistantV2Error } from '../v2/runtime.server';
import { RetrievalError } from '../retrieval/contracts';
import { type ResolutionState, type StoredResolution } from './contracts';

export { parseResolutionState } from './state';
import { parseResolutionState } from './state';
function failure(code?: string): Error {
  if (code === '42501') return new AssistantV2Error('access_changed', 'Assistant access or the admitted request changed. Start a new request.', 403);
  if (['42883','42P01','PGRST202','PGRST205'].includes(code ?? '')) return new RetrievalError('setup_required', 'Entity resolution is not fully installed. Ask the integrator to check the P1.7.1 migration; no selection or edit was applied.');
  return new RetrievalError('read_failed', 'The clarification state could not be safely read or stored. No selection or edit was applied.');
}
export interface ResolutionStore {
  load: (id?: string, signal?: AbortSignal) => Promise<StoredResolution | null>;
  save: (state: ResolutionState, sections: AssistantSection[], signal?: AbortSignal) => Promise<StoredResolution>;
}
export function createResolutionStore(client: SupabaseClient, access: Access, runId: string, taskScoped = false): ResolutionStore {
  return {
    async load(id, signal) {
      if (id !== undefined && !isUuid(id)) return null;
      const request = batchClient(client).rpc(taskScoped ? 'sa_v2_resolution_read_v172' : 'sa_v2_resolution_read', { p_run_id: runId, p_revision: access.permissionRevision, p_state_id: id ?? null });
      const { data, error } = await (signal ? request.abortSignal(signal) : request);
      if (error) throw failure(error.code);
      if (data === null) return null;
      if (!isRecord(data) || !isUuid(data.id) || typeof data.expires_at !== 'string' || !Number.isFinite(Date.parse(data.expires_at))) throw failure();
      const state = parseResolutionState(data.state);
      if (!state) throw failure();
      return { id: data.id, expiresAt: data.expires_at, state };
    },
    async save(state, sections, signal) {
      if (!parseResolutionState(state)) throw failure();
      // Service role writes assistant metadata ONLY. Business reads stay on the
      // caller client. SQL binds owner/company/conversation to the admitted run.
      const { createAdminClient } = await import('@/app/lib/supabase/admin');
      const request = batchClient(createAdminClient()).rpc('sa_v2_resolution_store', {
        p_run_id: runId, p_user_id: access.userId, p_revision: access.permissionRevision,
        p_sections: [...new Set(sections)], p_state: toJson(state),
      });
      const { data, error } = await (signal ? request.abortSignal(signal) : request);
      if (error) throw failure(error.code);
      if (!isRecord(data) || !isUuid(data.id) || typeof data.expires_at !== 'string' || !Number.isFinite(Date.parse(data.expires_at))) throw failure();
      return { id: data.id, expiresAt: data.expires_at, state };
    },
  };
}
