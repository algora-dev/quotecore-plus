/**
 * Dispatcher - claims queued exports and routes them to the correct connector.
 *
 * Called by the Vercel cron API route every 1-2 minutes.
 * Each invocation claims and processes ONE export to stay within serverless
 * timeout limits.
 */

import { buildQuoteExport, getQuoteRevision } from '../export-builder/build-quote-export';
import { ensureConnectorsRegistered, getConnector } from '../connectors';
import {
  claimNextExport,
  markExportSucceeded,
  markExportFailed,
  markExportPartiallyCompleted,
  logStepAttempt,
  storeExternalMapping,
  getExistingMappings,
  type QueuedExport,
} from './queue';
import type { IntegrationEnvelopeV1, QuoteExportV1 } from '../contracts/envelope-v1';
import type { Connector, IntegrationConfig, ExecutionContext, DataScopes } from '../contracts/connector';
import { DEFAULT_DATA_SCOPES } from '../contracts/connector';

// Connector registry is managed in connectors/index.ts
// ensureConnectorsRegistered() is called at the start of processNextExport()

/**
 * Process the next queued export. Called by the cron route.
 * Returns true if an export was processed, false if queue was empty.
 */
export async function processNextExport(): Promise<boolean> {
  ensureConnectorsRegistered();
  const queued = await claimNextExport();
  if (!queued) return false;

  try {
    await processExport(queued);
  } catch (err) {
    console.error(`[integrations] Unhandled error processing export ${queued.id}:`, err);
    await markExportFailed(
      queued.id,
      'unhandled_error',
      err instanceof Error ? err.message : 'Unknown error'
    );
  }

  return true;
}

async function processExport(queued: QueuedExport): Promise<void> {
  // Load connector
  const connector = await getConnector(queued.provider);
  if (!connector) {
    await markExportFailed(queued.id, 'unknown_provider', `No connector registered for provider: ${queued.provider}`);
    return;
  }

  // Build canonical export from quote data
  const quoteData = await buildQuoteExport(queued.source_id, queued.company_id);
  if (!quoteData) {
    await markExportFailed(queued.id, 'quote_not_found', 'Quote data could not be loaded');
    return;
  }

  // Build envelope
  const envelope: IntegrationEnvelopeV1 = {
    schemaVersion: '1.0',
    eventId: crypto.randomUUID(),
    eventType: queued.event_type as IntegrationEnvelopeV1['eventType'],
    occurredAt: new Date().toISOString(),
    exportedAt: new Date().toISOString(),
    companyId: queued.company_id,
    resource: {
      type: 'quote',
      id: queued.source_id,
      revision: queued.source_revision,
    },
    data: quoteData,
  };

  // Build config - merge defaults with integration settings, then apply per-export overrides
  const baseScopes: DataScopes = { ...DEFAULT_DATA_SCOPES, ...queued.data_scopes };
  const dataScopes: DataScopes = queued.scope_overrides
    ? { ...baseScopes, ...queued.scope_overrides }
    : baseScopes;
  const config: IntegrationConfig = {
    provider: queued.provider,
    config: queued.config,
    dataScopes,
  };

  // Get existing mappings for partial-failure recovery
  const existingMappings = await getExistingMappings(
    queued.integration_id,
    queued.source_type,
    queued.source_id
  );

  // Build execution context
  const context: ExecutionContext = {
    integrationId: queued.integration_id,
    companyId: queued.company_id,
    exportId: queued.id,
    attemptNumber: queued.retry_count + 1,
    getCredential: async (credentialType: string) => {
      return getCredential(queued.integration_id, credentialType);
    },
    getSignedUrl: async (path: string, expiresInSec: number) => {
      return getSignedUrl(path, expiresInSec);
    },
    logStep: async (step, summary) => {
      await logStepAttempt(queued.id, step, queued.retry_count + 1, summary);
    },
    existingMappings: existingMappings.map((m) => ({
      externalType: m.external_type,
      externalId: m.external_id,
      externalUrl: m.external_url,
      lastSyncedRevision: m.last_synced_revision,
    })),
  };

  // Validate
  const validation = await connector.validateExport(envelope, config);
  if (!validation.valid) {
    await markExportFailed(queued.id, 'validation_failed', validation.errors.join('; '));
    return;
  }

  // Plan
  const plan = await connector.plan(envelope, config, {
    integrationId: queued.integration_id,
    companyId: queued.company_id,
    exportId: queued.id,
    attemptNumber: queued.retry_count + 1,
  });

  // Execute
  const result = await connector.execute(plan, envelope, config, context);

  // Store external record mappings
  for (const record of result.externalRecords) {
    await storeExternalMapping(
      queued.integration_id,
      queued.company_id,
      queued.source_type,
      queued.source_id,
      record.externalType,
      record.externalId,
      record.externalUrl,
      queued.source_revision
    );
  }

  // Update export status
  if (result.status === 'succeeded') {
    await markExportSucceeded(queued.id);
  } else if (result.status === 'partially_completed') {
    await markExportPartiallyCompleted(queued.id, result.errorSummary ?? 'Some steps failed');
  } else {
    await markExportFailed(queued.id, 'connector_failed', result.errorSummary ?? 'Connector execution failed');
  }
}

async function getCredential(integrationId: string, credentialType: string): Promise<string | null> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data } = await supabase.rpc('get_integration_credential', {
    p_integration_id: integrationId,
    p_credential_type: credentialType,
    p_encryption_key: process.env.INTEGRATION_ENCRYPTION_KEY!,
  });

  return data ?? null;
}

async function getSignedUrl(path: string, expiresInSec: number): Promise<string | null> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const { data } = await supabase.storage
    .from('quote-files')
    .createSignedUrl(path, expiresInSec);

  return data?.signedUrl ?? null;
}
