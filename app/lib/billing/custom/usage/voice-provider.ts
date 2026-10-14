import { UsageError, record, safeCount, usageError, type RpcClient } from './contracts';

/**
 * Internal transcription spend guard for custom-setup accounts.
 * This deliberately does NOT create or consume a customer Assistant Task.
 * The subsequent accepted text/voice request is metered by the normal turn
 * admission path exactly once.
 */
export async function withVoiceProviderBudget<T>(input: {
  companyId: string;
  userId: string;
  accountId: string;
  mode: 'test' | 'live';
  requestKey: string;
  payloadHash: string;
  audioBytes: number;
  reservedMicroUsd: number;
  client: RpcClient;
  execute: (signal: AbortSignal) => Promise<{ value: T; actualMicroUsd?: number | null }>;
}): Promise<T> {
  const bytes = safeCount(input.audioBytes, 'Voice upload size');
  const reserve = safeCount(input.reservedMicroUsd, 'Voice reserve');
  if (bytes < 1 || reserve < 1 || !/^[a-f0-9]{64}$/.test(input.payloadHash)
      || input.requestKey.length < 8 || input.requestKey.length > 200) {
    throw new UsageError('invalid_voice_budget', 'The voice processing budget is invalid.');
  }
  const call = async (name: string, params: Record<string, unknown>) => {
    const result = await input.client.rpc(name, params);
    if (result.error) throw usageError(result.error);
    const data = record(result.data);
    if (!Object.keys(data).length) throw new UsageError('provider_budget_unavailable', 'Voice processing could not be accounted for.');
    return data;
  };
  const begin = await call('qcp_begin_voice_call', {
    p_company_id: input.companyId,
    p_user_id: input.userId,
    p_account_id: input.accountId,
    p_mode: input.mode,
    p_request_key: input.requestKey,
    p_payload_hash: input.payloadHash,
    p_audio_bytes: bytes,
    p_reserved_micro_usd: reserve,
  });
  if (typeof begin.id !== 'string') throw new UsageError('provider_budget_invalid', 'Voice processing was not admitted.');

  let result: { value: T; actualMicroUsd?: number | null };
  try {
    result = await input.execute(AbortSignal.timeout(90_000));
  } catch (error) {
    try {
      await call('qcp_finish_voice_call', { p_company_id: input.companyId, p_call_id: begin.id, p_actual_micro_usd: null });
    } catch { /* keep the reservation if accounting itself is unavailable */ }
    throw error;
  }

  const actual = result.actualMicroUsd == null ? null : safeCount(result.actualMicroUsd, 'Actual voice provider cost');
  const finish = await call('qcp_finish_voice_call', {
    p_company_id: input.companyId,
    p_call_id: begin.id,
    p_actual_micro_usd: actual,
  });
  if (finish.overrun === true) {
    // The completed transcript is still returned. The DB marks the overrun so
    // subsequent voice requests fail closed pending operational review.
    console.error('[billing/custom/voice] provider cost exceeded reserved ceiling', { companyId: input.companyId, callId: begin.id });
  }
  if (finish.accounted !== true) throw new UsageError('provider_budget_review_required', 'Voice processing reached a safety limit.');
  return result.value;
}
