/** Optional adapter for the host's existing scan UI. Do not modify roof geometry. */
export type CustomScanAttempt = { requestId: string; body: Record<string, unknown> };
export function createCustomScanAttempt(body: Record<string, unknown>, requestId = crypto.randomUUID()): CustomScanAttempt {
  if (!/^[A-Za-z0-9_.:-]{8,128}$/.test(requestId)) throw new Error('Invalid scan request ID');
  // Copy now. Mutating the UI state must not mutate the body of a retry.
  return { requestId, body: structuredClone({ ...body, clientRequestId: requestId }) };
}
export async function sendCustomScanAttempt(attempt: CustomScanAttempt,
  options: { signal?: AbortSignal; fetch?: typeof fetch } = {}): Promise<Response> {
  return (options.fetch ?? fetch)('/api/takeoff/ai-scan-v3', {
    method: 'POST', credentials: 'same-origin', signal: options.signal,
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attempt.requestId },
    body: JSON.stringify(attempt.body),
  });
}
/** Use the paid component RESULT unchanged for classification. User edits are
 * applied after completion, not smuggled into the free continuation. */
export function createComponentContinuation(paidAttempt: CustomScanAttempt,
  result: { success?: boolean; billingOperationId?: string; data?: { lines?: unknown[]; outlinePoints?: unknown[] };
    analysisDimensions?: unknown; canvasDimensions?: unknown }, requestId = crypto.randomUUID()): CustomScanAttempt {
  if (paidAttempt.body.stage !== 'scan2' || result.success !== true || !result.billingOperationId
    || !Array.isArray(result.data?.lines) || !Array.isArray(result.data?.outlinePoints)) {
    throw new Error('A completed paid component scan is required');
  }
  return createCustomScanAttempt({ ...paidAttempt.body, stage: 'scan3', scanOperationId: result.billingOperationId,
    lines: result.data.lines, outlinePoints: result.data.outlinePoints,
    analysisDimensions: result.analysisDimensions, canvasDimensions: result.canvasDimensions }, requestId);
}
