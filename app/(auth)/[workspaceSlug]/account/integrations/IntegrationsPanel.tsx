'use client';

import { useState, useEffect } from 'react';
import type { IntegrationRecord, ExportHistoryItem, IntegrationProvider } from './actions';
import {
  saveIntegration,
  deleteIntegration,
  getExportHistory,
  queueQuoteExport,
} from './actions';

const PROVIDER_INFO: Record<IntegrationProvider, { name: string; description: string; icon: string }> = {
  zapier: {
    name: 'Zapier',
    description: 'Send quotes to 6,000+ apps via Zapier webhooks. Fastest way to connect.',
    icon: '⚡',
  },
  jobnimbus: {
    name: 'JobNimbus',
    description: 'Create contacts, jobs, and attach quotes directly in JobNimbus.',
    icon: '🏠',
  },
  fergus: {
    name: 'Fergus',
    description: 'Send customers, jobs, and quotes to Fergus job management.',
    icon: '🔧',
  },
};

export function IntegrationsPanel({
  companyId,
  initialIntegrations,
}: {
  companyId: string;
  initialIntegrations: IntegrationRecord[];
}) {
  const [integrations, setIntegrations] = useState(initialIntegrations);
  const [activeProvider, setActiveProvider] = useState<IntegrationProvider | null>(null);
  const [history, setHistory] = useState<ExportHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load export history
  useEffect(() => {
    if (integrations.length === 0) return;
    setLoadingHistory(true);
    getExportHistory(companyId, 10)
      .then(setHistory)
      .finally(() => setLoadingHistory(false));
  }, [companyId, integrations.length]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
        <p className="mt-1 text-sm text-slate-500">
          Send completed quotes to the job management platform you already use.
        </p>
      </div>

      {/* Provider cards */}
      <div className="grid gap-3">
        {(Object.keys(PROVIDER_INFO) as IntegrationProvider[]).map((provider) => {
          const info = PROVIDER_INFO[provider];
          const integration = integrations.find((i) => i.provider === provider);
          const connected = integration?.connection_status === 'connected';

          return (
            <div
              key={provider}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{info.icon}</span>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">{info.name}</h3>
                    <p className="mt-0.5 text-xs text-slate-500">{info.description}</p>
                    {connected && (
                      <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Connected
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveProvider(activeProvider === provider ? null : provider)}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:border-orange-300 hover:bg-orange-50/40 transition"
                >
                  {connected ? 'Configure' : 'Connect'}
                </button>
              </div>

              {/* Configuration form */}
              {activeProvider === provider && (
                <ProviderConfigForm
                  companyId={companyId}
                  provider={provider}
                  integration={integration}
                  onSave={async (config, scopes, credentials) => {
                    const result = await saveIntegration(companyId, provider, config, scopes, credentials);
                    if (result.success) {
                      // Refresh integrations
                      const updated = integrations.filter((i) => i.provider !== provider);
                      setIntegrations([...updated, {
                        id: result.integrationId!,
                        provider,
                        enabled: true,
                        config,
                        data_scopes: scopes,
                        connection_status: 'connected',
                        last_validated_at: new Date().toISOString(),
                        created_at: new Date().toISOString(),
                      }]);
                      setActiveProvider(null);
                    }
                  }}
                  onDelete={async () => {
                    if (!integration) return;
                    await deleteIntegration(companyId, integration.id);
                    setIntegrations(integrations.filter((i) => i.id !== integration.id));
                    setActiveProvider(null);
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Export history */}
      {integrations.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-900 mb-3">Recent Exports</h3>
          {loadingHistory ? (
            <p className="text-xs text-slate-400">Loading...</p>
          ) : history.length === 0 ? (
            <p className="text-xs text-slate-400">No exports yet. Send a quote to an integration to see it here.</p>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{PROVIDER_INFO[item.provider as IntegrationProvider]?.icon ?? '🔌'}</span>
                    <div>
                      <p className="text-xs font-medium text-slate-700">
                        {item.provider} - {item.event_type.replace(/_/g, ' ')}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(item.queued_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <ExportStatusBadge status={item.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ExportStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    succeeded: 'bg-green-50 text-green-700',
    failed: 'bg-red-50 text-red-700',
    queued: 'bg-blue-50 text-blue-700',
    running: 'bg-yellow-50 text-yellow-700',
    partially_completed: 'bg-orange-50 text-orange-700',
    requires_attention: 'bg-orange-50 text-orange-700',
    cancelled: 'bg-slate-50 text-slate-500',
  };
  const labels: Record<string, string> = {
    succeeded: 'Success',
    failed: 'Failed',
    queued: 'Queued',
    running: 'Running',
    partially_completed: 'Partial',
    requires_attention: 'Attention',
    cancelled: 'Cancelled',
  };
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${styles[status] ?? styles.cancelled}`}>
      {labels[status] ?? status}
    </span>
  );
}

function ProviderConfigForm({
  companyId,
  provider,
  integration,
  onSave,
  onDelete,
}: {
  companyId: string;
  provider: IntegrationProvider;
  integration?: IntegrationRecord;
  onSave: (config: Record<string, unknown>, scopes: Record<string, boolean>, credentials?: Record<string, string>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [webhookUrl, setWebhookUrl] = useState((integration?.config?.webhookUrl as string) ?? '');
  const [saving, setSaving] = useState(false);

  // Data scopes
  const [scopes, setScopes] = useState<Record<string, boolean>>(
    integration?.data_scopes ?? {
      customerDetails: true,
      siteDetails: true,
      customerFacingQuote: true,
      internalCosts: false,
      marginInformation: false,
      labourBreakdown: false,
      measurementsAndTakeoff: false,
      filesAndPlans: true,
      internalNotes: false,
      acceptanceDetails: true,
    }
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      if (provider === 'zapier') {
        await onSave({ webhookUrl }, scopes, { webhookUrl });
      } else {
        await onSave({}, scopes);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
      {provider === 'zapier' && (
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Zapier Webhook URL
          </label>
          <input
            type="url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://hooks.zapier.com/hooks/catch/..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
          />
          <p className="mt-1 text-xs text-slate-400">
            Create a Zap with a webhook trigger, then paste the Catch Hook URL here.
          </p>
        </div>
      )}

      {provider !== 'zapier' && (
        <div className="rounded-lg bg-slate-50 px-3 py-3">
          <p className="text-xs text-slate-500">
            {provider === 'jobnimbus'
              ? 'JobNimbus native connector coming soon. Use Zapier in the meantime to connect JobNimbus.'
              : 'Fergus native connector coming soon. Use Zapier in the meantime to connect Fergus.'}
          </p>
        </div>
      )}

      {/* Data scopes */}
      <div>
        <p className="text-xs font-medium text-slate-700 mb-2">Data to include in exports</p>
        <div className="space-y-1.5">
          {[
            { key: 'customerDetails', label: 'Customer details', default: true },
            { key: 'siteDetails', label: 'Site details', default: true },
            { key: 'customerFacingQuote', label: 'Customer-facing quote lines', default: true },
            { key: 'filesAndPlans', label: 'Files and plans', default: true },
            { key: 'acceptanceDetails', label: 'Quote acceptance status', default: true },
            { key: 'internalCosts', label: 'Internal costs (material/labour)', default: false },
            { key: 'marginInformation', label: 'Margin/profit information', default: false },
            { key: 'labourBreakdown', label: 'Labour breakdown', default: false },
            { key: 'measurementsAndTakeoff', label: 'Measurements and takeoff detail', default: false },
            { key: 'internalNotes', label: 'Internal notes', default: false },
          ].map((scope) => (
            <label key={scope.key} className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={scopes[scope.key] ?? scope.default}
                onChange={(e) => setScopes({ ...scopes, [scope.key]: e.target.checked })}
                className="rounded border-slate-300"
              />
              {scope.label}
              {!scope.default && (
                <span className="text-slate-400">(sensitive - off by default)</span>
              )}
            </label>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || (provider === 'zapier' && !webhookUrl)}
          className="rounded-full bg-black px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {saving ? 'Saving...' : integration ? 'Update' : 'Connect'}
        </button>
        {integration && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-full border border-red-200 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition"
          >
            Disconnect
          </button>
        )}
      </div>
    </div>
  );
}
