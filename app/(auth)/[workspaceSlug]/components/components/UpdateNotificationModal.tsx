'use client';

import { useState } from 'react';
import type { PendingUpdate } from '../../supplier-directory/actions';
import { FIELD_LABELS } from '@/app/lib/supabase/sync-fields';

type Selection = {
  // notification_id -> { imported_component_id -> Set of fields to apply }
  [notificationId: string]: {
    [importedComponentId: string]: Set<string>;
  };
};

export function UpdateNotificationModal({
  workspaceSlug,
  updates,
  onClose,
  onApplied,
}: {
  workspaceSlug: string;
  updates: PendingUpdate[];
  onClose: () => void;
  onApplied?: () => void;
}) {
  const [selection, setSelection] = useState<Selection>({});
  const [applying, setApplying] = useState(false);
  const [results, setResults] = useState<Record<string, { ok: boolean; message?: string }>>({});
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [applyDone, setApplyDone] = useState(false);
  const [appliedCount, setAppliedCount] = useState(0);

  // Group updates by supplier library
  const grouped = new Map<string, { supplierName: string; libraryName: string; updates: PendingUpdate[] }>();
  for (const u of updates) {
    if (dismissedIds.has(u.notification_id)) continue;
    const key = u.source_library_id;
    if (!grouped.has(key)) {
      grouped.set(key, { supplierName: u.supplier_name, libraryName: u.source_library_name, updates: [] });
    }
    grouped.get(key)!.updates.push(u);
  }

  function toggleField(notifId: string, compId: string, field: string) {
    setSelection(prev => {
      const next = { ...prev };
      if (!next[notifId]) next[notifId] = {};
      if (!next[notifId][compId]) next[notifId][compId] = new Set();
      const fields = next[notifId][compId];
      if (fields.has(field)) fields.delete(field);
      else fields.add(field);
      return next;
    });
  }

  function toggleComponent(notifId: string, compId: string, fields: string[]) {
    setSelection(prev => {
      const next = { ...prev };
      if (!next[notifId]) next[notifId] = {};
      const current = next[notifId][compId] ?? new Set<string>();
      if (current.size === fields.length) {
        // All selected -> deselect all
        next[notifId][compId] = new Set();
      } else {
        next[notifId][compId] = new Set(fields);
      }
      return next;
    });
  }

  function getSelectedCount(): number {
    let count = 0;
    for (const notif of Object.values(selection)) {
      for (const fields of Object.values(notif)) {
        count += fields.size;
      }
    }
    return count;
  }

  async function handleApply() {
    setApplying(true);
    const selections: Array<{
      notificationId: string;
      importedComponentId: string;
      fields: string[];
    }> = [];

    for (const [notifId, comps] of Object.entries(selection)) {
      for (const [compId, fields] of Object.entries(comps)) {
        if (fields.size > 0) {
          selections.push({ notificationId: notifId, importedComponentId: compId, fields: [...fields] });
        }
      }
    }

    if (selections.length === 0) {
      setApplying(false);
      return;
    }

    try {
      const res = await fetch('/api/supplier-apply-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections }),
      });
      const data = await res.json();

      if (data.results) {
        setResults(data.results);
        // Remove successfully applied updates
        let successCount = 0;
        const applied = new Set<string>();
        for (const [key, result] of Object.entries(data.results as Record<string, { ok: boolean }>) ) {
          if (result.ok) {
            successCount++;
            const [notifId] = key.split(':');
            applied.add(notifId);
          }
        }
        setAppliedCount(successCount);
        setApplyDone(true);
        setDismissedIds(prev => new Set([...prev, ...applied]));
        // Auto-close after showing success state briefly
        if (successCount > 0) {
          setTimeout(() => {
            onClose();
            onApplied?.();
          }, 1200);
        }
      }
    } catch {
      // Network error
    }
    setApplying(false);
  }

  async function handleDismiss(notificationId: string, importedComponentId: string) {
    try {
      await fetch('/api/supplier-resolve-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, importedComponentId, status: 'dismissed' }),
      });
      setDismissedIds(prev => new Set([...prev, notificationId]));
    } catch {
      // Error
    }
  }

  async function handleKeepLocal(notificationId: string, importedComponentId: string) {
    try {
      await fetch('/api/supplier-resolve-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationId, importedComponentId, status: 'kept_local' }),
      });
      setDismissedIds(prev => new Set([...prev, notificationId]));
    } catch {
      // Error
    }
  }

  const totalSelected = getSelectedCount();
  const remainingCount = updates.filter(u => !dismissedIds.has(u.notification_id)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col relative">
        {/* Loading overlay when applying */}
        {applying && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 rounded-2xl">
            <svg className="animate-spin h-8 w-8 text-orange-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="mt-3 text-sm font-medium text-slate-700">Applying updates...</p>
          </div>
        )}
        {/* Success overlay */}
        {applyDone && !applying && appliedCount > 0 && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/90 rounded-2xl">
            <svg className="h-10 w-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className="mt-3 text-sm font-medium text-slate-700">{appliedCount} component{appliedCount !== 1 ? 's' : ''} updated</p>
          </div>
        )}
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 rounded-t-2xl bg-white">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Supplier Updates</h2>
            <p className="text-xs text-slate-400">{remainingCount} pending update{remainingCount !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {grouped.size === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-slate-400">All updates reviewed.</p>
            </div>
          )}

          {[...grouped.entries()].map(([libId, group]) => (
            <div key={libId} className="space-y-2">
              {/* Library header */}
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-slate-900">{group.libraryName}</span>
                <span className="text-xs text-slate-400">({group.supplierName})</span>
              </div>

              {/* Updates for this library */}
              {group.updates.map((update) => {
                const result = results[update.notification_id];
                const compSelection = selection[update.notification_id]?.[update.imported_component_id] ?? new Set<string>();
                const changedFields = update.changed_fields;
                const allFieldsSelected = compSelection.size === changedFields.length;

                return (
                  <div
                    key={update.notification_id}
                    className="rounded-xl border border-slate-200 bg-white overflow-hidden"
                  >
                    {/* Component header */}
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-50/50 border-b border-slate-100">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-900">{update.imported_component_name}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs border ${
                          update.change_type === 'price_changed' ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          update.change_type === 'modified' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          update.change_type === 'added' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          'bg-red-50 text-red-700 border-red-200'
                        }`}>
                          {update.change_type === 'price_changed' ? 'Price updated' :
                           update.change_type === 'modified' ? 'Modified' :
                           update.change_type === 'added' ? 'Re-added' : 'Removed'}
                        </span>
                        <span className="text-xs text-slate-400">v{update.version_from} {'->'} v{update.version_to}</span>
                      </div>

                      {/* Actions for removed components */}
                      {update.change_type === 'removed' ? (
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleKeepLocal(update.notification_id, update.imported_component_id)}
                            className="text-xs font-medium rounded-full border border-slate-300 px-2.5 py-1 hover:bg-slate-50 cursor-pointer"
                          >
                            Keep local
                          </button>
                          <button
                            onClick={() => handleDismiss(update.notification_id, update.imported_component_id)}
                            className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer px-2"
                          >
                            Dismiss
                          </button>
                        </div>
                      ) : (
                        changedFields.length > 0 && (
                          <button
                            onClick={() => toggleComponent(update.notification_id, update.imported_component_id, changedFields)}
                            className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                          >
                            {allFieldsSelected ? 'Clear' : 'Select all'}
                          </button>
                        )
                      )}
                    </div>

                    {/* Field-level diff */}
                    {update.change_type !== 'removed' && changedFields.length > 0 && (
                      <div className="divide-y divide-slate-50">
                        {changedFields.map((field: string) => {
                          const isSelected = compSelection.has(field);
                          const supplierNew = update.new_snapshot?.[field];
                          const localCurrent = update.local_values?.[field];
                          const label = FIELD_LABELS[field] ?? field;

                          return (
                            <label
                              key={field}
                              className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-orange-50/30"
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleField(update.notification_id, update.imported_component_id, field)}
                                className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                              />
                              <div className="flex-1 flex items-center justify-between gap-3 min-w-0">
                                <span className="text-xs font-medium text-slate-600 shrink-0">{label}</span>
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs text-slate-400 truncate">
                                    {localCurrent !== null && localCurrent !== undefined ? String(localCurrent) : '-'}
                                  </span>
                                  <svg className="w-3 h-3 text-slate-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                  </svg>
                                  <span className={`text-xs font-medium truncate ${isSelected ? 'text-orange-600' : 'text-slate-700'}`}>
                                    {supplierNew !== null && supplierNew !== undefined ? String(supplierNew) : '-'}
                                  </span>
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* Result feedback */}
                    {result && (
                      <div className={`px-3 py-1.5 text-xs ${result.ok ? 'text-emerald-600 bg-emerald-50/50' : 'text-red-600 bg-red-50/50'}`}>
                        {result.ok ? 'Updated successfully' : result.message ?? 'Failed'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 sticky bottom-0 rounded-b-2xl bg-white">
          <span className="text-xs text-slate-400">
            {totalSelected > 0 ? `${totalSelected} field${totalSelected !== 1 ? 's' : ''} selected` : 'Select fields to apply'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handleApply}
              disabled={totalSelected === 0 || applying}
              className="px-5 py-2 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 transition disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
            >
              {applying ? 'Applying...' : `Update Selected (${totalSelected})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
