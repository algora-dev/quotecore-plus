/** P2 usage contracts. No browser amounts or calendar-month guesses. */
export interface RpcClient {
  rpc(name: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
}
export class UsageError extends Error {
  constructor(public readonly code: string, message: string, public readonly httpStatus = 503,
    public readonly details: Record<string, unknown> = {}) {
    super(message); this.name = 'UsageError';
  }
}
export function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
}
export function safeCount(value: unknown, name: string): number {
  // PostgREST can serialize BIGINT as a number. Do not silently coerce null to 0.
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new UsageError('usage_data_invalid', `${name} could not be verified.`);
  }
  return value;
}
export type UsageSnapshot = {
  kind: 'custom'; available: boolean; reason: string; accountId: string;
  mode: 'test' | 'live'; subscriptionId: string; periodStart: string; periodEnd: string;
  quotesUsed: number; scanTokensUsed: number; assistantTasksUsed: number;
  storageUsedBytes: number; storagePendingBytes: number;
};
export function parseUsageSnapshot(value: unknown): UsageSnapshot {
  const r = record(value);
  if (r.kind !== 'custom' || typeof r.available !== 'boolean' || typeof r.reason !== 'string'
    || typeof r.accountId !== 'string' || !/^acct_[A-Za-z0-9]+$/.test(r.accountId)
    || (r.mode !== 'test' && r.mode !== 'live') || typeof r.subscriptionId !== 'string'
    || !/^sub_[A-Za-z0-9]+$/.test(r.subscriptionId)
    || typeof r.periodStart !== 'string' || typeof r.periodEnd !== 'string'
    || !Number.isFinite(Date.parse(r.periodStart)) || !Number.isFinite(Date.parse(r.periodEnd))
    || Date.parse(r.periodStart) >= Date.parse(r.periodEnd)) {
    throw new UsageError('usage_data_invalid', 'Your purchased usage could not be verified.');
  }
  return { kind: 'custom', available: r.available, reason: r.reason, accountId: r.accountId,
    mode: r.mode, subscriptionId: r.subscriptionId, periodStart: r.periodStart, periodEnd: r.periodEnd,
    quotesUsed: safeCount(r.quotesUsed, 'Quote usage'), scanTokensUsed: safeCount(r.scanTokensUsed, 'Scan usage'),
    assistantTasksUsed: safeCount(r.assistantTasksUsed, 'Assistant usage'),
    storageUsedBytes: safeCount(r.storageUsedBytes, 'Storage usage'),
    storagePendingBytes: safeCount(r.storagePendingBytes, 'Pending storage') };
}
export function usageError(error: unknown): UsageError {
  if (error instanceof UsageError) return error;
  const e = record(error); let details: Record<string, unknown> = {};
  if (typeof e.details === 'string') { try { details = record(JSON.parse(e.details)); } catch { /* not JSON */ } }
  switch (e.code) {
    case 'QCP01': return new UsageError('custom_access_unavailable', 'This tool needs an active paid setup that includes it.', 403);
    case 'QCP02': return new UsageError('allowance_reached', 'You have reached this allowance. Review your setup or wait for your next billing period.', 429, details);
    case 'QCP03': return new UsageError('request_conflict', 'This request cannot be reused. Refresh its status before trying again.', 409);
    case 'QCP04': return new UsageError('custom_scan_protocol_required', 'This scan path is not enabled for custom setups yet.', 409);
    case 'QCP05': return new UsageError('request_rate_limited', 'Too many attempts. Please try again later.', 429);
    case 'QCP06': return new UsageError('storage_quota_exceeded', 'This file would exceed your storage allowance. Free space or change your setup.', 413, details);
    case 'QCP07': return new UsageError('storage_finalization_required', 'This upload needs to be verified before it can be saved.', 409);
    case 'QCP08': return new UsageError('assistant_processing_unavailable', 'Assistant processing is paused for a setup or safety check. This is not an instruction to buy more tasks.', 503);
    case '42501': return new UsageError('not_authorized', 'You do not have access to this request.', 403);
    case '22023': return new UsageError('invalid_request', 'Check the request and try again.', 400);
    default: return new UsageError('usage_unavailable', 'Usage could not be verified. Nothing further has been started.', 503);
  }
}
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).filter(([,v]) => v !== undefined)
    .sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([k,v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
  throw new UsageError('invalid_request', 'The request contains an unsupported value.', 400);
}
