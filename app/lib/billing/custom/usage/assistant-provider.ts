import { createHash } from 'node:crypto';
import { canonicalJson, record, safeCount, UsageError, usageError } from './contracts';
import type { RpcClient } from './contracts';
/** Integrate at the ACTUAL model/embedding/vision boundary, not the old guide bot.
 * inputTokenUpperBound must include full history, tool schemas, framing and any
 * image tokens. It is a server-owned bound, never a browser supplied number.
 * Provider retries must each have a distinct call key and reservation.
 */
export async function withAssistantProviderBudget<T>(input: {
  companyId: string; runId: string; accountId: string; mode: 'test' | 'live'; callKey: string; providerRequest: unknown;
  inputTokenUpperBound: number; maxOutputTokens: number; timeoutMs: number;
  client: RpcClient;
  execute: (limits: { maxOutputTokens: number; signal: AbortSignal }) => Promise<{ value: T; totalTokens: number }>;
}): Promise<T> {
  const count = safeCount(input.inputTokenUpperBound, 'Input token bound');
  const output = safeCount(input.maxOutputTokens, 'Output token limit');
  if (output === 0 || !Number.isSafeInteger(count+output) || !Number.isSafeInteger(input.timeoutMs)
    || input.timeoutMs < 1 || input.timeoutMs > 180000) throw new UsageError('invalid_provider_budget', 'The processing budget is invalid.');
  const call = async (name: string, params: Record<string, unknown>) => {
    const result = await input.client.rpc(name, params);
    if (result.error) throw usageError(result.error);
    const data = record(result.data);
    if (!Object.keys(data).length) throw new UsageError('provider_budget_unavailable', 'Processing could not be accounted for.');
    return data;
  };
  const begin = await call('qcp_begin_assistant_call', { p_company_id: input.companyId, p_run_id: input.runId, p_account_id: input.accountId, p_mode: input.mode,
    p_call_key: input.callKey, p_payload_hash: createHash('sha256').update(canonicalJson(input.providerRequest)).digest('hex'),
    p_reserved_tokens: count+output, p_output_limit: output });
  if (typeof begin.id !== 'string' || begin.maxOutputTokens !== output) throw new UsageError('provider_budget_invalid', 'Processing was not admitted.');
  let result: { value: T; totalTokens: number };
  try {
    // The adapter MUST pass the signal and output limit to the provider SDK.
    // No Promise.race: abandoning a promise does not stop a billable request.
    result = await input.execute({ maxOutputTokens: output, signal: AbortSignal.timeout(input.timeoutMs) });
    safeCount(result.totalTokens, 'Actual provider usage');
  } catch (error) {
    // Unknown provider usage retains the reserved ceiling; never write zero.
    try { await call('qcp_finish_assistant_call', { p_company_id: input.companyId, p_call_id: begin.id, p_actual_tokens: null }); }
    catch { /* reservation remains, preventing an accounting failure from granting spend */ }
    throw error;
  }
  const finish = await call('qcp_finish_assistant_call', { p_company_id: input.companyId,
    p_call_id: begin.id, p_actual_tokens: result.totalTokens });
  if (finish.overrun === true || finish.settled !== true) throw new UsageError('provider_budget_review_required', 'This task reached a processing safety limit.');
  return result.value;
}
