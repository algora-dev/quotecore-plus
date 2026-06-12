'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  renameAttachment,
  archiveAttachment,
  unarchiveAttachment,
  deleteAttachment,
} from './actions';
import type { AttachmentRow } from './actions';
import { UploadAttachmentModal } from './upload-attachment-modal';

interface Props {
  attachments: AttachmentRow[];
  /** When true the company is over storage - block new uploads. */
  isOverStorage?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentList({ attachments, isOverStorage }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<AttachmentRow | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AttachmentRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const active = attachments.filter((a) => !a.archived_at);
  const archived = attachments.filter((a) => a.archived_at);
  const ordered = [...active, ...archived];

  function refresh() {
    startTransition(() => router.refresh());
  }

  function openRename(row: AttachmentRow) {
    setError(null);
    setRenameValue(row.name);
    setRenameTarget(row);
  }

  async function handleRename() {
    if (!renameTarget || !renameValue.trim()) return;
    setBusyId(renameTarget.id);
    setError(null);
    const result = await renameAttachment(renameTarget.id, renameValue);
    setBusyId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setRenameTarget(null);
    refresh();
  }

  async function handleArchiveToggle(row: AttachmentRow) {
    setBusyId(row.id);
    setError(null);
    const result = row.archived_at
      ? await unarchiveAttachment(row.id)
      : await archiveAttachment(row.id);
    setBusyId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    refresh();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.id);
    setError(null);
    const result = await deleteAttachment(deleteTarget.id);
    setBusyId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDeleteTarget(null);
    refresh();
  }

  function renderRow(row: AttachmentRow) {
    const isArchived = !!row.archived_at;
    const busy = busyId === row.id;
    return (
      <div
        key={row.id}
        className={`grid sm:grid-cols-[1fr_120px_110px] gap-4 items-center rounded-xl border bg-white px-4 py-3 transition group ${
          isArchived ? 'border-slate-200 opacity-75' : 'border-slate-200 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)]'
        }`}
      >
        {/* Name + file */}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-900 truncate">{row.name}</p>
            {isArchived && (
              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium border bg-slate-100 text-slate-500 border-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                Archived
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 truncate">{row.file_name}</p>
        </div>

        {/* Size */}
        <div className="text-xs text-slate-500">{formatBytes(row.file_size)}</div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-1">
          {!isArchived && (
            <button
              onClick={() => openRename(row)}
              disabled={busy}
              title="Rename attachment"
              className="icon-btn opacity-0 group-hover:opacity-100 disabled:opacity-30"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => handleArchiveToggle(row)}
            disabled={busy}
            title={isArchived ? 'Reinstate attachment' : 'Archive attachment'}
            className="icon-btn opacity-0 group-hover:opacity-100 disabled:opacity-30"
          >
            {isArchived ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            )}
          </button>
          <button
            onClick={() => { setError(null); setDeleteTarget(row); }}
            disabled={busy}
            title="Delete attachment"
            className="icon-btn icon-btn--danger opacity-0 group-hover:opacity-100 disabled:opacity-30"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button
          data-copilot="attachment-upload-btn"
          onClick={() => setUploadOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Upload file
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {attachments.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm font-medium text-slate-700 mb-1">No attachments yet</p>
          <p className="text-xs text-slate-400 mb-4">Upload a file to reuse it across your quotes and templates.</p>
          <button
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
          >
            Upload your first file
          </button>
        </div>
      ) : (
        <div className="grid gap-1">{ordered.map(renderRow)}</div>
      )}

      {uploadOpen && (
        <UploadAttachmentModal
          onClose={() => setUploadOpen(false)}
          onSaved={() => refresh()}
          isOverStorage={isOverStorage}
        />
      )}

      {/* Rename modal */}
      {renameTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Rename attachment</h3>
              <button onClick={() => setRenameTarget(null)} className="text-slate-400 hover:text-slate-600" aria-label="Close">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                maxLength={120}
                autoFocus
              />
              {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
              <div className="mt-6 flex gap-3 justify-end">
                <button onClick={() => setRenameTarget(null)} className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-full hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  onClick={handleRename}
                  disabled={busyId === renameTarget.id || !renameValue.trim()}
                  className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-40"
                >
                  {busyId === renameTarget.id ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete attachment</h3>
            <p className="text-sm text-slate-500 mt-2">
              Permanently delete <strong className="text-slate-700">{deleteTarget.name}</strong>? This removes the file and frees {formatBytes(deleteTarget.file_size)} of storage, and clears it from any email template that uses it as a default. If this file was already sent on a quote or order, those existing download links will stop working. This cannot be undone.
            </p>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 justify-end mt-6">
              <button onClick={() => setDeleteTarget(null)} disabled={busyId === deleteTarget.id} className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={busyId === deleteTarget.id} className="px-4 py-2 text-sm font-medium rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                {busyId === deleteTarget.id ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
