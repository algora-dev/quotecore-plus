'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { adminDeleteAttachment, adminToggleArchiveAttachment, type AttachmentRow } from './actions';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function StorageTab({
  attachments,
  companyId,
  storageUsed,
  storageLimit,
}: {
  attachments: AttachmentRow[];
  companyId: string;
  storageUsed: number;
  storageLimit: number | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const usedPct = storageLimit && storageLimit > 0 ? Math.min(100, (storageUsed / storageLimit) * 100) : 0;

  function onDelete(attachmentId: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await adminDeleteAttachment(attachmentId, companyId);
      if (res.ok) {
        setNotice(res.message);
        setConfirmDeleteId(null);
        router.refresh();
      } else {
        setError(res.error);
        setConfirmDeleteId(null);
      }
    });
  }

  function onToggleArchive(attachmentId: string) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await adminToggleArchiveAttachment(attachmentId, companyId);
      if (res.ok) {
        setNotice(res.message);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
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

      {/* Storage usage bar */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-slate-900">Storage Usage</h3>
          <span className="text-xs text-slate-500">
            {formatBytes(storageUsed)}{storageLimit ? ` / ${formatBytes(storageLimit)}` : ''}
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              usedPct > 90 ? 'bg-red-500' : usedPct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{ width: `${usedPct}%` }}
          />
        </div>
      </div>

      {/* Files table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {attachments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
            <p className="text-sm text-slate-500">No files uploaded.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">File</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Size</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Uploaded</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attachments.map((a) => (
                <tr key={a.id} className="hover:bg-orange-50/40 transition">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900 text-sm">{a.name}</div>
                    <div className="text-xs text-slate-400 font-mono">{a.file_name}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{formatBytes(a.file_size)}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(a.created_at)}</td>
                  <td className="px-4 py-3">
                    {a.archived_at ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Archived
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-emerald-100 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => onToggleArchive(a.id)}
                        disabled={pending}
                        className="text-xs font-medium text-slate-600 hover:text-orange-600 disabled:opacity-40 transition"
                      >
                        {a.archived_at ? 'Unarchive' : 'Archive'}
                      </button>
                      {confirmDeleteId === a.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => onDelete(a.id)}
                            disabled={pending}
                            className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-40"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="text-xs font-medium text-slate-400 hover:text-slate-600"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(a.id)}
                          disabled={pending}
                          className="text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-40 transition"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {attachments.length > 0 && (
          <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
            {attachments.length} file{attachments.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
