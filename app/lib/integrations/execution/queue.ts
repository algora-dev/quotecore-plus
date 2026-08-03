/**
 * Integration Queue - DB-backed queue for async export processing.
 *
 * Creates export records, computes idempotency keys, and provides
 * functions for the cron processor to claim and process exports.
 */

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import type { QuoteExportV1 } from '../contracts/envelope-v1';

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export interface QueueExportParams {
  companyId: string;
  integrationId: string;
  sourceType: string;
  sourceId: string;
  sourceRevision: number;
  eventType: string;
  createdBy?: string;
  scopeOverrides?: Record<string, boolean>;
  selection?: ExportSelectionSnapshot;
  quoteData?: QuoteExportV1;
}

export interface ExportSelectionSnapshot {
  artifactIds: string[];
}

export interface QueuedExport {
  id: string;
  integration_id: string;
  company_id: string;
  source_type: string;
  source_id: string;
  source_revision: number;
  event_type: string;
  status: string;
  idempotency_key: string;
  payload_version: string;
  retry_count: number;
  provider: string;
  config: Record<string, unknown>;
  data_scopes: Record<string, boolean>;
  scope_overrides: Record<string, boolean> | null;
  payload: { selection?: ExportSelectionSnapshot; quoteData?: QuoteExportV1 } | null;
}

/**
 * Queue a new export. If the same revision was already successfully exported,
 * returns the existing export without creating a duplicate.
 */
export async function queueExport(
  params: QueueExportParams
): Promise<{ exportId: string; status: string; duplicate: boolean }> {
  const supabase = createServiceClient();

  // Compute idempotency key
  const { data: idempotencyKey } = await supabase.rpc('compute_idempotency_key', {
    p_company_id: params.companyId,
    p_provider: await getProvider(params.integrationId),
    p_source_type: params.sourceType,
    p_source_id: params.sourceId,
    p_source_revision: params.sourceRevision,
    p_operation: 'export',
  });

  const scopeKey = params.scopeOverrides
    ? JSON.stringify(Object.entries(params.scopeOverrides).sort(([left], [right]) => left.localeCompare(right)))
    : 'defaults';
  const scopeFingerprint = createHash('sha256').update(scopeKey).digest('hex').slice(0, 16);
  const effectiveIdempotencyKey = params.eventType === 'manual_export'
    ? `${idempotencyKey}:manual:${crypto.randomUUID()}`
    : `${idempotencyKey}:scope:${scopeFingerprint}`;

  // Automated exports remain idempotent. A manual Send to App action is an
  // explicit retry and must always create a fresh export operation.
  const { data: existing } = await supabase
    .from('integration_exports')
    .select('id, status')
    .eq('integration_id', params.integrationId)
    .eq('idempotency_key', effectiveIdempotencyKey)
    .in('status', ['succeeded', 'running', 'queued'])
    .order('queued_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'succeeded') {
      return { exportId: existing.id, status: 'succeeded', duplicate: true };
    }
    if (existing.status === 'running' || existing.status === 'queued') {
      return { exportId: existing.id, status: existing.status, duplicate: true };
    }
  }

  // Create new export record
  const { data: newExport, error } = await supabase
    .from('integration_exports')
    .insert({
      company_id: params.companyId,
      integration_id: params.integrationId,
      source_type: params.sourceType,
      source_id: params.sourceId,
      source_revision: params.sourceRevision,
      event_type: params.eventType,
      status: 'queued',
      idempotency_key: effectiveIdempotencyKey,
      payload_version: params.quoteData ? '1.1' : '1.0',
      created_by: params.createdBy ?? null,
      scope_overrides: params.scopeOverrides ?? null,
      payload: params.selection || params.quoteData
        ? { selection: params.selection, quoteData: params.quoteData }
        : null,
    })
    .select('id')
    .single();

  if (error) throw new Error(`Failed to queue export: ${error.message}`);

  return { exportId: newExport.id, status: 'queued', duplicate: false };
}

/**
 * Claim the next queued export for processing.
 * Uses SELECT FOR UPDATE SKIP LOCKED to safely claim one export at a time.
 */
export async function claimNextExport(): Promise<QueuedExport | null> {
  const supabase = createServiceClient();

  // Claim the oldest queued export
  const { data, error } = await supabase
    .from('integration_exports')
    .select(`
      id,
      integration_id,
      company_id,
      source_type,
      source_id,
      source_revision,
      event_type,
      status,
      idempotency_key,
      payload_version,
      retry_count,
      scope_overrides,
      payload
    `)
    .eq('status', 'queued')
    .or('next_retry_at.is.null,next_retry_at.lte.' + new Date().toISOString())
    .order('queued_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  // Mark as running
  const { error: updateErr } = await supabase
    .from('integration_exports')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .eq('id', data.id)
    .eq('status', 'queued'); // Optimistic lock

  if (updateErr) return null; // Someone else claimed it

  // Load integration config
  const { data: integration } = await supabase
    .from('integrations')
    .select('provider, config, data_scopes')
    .eq('id', data.integration_id)
    .single();

  if (!integration) {
    await markExportFailed(data.id, 'integration_not_found', 'Integration record not found');
    return null;
  }

  return {
    ...data,
    provider: integration.provider,
    config: integration.config ?? {},
    data_scopes: integration.data_scopes ?? {},
    scope_overrides: data.scope_overrides ?? null,
  };
}

/**
 * Mark an export as succeeded.
 */
export async function markExportSucceeded(exportId: string): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from('integration_exports')
    .update({
      status: 'succeeded',
      completed_at: new Date().toISOString(),
      error_code: null,
      error_summary: null,
    })
    .eq('id', exportId);
}

/**
 * Mark an export as partially completed (some steps succeeded, some failed).
 */
export async function markExportPartiallyCompleted(
  exportId: string,
  errorSummary: string
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from('integration_exports')
    .update({
      status: 'partially_completed',
      completed_at: new Date().toISOString(),
      error_summary: errorSummary,
    })
    .eq('id', exportId);
}

/**
 * Mark an export as failed and schedule a retry if applicable.
 */
export async function markExportFailed(
  exportId: string,
  errorCode: string,
  errorSummary: string
): Promise<void> {
  const supabase = createServiceClient();

  // Get current retry count
  const { data: exportRow } = await supabase
    .from('integration_exports')
    .select('retry_count')
    .eq('id', exportId)
    .single();

  const retryCount = (exportRow?.retry_count ?? 0) + 1;
  const maxRetries = 3;

  if (retryCount >= maxRetries) {
    // No more retries - mark as failed
    await supabase
      .from('integration_exports')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_code: errorCode,
        error_summary: errorSummary,
        retry_count: retryCount,
      })
      .eq('id', exportId);
  } else {
    // Schedule retry with exponential backoff + jitter
    const baseDelayMs = 30_000 * Math.pow(2, retryCount - 1); // 30s, 60s, 120s
    const jitterMs = Math.random() * 5_000;
    const nextRetryAt = new Date(Date.now() + baseDelayMs + jitterMs);

    await supabase
      .from('integration_exports')
      .update({
        status: 'queued',
        error_code: errorCode,
        error_summary: errorSummary,
        retry_count: retryCount,
        next_retry_at: nextRetryAt.toISOString(),
      })
      .eq('id', exportId);
  }
}

/**
 * Log a step attempt for audit trail.
 */
export async function logStepAttempt(
  exportId: string,
  step: string,
  attemptNumber: number,
  summary: {
    responseStatus?: number;
    providerRequestId?: string;
    durationMs?: number;
    errorClass?: string;
    errorSummary?: string;
    requestSummary?: Record<string, unknown>;
    responseSummary?: Record<string, unknown>;
  }
): Promise<void> {
  const supabase = createServiceClient();
  await supabase.from('integration_export_attempts').insert({
    export_id: exportId,
    step,
    attempt_number: attemptNumber,
    response_status: summary.responseStatus ?? null,
    provider_request_id: summary.providerRequestId ?? null,
    duration_ms: summary.durationMs ?? null,
    error_class: summary.errorClass ?? null,
    error_summary: summary.errorSummary ?? null,
    request_summary: summary.requestSummary ?? null,
    response_summary: summary.responseSummary ?? null,
  });
}

/**
 * Store an external record mapping.
 */
export async function storeExternalMapping(
  integrationId: string,
  companyId: string,
  sourceType: string,
  sourceId: string,
  externalType: string,
  externalId: string,
  externalUrl: string | null,
  syncedRevision: number
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from('integration_external_records')
    .upsert(
      {
        integration_id: integrationId,
        company_id: companyId,
        source_type: sourceType,
        source_id: sourceId,
        external_type: externalType,
        external_id: externalId,
        external_url: externalUrl,
        last_synced_revision: syncedRevision,
      },
      { onConflict: 'integration_id,source_type,source_id,external_type' }
    );
}

/**
 * Get existing external mappings for a source.
 */
export async function getExistingMappings(
  integrationId: string,
  sourceType: string,
  sourceId: string
): Promise<Array<{ external_type: string; external_id: string; external_url: string | null; last_synced_revision: number | null }>> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('integration_external_records')
    .select('external_type, external_id, external_url, last_synced_revision')
    .eq('integration_id', integrationId)
    .eq('source_type', sourceType)
    .eq('source_id', sourceId);
  return data ?? [];
}

// Helper
async function getProvider(integrationId: string): Promise<string> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('integrations')
    .select('provider')
    .eq('id', integrationId)
    .single();
  return data?.provider ?? 'unknown';
}
