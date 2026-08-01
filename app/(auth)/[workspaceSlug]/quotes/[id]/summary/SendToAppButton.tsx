'use client';

import { useState } from 'react';
import { queueQuoteExport } from '@/app/(auth)/[workspaceSlug]/account/integrations/actions';

type Integration = {
  id: string;
  provider: string;
  enabled: boolean;
  connection_status: string;
};

const PROVIDER_LABELS: Record<string, { name: string; icon: string; description: string }> = {
  zapier: {
    name: 'Zapier',
    icon: '⚡',
    description: 'Send quotes to 6,000+ apps via Zapier webhooks.',
  },
  jobnimbus: {
    name: 'JobNimbus',
    icon: '🏠',
    description: 'Create contacts and jobs directly in JobNimbus.',
  },
  fergus: {
    name: 'Fergus',
    icon: '🔧',
    description: 'Send customers and quotes to Fergus job management.',
  },
};

export function SendToAppButton({
  quoteId,
  companyId,
  integrations,
  workspaceSlug,
}: {
  quoteId: string;
  companyId: string;
  integrations: Integration[];
  workspaceSlug: string;
}) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [result, setResult] = useState<{ provider: string; success: boolean; message: string } | null>(null);

  const connectedIntegrations = integrations.filter(
    (i) => i.enabled && i.connection_status === 'connected'
  );
  const hasConnected = connectedIntegrations.length > 0;

  const handleSend = async (integration: Integration) => {
    setSending(integration.id);
    setResult(null);
    try {
      const res = await queueQuoteExport(companyId, quoteId, integration.id);
      setResult({
        provider: integration.provider,
        success: res.success,
        message: res.success
          ? 'Queued - will be delivered within 1-2 minutes.'
          : res.error || 'Failed to queue export.',
      });
    } catch {
      setResult({
        provider: integration.provider,
        success: false,
        message: 'Unexpected error. Please try again.',
      });
    } finally {
      setSending(null);
    }
  };

  return (
    <>
      {/* Always visible - orange accent to distinguish from other action buttons */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Send to App"
        className="inline-flex items-center gap-1.5 rounded-full border border-orange-300 bg-orange-50/60 px-3 py-2 text-xs font-medium text-orange-700 hover:bg-orange-100 hover:border-orange-400 transition"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        Send to App
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40"
          onClick={() => {
            setOpen(false);
            setResult(null);
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">Send to App</h3>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setResult(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {result ? (
              <div className="space-y-3">
                <div className={`rounded-lg p-3 text-sm ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {result.message}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    setResult(null);
                  }}
                  className="w-full rounded-full bg-black px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
                >
                  Done
                </button>
              </div>
            ) : hasConnected ? (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 mb-3">
                  Choose which app to send this quote to.
                </p>
                {connectedIntegrations.map((integration) => {
                  const info = PROVIDER_LABELS[integration.provider] ?? { name: integration.provider, icon: '🔌', description: '' };
                  return (
                    <button
                      key={integration.id}
                      type="button"
                      onClick={() => handleSend(integration)}
                      disabled={sending !== null}
                      className="w-full flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-orange-300 hover:bg-orange-50/40 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="text-xl">{info.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">{info.name}</p>
                        <p className="text-xs text-slate-400">
                          {sending === integration.id ? 'Sending...' : 'Click to send quote'}
                        </p>
                      </div>
                      {sending === integration.id && (
                        <svg className="animate-spin h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              /* No integrations connected - educate and redirect */
              <div className="space-y-4">
                <div className="rounded-lg bg-orange-50 p-4 text-center">
                  <span className="text-3xl">🔗</span>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    No apps connected yet
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Send completed quotes directly to the job management platform you already use. Connect an app to get started.
                  </p>
                </div>

                {/* Show available providers */}
                <div className="space-y-2">
                  {(Object.keys(PROVIDER_LABELS) as string[]).map((provider) => {
                    const info = PROVIDER_LABELS[provider];
                    return (
                      <div key={provider} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <span className="text-xl">{info.icon}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-slate-900">{info.name}</p>
                          <p className="text-xs text-slate-400">{info.description}</p>
                        </div>
                        {provider === 'zapier' ? (
                          <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Available</span>
                        ) : (
                          <span className="rounded-full bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-400">Soon</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <a
                  href={`/${workspaceSlug}/account?tab=integrations`}
                  className="block w-full rounded-full bg-black px-5 py-2.5 text-center text-xs font-semibold text-white hover:bg-slate-800 transition"
                >
                  Go to Integrations Settings
                </a>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
