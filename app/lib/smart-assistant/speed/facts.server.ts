import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Access } from '../v2/contracts';
import { batchClient } from '../v2/database';
import { freshAccess, rpcError, AssistantV2Error } from '../v2/runtime.server';
import { isRecord } from '../section-permissions';
import { factsEnabled } from './config';
import type { CountRequest } from './intent';
import { quoteTotalsFromSnapshot } from './quote-totals';

function enabled() { if (!factsEnabled()) throw new AssistantV2Error('phase_off', 'Structured facts are not enabled.', 404); }
export async function countRecords(client: SupabaseClient, access: Access, runId: string, request: CountRequest) {
  enabled();
  await freshAccess(client, access);
  const { data, error } = await batchClient(client).rpc('sa_v2_speed_count', {
    p_run_id: runId, p_revision: access.permissionRevision, p_kind: request.kind, p_period: request.period, p_owner: request.owner,
  });
  if (error) throw rpcError(error);
  if (!isRecord(data) || typeof data.count !== 'string' || !/^\d+$/.test(data.count) || data.kind !== request.kind || data.period !== request.period || data.owner !== request.owner || data.complete !== true || data.timezone !== 'UTC' || typeof data.as_of !== 'string' || !Number.isFinite(Date.parse(data.as_of))) throw rpcError(null);
  const noun = request.kind === 'draft_quote' ? 'draft quotes' : 'non-draft quotes';
  return { ...data, answer: `${data.count} ${noun}${request.owner === 'me' ? ' created by you' : ' in this workspace'}${request.period === 'this_month' ? ' created this calendar month (UTC)' : ''}. This counts current statuses; drafts and non-drafts are separate.` };
}
export async function readQuoteTotals(client: SupabaseClient, access: Access, runId: string, quoteId: string) {
  enabled();
  await freshAccess(client, access);
  const { data, error } = await batchClient(client).rpc('sa_v2_speed_quote_snapshot', { p_run_id: runId, p_revision: access.permissionRevision, p_quote_id: quoteId });
  if (error) throw rpcError(error);
  if (data === null) throw new AssistantV2Error('not_found', 'No accessible quote was found.', 404);
  return quoteTotalsFromSnapshot(data);
}
