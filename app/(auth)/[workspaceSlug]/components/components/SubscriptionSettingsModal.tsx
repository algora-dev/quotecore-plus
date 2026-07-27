'use client';

import { useState, useEffect } from 'react';
import { FIELD_LABELS, PRICE_FIELDS } from '@/app/lib/supabase/sync-fields';

type Subscription = {
  id: string;
  source_library_id: string;
  library_name: string;
  supplier_name: string;
  alerts_enabled: boolean;
  field_preferences: Record<string, boolean> | null;
  created_at: string;
};

export function SubscriptionSettingsModal({
  workspaceSlug,
  onClose,
}: {
  workspaceSlug: string;
  onClose: () => void;
}) {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null); // library_id being saved
  const [expandedLib, setExpandedLib] = useState<string | null>(null);

  useEffect(() => {
    void loadSubs();
  }, []);

  async function loadSubs() {
    setLoading(true);
    try {
      const res = await fetch(`/api/supplier-alert-preferences?workspaceSlug=${encodeURIComponent(workspaceSlug)}`);
      const data = await res.json();
      if (data.ok) {
        setSubs(data.subscriptions ?? []);
      }
    } catch {
      // Error
    }
    setLoading(false);
  }

  async function toggleAlerts(libId: string, enabled: boolean) {
    setSaving(libId);
    try {
      await fetch('/api/supplier-alert-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceLibraryId: libId, alertsEnabled: enabled }),
      });
      setSubs(prev => prev.map(s =>
        s.source_library_id === libId ? { ...s, alerts_enabled: enabled } : s
      ));
    } catch {
      // Error
    }
    setSaving(null);
  }

  async function toggleFieldPref(libId: string, field: string, currentPrefs: Record<string, boolean> | null) {
    const newPrefs = { ...(currentPrefs ?? {}) };
    newPrefs[field] = !newPrefs[field];
    setSaving(libId);
    try {
      await fetch('/api/supplier-alert-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceLibraryId: libId,
          alertsEnabled: true,
          fieldPreferences: newPrefs,
        }),
      });
      setSubs(prev => prev.map(s =>
        s.source_library_id === libId ? { ...s, field_preferences: newPrefs } : s
      ));
    } catch {
      // Error
    }
    setSaving(null);
  }

  async function resetToAllFields(libId: string) {
    setSaving(libId);
    try {
      await fetch('/api/supplier-alert-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceLibraryId: libId,
          alertsEnabled: true,
          fieldPreferences: null,
        }),
      });
      setSubs(prev => prev.map(s =>
        s.source_library_id === libId ? { ...s, field_preferences: null } : s
      ));
    } catch {
      // Error
    }
    setSaving(null);
  }

  // Group fields: price fields first, then detail fields
  const priceFieldKeys = Object.keys(FIELD_LABELS).filter(k => PRICE_FIELDS.includes(k as never));
  const detailFieldKeys = Object.keys(FIELD_LABELS).filter(k => !PRICE_FIELDS.includes(k as never));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 rounded-t-2xl bg-white">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Alert Preferences</h2>
            <p className="text-xs text-slate-400">Choose which supplier changes trigger alerts</p>
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
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {loading && (
            <div className="text-center py-8">
              <p className="text-sm text-slate-400">Loading subscriptions...</p>
            </div>
          )}

          {!loading && subs.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-200 px-6 py-12 text-center">
              <p className="text-sm text-slate-400">No supplier subscriptions yet.</p>
              <p className="text-xs text-slate-400 mt-1">Import components from a supplier library to subscribe.</p>
            </div>
          )}

          {!loading && subs.map(sub => {
            const isExpanded = expandedLib === sub.source_library_id;
            const prefs = sub.field_preferences;
            const hasCustomPrefs = prefs !== null && Object.keys(prefs ?? {}).length > 0;

            return (
              <div key={sub.id} className="rounded-xl border border-slate-200 bg-white mb-3 overflow-hidden">
                {/* Library row */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={sub.alerts_enabled}
                      onChange={e => toggleAlerts(sub.source_library_id, e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{sub.supplier_name}</div>
                      <div className="text-xs text-slate-400 truncate">{sub.library_name}</div>
                    </div>
                  </div>
                  {sub.alerts_enabled && (
                    <button
                      onClick={() => setExpandedLib(isExpanded ? null : sub.source_library_id)}
                      className="text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer shrink-0 ml-2"
                    >
                      {isExpanded ? 'Hide' : 'Customise'}
                      {hasCustomPrefs && !isExpanded && <span className="ml-1 text-orange-600">*</span>}
                    </button>
                  )}
                </div>

                {/* Field preferences */}
                {isExpanded && sub.alerts_enabled && (
                  <div className="border-t border-slate-100 px-4 py-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-slate-500">
                        Alert me when: {hasCustomPrefs ? '(customised)' : '(all changes)'}
                      </p>
                      {hasCustomPrefs && (
                        <button
                          onClick={() => resetToAllFields(sub.source_library_id)}
                          className="text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          Reset to all
                        </button>
                      )}
                    </div>

                    {/* Price fields */}
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Pricing</p>
                      <div className="space-y-1">
                        {priceFieldKeys.map(field => {
                          const isChecked = !prefs || prefs[field] !== false;
                          return (
                            <label key={field} className="flex items-center gap-2 cursor-pointer hover:bg-orange-50/30 rounded-lg px-2 py-1">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleFieldPref(sub.source_library_id, field, prefs)}
                                className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                              />
                              <span className="text-sm text-slate-700">{FIELD_LABELS[field]}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {/* Detail fields */}
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Component Details</p>
                      <div className="space-y-1 max-h-48 overflow-y-auto">
                        {detailFieldKeys.map(field => {
                          const isChecked = !prefs || prefs[field] !== false;
                          return (
                            <label key={field} className="flex items-center gap-2 cursor-pointer hover:bg-orange-50/30 rounded-lg px-2 py-1">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleFieldPref(sub.source_library_id, field, prefs)}
                                className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                              />
                              <span className="text-sm text-slate-700">{FIELD_LABELS[field]}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>

                    {saving === sub.source_library_id && (
                      <p className="text-xs text-slate-400">Saving...</p>
                    )}
                  </div>
                )}

                {!sub.alerts_enabled && (
                  <div className="px-4 pb-2">
                    <p className="text-xs text-slate-400">Alerts paused</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-slate-100 sticky bottom-0 rounded-b-2xl bg-white">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-semibold rounded-full bg-black text-white hover:bg-slate-800 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
