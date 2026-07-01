'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateAnnouncement, type AnnouncementConfig } from './actions';

export function AnnouncementTab({ initialConfig }: { initialConfig: AnnouncementConfig }) {
  const router = useRouter();
  const [config, setConfig] = useState<AnnouncementConfig>(initialConfig);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function save() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await updateAnnouncement(config);
      if (res.ok) {
        setNotice(res.message);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  const charCount = config.message.length;

  return (
    <div className="space-y-4 max-w-2xl">
      {notice && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          ✅ {notice}
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
        {/* Active toggle */}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={config.active}
            onChange={(e) => setConfig({ ...config, active: e.target.checked })}
            className="rounded"
          />
          <span className="font-medium">Active</span>
          <span className="text-slate-400 text-xs">— show banner to all users</span>
        </label>

        {/* Message */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Message <span className="text-slate-400">({charCount}/500)</span>
          </label>
          <textarea
            value={config.message}
            onChange={(e) => setConfig({ ...config, message: e.target.value.slice(0, 500) })}
            rows={3}
            placeholder="Enter announcement message…"
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none resize-none"
          />
        </div>

        {/* Type */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
          <div className="flex gap-2">
            {(['info', 'warning', 'maintenance'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setConfig({ ...config, type: t })}
                className={`rounded-full border px-4 py-1.5 text-xs font-medium transition capitalize ${
                  config.type === t
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Starts At (optional)</label>
            <input
              type="datetime-local"
              value={config.starts_at ? new Date(config.starts_at).toISOString().slice(0, 16) : ''}
              onChange={(e) => setConfig({ ...config, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Ends At (optional)</label>
            <input
              type="datetime-local"
              value={config.ends_at ? new Date(config.ends_at).toISOString().slice(0, 16) : ''}
              onChange={(e) => setConfig({ ...config, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
              className="w-full px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Dismissible */}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={config.dismissible}
            onChange={(e) => setConfig({ ...config, dismissible: e.target.checked })}
            className="rounded"
          />
          <span className="font-medium">Dismissible</span>
          <span className="text-slate-400 text-xs">— users can hide it (per-browser via localStorage)</span>
        </label>

        {/* Preview */}
        {config.active && config.message && (
          <div className={`rounded-xl border p-3 text-sm ${
            config.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800'
              : config.type === 'maintenance' ? 'bg-red-50 border-red-200 text-red-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
          }`}>
            <span className="font-medium">Preview:</span> {config.message}
          </div>
        )}

        {/* Save */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={pending}
            className="inline-flex items-center rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30 disabled:opacity-50"
          >
            {pending ? 'Saving…' : 'Save announcement'}
          </button>
        </div>
      </div>
    </div>
  );
}
