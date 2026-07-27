'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PendingUpdate } from '../supplier-directory/actions';

export function PendingUpdatesBanner({
  workspaceSlug,
  updates,
}: {
  workspaceSlug: string;
  updates: PendingUpdate[];
}) {
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; message?: string }>>({});

  if (dismissed || updates.length === 0) return null;

  async function applyUpdate(update: PendingUpdate) {
    setUpdating(update.imported_component_id);
    try {
      const res = await fetch('/api/supplier-update-component', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importedComponentId: update.imported_component_id,
          notificationId: update.notification_id,
        }),
      });
      const data = await res.json();
      setResults(prev => ({
        ...prev,
        [update.imported_component_id]: { ok: data.ok, message: data.message },
      }));
    } catch {
      setResults(prev => ({
        ...prev,
        [update.imported_component_id]: { ok: false, message: 'Network error' },
      }));
    }
    setUpdating(null);
  }

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4 mb-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
          </svg>
          <span className="text-sm font-semibold text-slate-900">
            {updates.length} supplier update{updates.length !== 1 ? 's' : ''} available
          </span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          Dismiss
        </button>
      </div>

      <div className="space-y-2">
        {updates.map(update => {
          const result = results[update.imported_component_id];
          const isUpdating = updating === update.imported_component_id;

          return (
            <div
              key={update.notification_id}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-slate-900 truncate">{update.imported_component_name}</span>
                  <span className="rounded-full bg-orange-100 text-orange-700 border border-orange-200 px-2 py-0.5 text-xs">
                    {update.change_type === 'price_changed' ? 'Price updated' :
                     update.change_type === 'modified' ? 'Modified' :
                     update.change_type === 'added' ? 'Re-added' : 'Removed'}
                  </span>
                  <span className="text-xs text-slate-400">v{update.version_from} {'->'} v{update.version_to}</span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  from {update.supplier_name} - {update.source_library_name}
                </div>
                {result && (
                  <div className={`text-xs mt-1 ${result.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                    {result.ok ? 'Updated' : result.message}
                  </div>
                )}
              </div>

              {!result && (
                <button
                  onClick={() => applyUpdate(update)}
                  disabled={isUpdating}
                  className="shrink-0 cursor-pointer rounded-full bg-black px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
                >
                  {isUpdating ? 'Updating...' : 'Update'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
