'use client';

import { useState } from 'react';
import { queueQuoteExport } from '@/app/(auth)/[workspaceSlug]/account/integrations/actions';

type Integration = {
  id: string;
  provider: string;
  enabled: boolean;
  connection_status: string;
};

type QuoteDataAvailability = {
  hasQuoteSummary: boolean;
  hasCustomerQuote: boolean;
  hasLaborSheet: boolean;
  hasFiles: boolean;
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
  dataAvailability,
}: {
  quoteId: string;
  companyId: string;
  integrations: Integration[];
  workspaceSlug: string;
  dataAvailability: QuoteDataAvailability;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'select-app' | 'pick-data' | 'sending' | 'result'>('select-app');
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [scopes, setScopes] = useState<Record<string, boolean>>({});
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const connectedIntegrations = integrations.filter(
    (i) => i.enabled && i.connection_status === 'connected'
  );
  const hasConnected = connectedIntegrations.length > 0;

  const handleSelectApp = (integration: Integration) => {
    setSelectedIntegration(integration);
    // Default: everything off, user picks what they want
    setScopes({
      quoteSummary: false,
      customerQuote: false,
      laborSheet: false,
      files: false,
      internalCosts: false,
      marginInformation: false,
    });
    setStep('pick-data');
  };

  const handleSend = async () => {
    if (!selectedIntegration) return;
    // Map UI scopes to data scope keys
    const scopeOverrides: Record<string, boolean> = {
      customerDetails: scopes.quoteSummary || scopes.customerQuote,
      siteDetails: scopes.quoteSummary,
      customerFacingQuote: scopes.customerQuote,
      filesAndPlans: scopes.files,
      internalCosts: scopes.internalCosts,
      marginInformation: scopes.marginInformation,
      labourBreakdown: scopes.laborSheet,
      measurementsAndTakeoff: scopes.quoteSummary,
      internalNotes: false,
      acceptanceDetails: scopes.quoteSummary,
    };

    setStep('sending');
    try {
      const res = await queueQuoteExport(companyId, selectedIntegration.id, quoteId, 'manual_export', scopeOverrides);
      setResult({
        success: res.success,
        message: res.success
          ? 'Queued - will be delivered within 1-2 minutes.'
          : res.error || 'Failed to queue export.',
      });
    } catch {
      setResult({ success: false, message: 'Unexpected error. Please try again.' });
    }
    setStep('result');
  };

  const reset = () => {
    setOpen(false);
    setStep('select-app');
    setSelectedIntegration(null);
    setScopes({});
    setResult(null);
  };

  const anySelected = Object.values(scopes).some(Boolean);

  return (
    <>
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
          onClick={reset}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">Send to App</h3>
              <button
                type="button"
                onClick={reset}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Step 1: Select app */}
            {step === 'select-app' && hasConnected && (
              <div className="space-y-2">
                <p className="text-xs text-slate-500 mb-3">Choose which app to send this quote to.</p>
                {connectedIntegrations.map((integration) => {
                  const info = PROVIDER_LABELS[integration.provider] ?? { name: integration.provider, icon: '🔌', description: '' };
                  return (
                    <button
                      key={integration.id}
                      type="button"
                      onClick={() => handleSelectApp(integration)}
                      className="w-full flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left hover:border-orange-300 hover:bg-orange-50/40 transition"
                    >
                      <span className="text-xl">{info.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900">{info.name}</p>
                        <p className="text-xs text-slate-400">Click to continue</p>
                      </div>
                      <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Step 1: No integrations connected */}
            {step === 'select-app' && !hasConnected && (
              <div className="space-y-4">
                <div className="rounded-lg bg-orange-50 p-4 text-center">
                  <span className="text-3xl">🔗</span>
                  <p className="mt-2 text-sm font-medium text-slate-900">No apps connected yet</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Send completed quotes directly to the job management platform you already use. Connect an app to get started.
                  </p>
                </div>
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
                        {provider === 'zapier' || provider === 'jobnimbus' ? (
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

            {/* Step 2: Pick what to send */}
            {step === 'pick-data' && selectedIntegration && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{PROVIDER_LABELS[selectedIntegration.provider]?.icon}</span>
                  <span className="text-sm font-medium text-slate-900">{PROVIDER_LABELS[selectedIntegration.provider]?.name}</span>
                </div>
                <p className="text-xs text-slate-500 mb-3">Select what to include in this export.</p>

                <div className="space-y-2">
                  <ScopeCheckbox
                    label="Quote summary"
                    description="Full quote details, components, measurements, totals"
                    checked={scopes.quoteSummary}
                    available={dataAvailability.hasQuoteSummary}
                    onChange={(v) => setScopes({ ...scopes, quoteSummary: v })}
                  />
                  <ScopeCheckbox
                    label="Customer quote"
                    description="Customer-facing quote lines and pricing"
                    checked={scopes.customerQuote}
                    available={dataAvailability.hasCustomerQuote}
                    onChange={(v) => setScopes({ ...scopes, customerQuote: v })}
                  />
                  <ScopeCheckbox
                    label="Labour sheet"
                    description="Labour breakdown and costs"
                    checked={scopes.laborSheet}
                    available={dataAvailability.hasLaborSheet}
                    onChange={(v) => setScopes({ ...scopes, laborSheet: v })}
                  />
                  <ScopeCheckbox
                    label="Files & plans"
                    description="Uploaded plans, supporting docs, canvas snapshots"
                    checked={scopes.files}
                    available={dataAvailability.hasFiles}
                    onChange={(v) => setScopes({ ...scopes, files: v })}
                  />
                  <ScopeCheckbox
                    label="Internal costs & margins"
                    description="Material costs, labour costs, profit margins (sensitive)"
                    checked={scopes.internalCosts}
                    available={true}
                    sensitive
                    onChange={(v) => setScopes({ ...scopes, internalCosts: v, marginInformation: v })}
                  />
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep('select-app')}
                    className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!anySelected}
                    className="flex-1 rounded-full bg-black px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    Send to {PROVIDER_LABELS[selectedIntegration.provider]?.name}
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Sending */}
            {step === 'sending' && (
              <div className="flex flex-col items-center py-8">
                <svg className="animate-spin h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="mt-3 text-sm text-slate-500">Queuing export...</p>
              </div>
            )}

            {/* Step 4: Result */}
            {step === 'result' && result && (
              <div className="space-y-3">
                <div className={`rounded-lg p-3 text-sm ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {result.message}
                </div>
                <button
                  type="button"
                  onClick={reset}
                  className="w-full rounded-full bg-black px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function ScopeCheckbox({
  label,
  description,
  checked,
  available,
  sensitive,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  available: boolean;
  sensitive?: boolean;
  onChange: (value: boolean) => void;
}) {
  if (!available) {
    return (
      <div className="flex items-start gap-2.5 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 opacity-60">
        <input type="checkbox" disabled className="mt-0.5 rounded border-slate-300" />
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="text-xs text-slate-400">Not created for this quote</p>
        </div>
      </div>
    );
  }

  return (
    <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2.5 cursor-pointer hover:border-orange-200 hover:bg-orange-50/30 transition">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 rounded border-slate-300"
      />
      <div>
        <p className="text-xs font-medium text-slate-700">
          {label}
          {sensitive && <span className="ml-1.5 text-slate-400">(sensitive)</span>}
        </p>
        <p className="text-xs text-slate-400">{description}</p>
      </div>
    </label>
  );
}
