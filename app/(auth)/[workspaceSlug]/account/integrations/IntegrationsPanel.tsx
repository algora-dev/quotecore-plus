'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface XeroStatus {
  connected: boolean;
  tenantName: string | null;
  connectedAt: string | null;
}

export function IntegrationsPanel({ workspaceSlug }: { workspaceSlug?: string }) {
  const [status, setStatus] = useState<XeroStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const params = useSearchParams();
  const xeroResult = params?.get('xero');

  useEffect(() => {
    fetch('/api/integrations/xero/status')
      .then((r) => r.json())
      .then((data: XeroStatus) => setStatus(data))
      .catch(() => setStatus({ connected: false, tenantName: null, connectedAt: null }))
      .finally(() => setLoading(false));
  }, []);

  const disconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch('/api/integrations/xero/disconnect', { method: 'POST' });
      setStatus({ connected: false, tenantName: null, connectedAt: null });
    } finally {
      setDisconnecting(false);
    }
  };

  const connectHref = workspaceSlug
    ? `/api/integrations/xero/connect?workspace=${encodeURIComponent(workspaceSlug)}`
    : '/api/integrations/xero/connect';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Integrations</h2>
        <p className="mt-1 text-sm text-slate-500">
          Send completed quotes to the accounting and job management platforms you already use.
        </p>
      </div>

      {xeroResult === 'connected' && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Xero connected successfully.
        </div>
      )}
      {xeroResult === 'error' && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Could not connect to Xero ({params?.get('reason') ?? 'unknown error'}). Please try again.
        </div>
      )}

      {/* Xero card */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50">
              <span className="text-lg font-bold text-[#13B5EA]">X</span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Xero</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Export quotes to Xero as draft invoices with line items.
              </p>
              {status?.connected ? (
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                  Connected{status.tenantName ? `: ${status.tenantName}` : ''}
                </span>
              ) : loading ? (
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                  Checking...
                </span>
              ) : (
                <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                  Not connected
                </span>
              )}
            </div>
          </div>
          {status?.connected ? (
            <button
              type="button"
              onClick={disconnect}
              disabled={disconnecting}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:border-red-300 hover:bg-red-50/40 transition disabled:opacity-50"
            >
              {disconnecting ? 'Disconnecting...' : 'Disconnect'}
            </button>
          ) : (
            <a
              href={connectHref}
              className="rounded-full bg-black px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
            >
              Connect
            </a>
          )}
        </div>
      </div>

      {/* Other providers - coming soon */}
      <div className="grid gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 opacity-75">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">QuickBooks Online</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Export quotes to QuickBooks as draft invoices.
              </p>
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
