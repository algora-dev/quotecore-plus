import { record, UsageError, usageError } from './contracts';
import { tailProof, type ScanRequest } from './scan-contract';
import type { RpcClient } from './contracts';

type Scope = { companyId: string; accountId: string; mode: 'test' | 'live' };
async function rpc(client: RpcClient, name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  let res: { data: unknown; error: unknown };
  try { res = await client.rpc(name, args); } catch (error) { throw usageError(error); }
  if (res.error) throw usageError(res.error);
  const data = record(res.data);
  if (!Object.keys(data).length) throw new UsageError('usage_unavailable', 'The scan reservation could not be confirmed.');
  return data;
}
function reply(body: Record<string, unknown>, status: number): Response {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}
/** Provider work is behind the atomic admission. No automatic provider retry. */
export async function executePurchasedScan(scope: Scope, r: ScanRequest, client: RpcClient,
  execute: () => Promise<Response>): Promise<Response> {
  const start = await rpc(client, 'qcp_begin_scan', { p_company_id: scope.companyId,
    p_account_id: scope.accountId, p_mode: scope.mode, p_request_key: r.requestKey,
    p_payload_hash: r.payloadHash, p_parent_id: r.parentId,
    p_metadata: { stage: r.stage, quality: r.quality, quoteId: r.quoteId, pageId: r.pageId,
      imageHash: r.imageHash, ...(r.stage === 'scan3' ? { tailHash: tailProof(r) } : {}) } });
  if (start.decision === 'replay') {
    if (start.state === 'reserved') return reply({ success: false, error: 'This scan is already running or awaiting confirmation.',
      code: 'scan_pending', billingOperationId: start.id }, 409);
    if (start.state === 'refunded') return reply({ success: false, error: 'This attempt failed and its Scan Tokens were returned. Start a new scan to retry.',
      code: 'scan_refunded', billingOperationId: start.id }, 409);
    const stored = record(start.response); const body = record(stored.body);
    if (start.state !== 'consumed' || stored.httpStatus !== 200 || body.success !== true) {
      throw new UsageError('scan_recovery_required', 'The scan result needs to be recovered before it can run again.');
    }
    return reply({ ...body, billingOperationId: start.id, replayed: true }, 200);
  }
  if (start.decision !== 'accepted' || typeof start.id !== 'string') {
    throw new UsageError('usage_unavailable', 'The scan was not admitted.');
  }
  let status: number; let body: Record<string, unknown>;
  try {
    const response = await execute(); status = response.status;
    body = record(await response.json());
  } catch {
    status = 502; body = { success: false, error: 'The scan did not finish. Please try a new scan.', code: 'scan_failed' };
  }
  let succeeded = status === 200 && body.success === true;
  let proof: string | null = null;
  if (succeeded && r.stage === 'scan2') {
    const result = record(body.data);
    if (!Array.isArray(result.lines) || !Array.isArray(result.outlinePoints)) {
      succeeded = false; status = 502; body = { success: false, error: 'The component scan result was incomplete.', code: 'scan_failed' };
    } else { proof = tailProof(r, body); }
  }
  // Debug image URLs are not durable billing evidence and may contain plan
  // content. Keep the idempotency record small and independent of debug assets.
  const { debugImages: _debugImages, ...durableBody } = body;
  body = { ...durableBody, billingOperationId: start.id, clientRequestId: r.requestKey };
  // If this write is uncertain, leave the reservation in place. Retrying the
  // same request must poll/recover, never run the model a second time.
  await rpc(client, 'qcp_finish_scan', { p_company_id: scope.companyId, p_event_id: start.id,
    p_succeeded: succeeded, p_response: { httpStatus: status, body },
    p_error_code: succeeded ? null : 'scan_failed', p_tail_hash: proof });
  return reply(body, status);
}
