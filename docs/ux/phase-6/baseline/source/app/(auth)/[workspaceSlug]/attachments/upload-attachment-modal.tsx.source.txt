'use client';

import { useState } from 'react';
import { createClient } from '@/app/lib/supabase/client';
import { mintQuoteDocumentUploadUrl } from '@/app/lib/files/signed-upload';
import { createAttachment } from './actions';
import { StorageBlockedModal } from '@/app/components/billing/StorageBlockedModal';

interface Props {
  onClose: () => void;
  onSaved: () => void;
  /** When true the company is over storage - block file uploads. */
  isOverStorage?: boolean;
}

const MAX_BYTES = 52428800; // 50 MB
const ACCEPT = 'application/pdf,image/*,application/zip,.zip';

function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(0, dot) : filename;
}

export function UploadAttachmentModal({ onClose, onSaved, isOverStorage }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputCls =
    'w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none';

  function handleFile(selected: File | null) {
    setError(null);
    if (!selected) {
      setFile(null);
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError('File is too large. Maximum size is 50 MB.');
      setFile(null);
      return;
    }
    setFile(selected);
    setName(stripExtension(selected.name));
  }

  async function handleSave() {
    if (!file) {
      setError('Please choose a file to upload.');
      return;
    }
    if (!name.trim()) {
      setError('Please give the attachment a name.');
      return;
    }
    setSaving(true);
    setError(null);

    try {
      const mint = await mintQuoteDocumentUploadUrl({
        scope: { kind: 'library' },
        filename: file.name,
        contentType: file.type || 'application/octet-stream',
        claimedSize: file.size,
      });
      if (!mint.ok) {
        setError(mint.message);
        setSaving(false);
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(mint.bucket)
        .uploadToSignedUrl(mint.storagePath, mint.token, file, {
          contentType: file.type || undefined,
        });
      if (uploadError) {
        setError(uploadError.message);
        setSaving(false);
        return;
      }

      const result = await createAttachment({
        name: name.trim(),
        fileName: file.name,
        storagePath: mint.storagePath,
        claimedSize: file.size,
        mimeType: file.type || null,
      });
      if (!result.ok) {
        setError(result.message);
        setSaving(false);
        return;
      }

      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4"
      >
        <div className="border-b px-2 md:px-6 py-3 md:py-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Upload file</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-2 md:p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">File</label>
            {file ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{file.name}</p>
                  <p className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleFile(null)}
                  className="text-slate-400 hover:text-slate-600 shrink-0"
                  aria-label="Remove file"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <>
                <StorageBlockedModal open={storageBlocked} onClose={() => setStorageBlocked(false)} />
                <label
                  className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center cursor-pointer hover:border-orange-300 hover:bg-orange-50/40 transition"
                  onClick={isOverStorage ? (e) => { e.preventDefault(); setStorageBlocked(true); } : undefined}
                >
                  <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M17 8l-5-5m0 0L7 8m5-5v12"
                    />
                  </svg>
                  <span className="text-sm font-medium text-slate-600">Choose a file</span>
                  <span className="text-xs text-slate-400">PDF, image or ZIP &middot; max 50 MB</span>
                  {!isOverStorage && (
                    <input
                      type="file"
                      accept={ACCEPT}
                      className="hidden"
                      onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                    />
                  )}
                </label>
              </>
            )}
          </div>

          {file && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                maxLength={120}
                autoFocus
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 justify-end pt-1">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium border border-slate-300 rounded-full hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !file || !name.trim()}
              className="px-4 py-2 text-sm font-medium bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-40"
            >
              {saving ? 'Uploading...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
