'use client';

import { useState } from 'react';
import type { PendingUpdate } from '../supplier-directory/actions';
import { UpdateNotificationModal } from './components/UpdateNotificationModal';
import { SubscriptionSettingsModal } from './components/SubscriptionSettingsModal';

export function PendingUpdatesBanner({
  workspaceSlug,
  updates,
}: {
  workspaceSlug: string;
  updates: PendingUpdate[];
}) {
  const [remindLater, setRemindLater] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (remindLater || updates.length === 0) return null;

  // Group by supplier for the summary
  const bySupplier = new Map<string, { supplierName: string; count: number }>();
  for (const u of updates) {
    if (!bySupplier.has(u.source_library_id)) {
      bySupplier.set(u.source_library_id, { supplierName: u.supplier_name, count: 0 });
    }
    bySupplier.get(u.source_library_id)!.count++;
  }

  const supplierSummary = [...bySupplier.values()];
  const mainText = supplierSummary.length === 1
    ? `${supplierSummary[0].supplierName} published ${supplierSummary[0].count} component update${supplierSummary[0].count !== 1 ? 's' : ''}`
    : `${updates.length} supplier updates available from ${supplierSummary.length} suppliers`;

  return (
    <>
      <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4 mb-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <svg className="w-4 h-4 text-orange-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
            </svg>
            <span className="text-sm font-semibold text-slate-900 truncate">{mainText}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setSettingsOpen(true)}
              className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer px-2"
              title="Manage alert preferences"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            <button
              onClick={() => setModalOpen(true)}
              className="cursor-pointer rounded-full bg-black px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
            >
              Review updates
            </button>
            <button
              onClick={() => setRemindLater(true)}
              className="text-xs text-slate-500 hover:text-slate-700 cursor-pointer px-2"
            >
              Remind me later
            </button>
          </div>
        </div>
      </div>

      {modalOpen && (
        <UpdateNotificationModal
          workspaceSlug={workspaceSlug}
          updates={updates}
          onClose={() => setModalOpen(false)}
        />
      )}

      {settingsOpen && (
        <SubscriptionSettingsModal
          workspaceSlug={workspaceSlug}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}
