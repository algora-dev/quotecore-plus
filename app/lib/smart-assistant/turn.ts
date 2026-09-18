// Smart Assistant turn protocol - server side.
// Admission/finish/state live in Postgres (sa_admit_run / sa_finish_run /
// sa_get_state RPCs, patch_043) so the guarantees (one active run, idempotent
// submits, flag refusal, stale-run recovery) are atomic at the DB level.
// The pipeline itself is ported in a later slice; runPipeline is the seam.

export type AdmitResult =
  | { kind: 'accepted'; runId: string; messageId: string }
  | { kind: 'duplicate'; runId: string }
  | { kind: 'refused'; errorCode: string };

export type TurnResponse = {
  ok: boolean;
  status: 'completed' | 'duplicate' | 'refused';
  run_id?: string;
  error_code?: string;
  reply?: string;
};

/** Map sa_admit_run rows to a discriminated result. */
export function parseAdmitRow(row: unknown): AdmitResult {
  const r = row as {
    ok: boolean;
    status: string;
    run_id: string | null;
    message_id: string | null;
    error_code: string | null;
  };
  if (!r.ok) {
    return { kind: 'refused', errorCode: r.error_code ?? 'refused' };
  }
  if (r.status === 'duplicate') {
    return { kind: 'duplicate', runId: r.run_id ?? '' };
  }
  return { kind: 'accepted', runId: r.run_id ?? '', messageId: r.message_id ?? '' };
}

/** HTTP status for a refusal. */
export function refusalStatus(errorCode: string): number {
  switch (errorCode) {
    case 'unauthenticated':
      return 401;
    case 'run_in_progress':
      return 409;
    case 'request_id_conflict':
      return 409;
    case 'quota_exceeded':
      return 429;
    case 'flag_off':
      return 404;
    case 'conversation_not_found':
      return 404;
    case 'not_owner':
      return 403;
    default:
      return 400;
  }
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { runOrchestratorTurn } from './orchestrator';

export interface PipelineContext {
  supabase: SupabaseClient;
  companyId: string;
  conversationId: string;
}

/**
 * The assistant pipeline seam. Admitted runs MUST reach sa_finish_run even on
 * failure, or the conversation locks until the 5-minute stale sweep frees it.
 * Executes the real orchestrator (config load, bounded authority, tool loop).
 */
export async function runPipeline(
  runId: string,
  userMessage: string,
  ctx: PipelineContext,
): Promise<{ content: string; tokensIn: number; tokensOut: number }> {
  const result = await runOrchestratorTurn({
    supabase: ctx.supabase,
    companyId: ctx.companyId,
    conversationId: ctx.conversationId,
    runId,
    userMessage,
  });
  return { content: result.content, tokensIn: result.tokensIn, tokensOut: result.tokensOut };
}

/** Usage already incurred when a pipeline fails mid-flight (never lost). */
export interface PipelineFailure {
  errorCode: string;
  tokensIn: number;
  tokensOut: number;
}

export function pipelineFailureDetails(err: unknown): PipelineFailure {
  if (err instanceof Error && (err as Error & { tokensIn?: number }).tokensIn != null) {
    const e = err as Error & { tokensIn: number; tokensOut: number; errorCode?: string };
    return { errorCode: e.errorCode ?? 'pipeline_error', tokensIn: e.tokensIn, tokensOut: e.tokensOut };
  }
  return { errorCode: 'pipeline_error', tokensIn: 0, tokensOut: 0 };
}

/**
 * Trusted finalization: SERVICE-ROLE client only. The browser user can request
 * runs but can never certify model output, terminal state, or token usage.
 * sa_finish_run is executable by service_role only (patch 045).
 */
export async function finishRunTrusted(
  admin: import('@supabase/supabase-js').SupabaseClient,
  input: {
    runId: string;
    status: 'completed' | 'failed';
    assistantContent?: string;
    errorCode?: string;
    tokensIn: number;
    tokensOut: number;
  },
): Promise<boolean> {
  const { data, error } = await admin.rpc('sa_finish_run', {
    p_run_id: input.runId,
    p_status: input.status,
    p_error_code: input.errorCode ?? undefined,
    p_assistant_content: input.assistantContent ?? undefined,
    p_tokens_in: input.tokensIn,
    p_tokens_out: input.tokensOut,
  });
  if (error) {
    console.error('[smart-assistant] trusted finish failed:', error.message);
    return false;
  }
  return data === true;
}
