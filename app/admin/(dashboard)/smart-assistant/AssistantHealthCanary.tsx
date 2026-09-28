'use client';

import { useState } from 'react';

type Result = {
  ok: boolean;
  status: string;
  model?: string;
  latencyMs?: number;
  tokensIn?: number;
  tokensOut?: number;
  responseShape?: string;
  error?: string;
};

export function AssistantHealthCanary() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function run() {
    if (busy) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/smart-assistant/health', { method: 'POST', cache: 'no-store' });
      const body = await res.json().catch(() => null) as Result | null;
      setResult(body ?? { ok: false, status: 'unavailable', error: 'Unreadable health response.' });
    } catch (error) {
      setResult({ ok: false, status: 'unavailable', error: error instanceof Error ? error.message : 'Health request failed.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Provider canary</h2>
          <p className="mt-1 text-xs text-slate-500">Runs one tiny real model request with a function schema. No company data or assistant run is created.</p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="rounded-full bg-black px-4 py-2 text-xs text-white disabled:opacity-50"
        >
          {busy ? 'Checking…' : 'Run health check'}
        </button>
      </div>
      {result && (
        <div className={`mt-3 rounded-lg border p-3 text-xs ${result.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`} role="status">
          <strong>{result.ok ? 'Healthy' : result.status === 'degraded' ? 'Degraded' : 'Unavailable'}</strong>
          {result.model ? ` · ${result.model}` : ''}
          {typeof result.latencyMs === 'number' ? ` · ${result.latencyMs} ms` : ''}
          {typeof result.tokensIn === 'number' ? ` · ${result.tokensIn + (result.tokensOut ?? 0)} tokens` : ''}
          {result.responseShape && result.responseShape !== 'text' ? ` · ${result.responseShape}` : ''}
          {result.error ? ` · ${result.error}` : ''}
        </div>
      )}
    </section>
  );
}
