'use server';

/**
 * Server actions for integration management.
 *
 * - Create/update/delete integrations
 * - Store/retrieve credentials (encrypted)
 * - Queue exports
 * - Load export history
 */

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { queueExport } from '@/app/lib/integrations/execution/queue';
import { getQuoteRevision } from '@/app/lib/integrations/export-builder/build-quote-export';

function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export type IntegrationProvider = 'zapier' | 'jobnimbus' | 'fergus';

export interface IntegrationRecord {
  id: string;
  provider: IntegrationProvider;
  enabled: boolean;
  config: Record<string, unknown>;
  data_scopes: Record<string, boolean>;
  connection_status: string;
  last_validated_at: string | null;
  created_at: string;
}

export async function getIntegrations(companyId: string): Promise<IntegrationRecord[]> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('integrations')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data as IntegrationRecord[];
}

export async function getIntegration(companyId: string, provider: IntegrationProvider): Promise<IntegrationRecord | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('integrations')
    .select('*')
    .eq('company_id', companyId)
    .eq('provider', provider)
    .maybeSingle();
  return data as IntegrationRecord | null;
}

export async function saveIntegration(
  companyId: string,
  provider: IntegrationProvider,
  config: Record<string, unknown>,
  dataScopes: Record<string, boolean>,
  credentials?: Record<string, string>
): Promise<{ success: boolean; error?: string; integrationId?: string }> {
  const supabase = createServiceClient();

  // Upsert integration record
  const { data: existing } = await supabase
    .from('integrations')
    .select('id')
    .eq('company_id', companyId)
    .eq('provider', provider)
    .maybeSingle();

  let integrationId: string;

  if (existing) {
    const { data: updated, error } = await supabase
      .from('integrations')
      .update({
        config,
        data_scopes: dataScopes,
        connection_status: 'connected',
        last_validated_at: new Date().toISOString(),
        enabled: true,
      })
      .eq('id', existing.id)
      .select('id')
      .single();
    if (error) return { success: false, error: error.message };
    integrationId = updated.id;
  } else {
    const { data: created, error } = await supabase
      .from('integrations')
      .insert({
        company_id: companyId,
        provider,
        config,
        data_scopes: dataScopes,
        connection_status: 'connected',
        last_validated_at: new Date().toISOString(),
        enabled: true,
      })
      .select('id')
      .single();
    if (error) return { success: false, error: error.message };
    integrationId = created.id;
  }

  // Store credentials encrypted if provided
  if (credentials) {
    const encryptionKey = process.env.INTEGRATION_ENCRYPTION_KEY;
    if (!encryptionKey) {
      return { success: false, error: 'INTEGRATION_ENCRYPTION_KEY not configured' };
    }

    for (const [type, value] of Object.entries(credentials)) {
      if (!value) continue;
      const { data: encrypted } = await supabase.rpc('encrypt_credential', {
        p_plaintext: value,
        p_key: encryptionKey,
      });

      if (encrypted) {
        await supabase
          .from('integration_credentials')
          .upsert(
            {
              integration_id: integrationId,
              credential_type: type,
              encrypted_payload: encrypted,
              last_rotated_at: new Date().toISOString(),
            },
            { onConflict: 'integration_id,credential_type' }
          );
      }
    }
  }

  revalidatePath('/[workspaceSlug]/account', 'layout');
  return { success: true, integrationId };
}

export async function deleteIntegration(
  companyId: string,
  integrationId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from('integrations')
    .delete()
    .eq('id', integrationId)
    .eq('company_id', companyId);

  if (error) return { success: false, error: error.message };
  revalidatePath('/[workspaceSlug]/account', 'layout');
  return { success: true };
}

export async function queueQuoteExport(
  companyId: string,
  integrationId: string,
  quoteId: string,
  eventType: string = 'manual_export'
): Promise<{ success: boolean; error?: string; exportId?: string; status?: string; duplicate?: boolean }> {
  const revision = await getQuoteRevision(quoteId, companyId);
  if (revision === 0) {
    return { success: false, error: 'Quote not found' };
  }

  const result = await queueExport({
    companyId,
    integrationId,
    sourceType: 'quote',
    sourceId: quoteId,
    sourceRevision: revision,
    eventType,
  });

  return {
    success: true,
    exportId: result.exportId,
    status: result.status,
    duplicate: result.duplicate,
  };
}

export interface ExportHistoryItem {
  id: string;
  provider: string;
  source_id: string;
  source_revision: number;
  event_type: string;
  status: string;
  queued_at: string;
  completed_at: string | null;
  error_summary: string | null;
  external_records?: Array<{ external_type: string; external_id: string; external_url: string | null }>;
}

export async function getExportHistory(
  companyId: string,
  limit: number = 20
): Promise<ExportHistoryItem[]> {
  const supabase = createServiceClient();

  const { data: exports } = await supabase
    .from('integration_exports')
    .select(`
      id,
      integration_id,
      source_id,
      source_revision,
      event_type,
      status,
      queued_at,
      completed_at,
      error_summary
    `)
    .eq('company_id', companyId)
    .order('queued_at', { ascending: false })
    .limit(limit);

  if (!exports || exports.length === 0) return [];

  // Load provider names and external records
  const integrationIds = [...new Set(exports.map((e) => e.integration_id))];
  const [{ data: integrations }, { data: externalRecords }] = await Promise.all([
    supabase.from('integrations').select('id, provider').in('id', integrationIds),
    supabase
      .from('integration_external_records')
      .select('integration_id, source_id, external_type, external_id, external_url')
      .in('integration_id', integrationIds)
      .eq('source_type', 'quote')
      .in('source_id', exports.map((e) => e.source_id)),
  ]);

  const providerMap = new Map((integrations ?? []).map((i) => [i.id, i.provider]));
  const recordsBySource = new Map<string, ExportHistoryItem['external_records']>();
  for (const r of externalRecords ?? []) {
    const key = `${r.integration_id}:${r.source_id}`;
    const list = recordsBySource.get(key) ?? [];
    list.push({ external_type: r.external_type, external_id: r.external_id, external_url: r.external_url });
    recordsBySource.set(key, list);
  }

  return exports.map((e) => ({
    id: e.id,
    provider: providerMap.get(e.integration_id) ?? 'unknown',
    source_id: e.source_id,
    source_revision: e.source_revision,
    event_type: e.event_type,
    status: e.status,
    queued_at: e.queued_at,
    completed_at: e.completed_at,
    error_summary: e.error_summary,
    external_records: recordsBySource.get(`${e.integration_id}:${e.source_id}`),
  }));
}
