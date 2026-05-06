'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteFile } from '../actions-files';
import { ConfirmModal } from '@/app/components/ConfirmModal';

interface Props {
  id: string;
  fileName: string;
  fileType: 'plan' | 'supporting' | 'canvas' | string;
  fileSize: number;
  storagePath: string;
  url: string;
  /** When true (e.g. canvas snapshots), hide the delete button. */
  deletable?: boolean;
}

export function SummaryFileRow({ id, fileName, fileType, fileSize, storagePath, url, deletable = true }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [removed, setRemoved] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  function requestDelete() {
    setConfirmOpen(true);
  }

  function handleConfirmedDelete() {
    startTransition(async () => {
      try {
        await deleteFile(id, storagePath);
        setConfirmOpen(false);
        setRemoved(true);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to delete file');
      }
    });
  }

  if (removed) return null;

  const label =
    fileType === 'plan' ? 'Roof Plan' : fileType === 'canvas' ? 'Digital Takeoff' : 'Supporting File';
  const sizeText = fileSize > 0 ? ` • ${(fileSize / 1024 / 1024).toFixed(2)} MB` : '';

  return (
    <div className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-full">
      <div className="flex-shrink-0">
        {fileName.toLowerCase().endsWith('.pdf') ? (
          <svg className="w-8 h-8 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" />
          </svg>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={fileName} className="w-8 h-8 object-cover rounded border border-slate-300" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-700 truncate">{fileName}</p>
        <p className="text-xs text-slate-500">
          {label}
          {sizeText}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-orange-600 hover:text-orange-800 font-medium"
        >
          View →
        </a>
        <a
          href={url}
          download={fileName}
          className="px-3 py-1.5 text-xs font-medium bg-black text-white rounded-full hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
        >
          Download
        </a>
        {deletable && (
          <button
            type="button"
            onClick={requestDelete}
            disabled={pending}
            title="Delete file"
            className="p-1.5 rounded-full border border-slate-300 bg-white hover:bg-red-50 hover:border-red-300 text-slate-600 hover:text-red-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {pending ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.25" />
                <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M1 7h22M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3" />
              </svg>
            )}
          </button>
        )}
      </div>
      <ConfirmModal
        open={confirmOpen}
        title="Delete file"
        description={`Delete “${fileName}”? This cannot be undone.`}
        confirmLabel="Delete"
        pendingLabel="Deleting..."
        pending={pending}
        onCancel={() => { if (!pending) setConfirmOpen(false); }}
        onConfirm={handleConfirmedDelete}
      />
    </div>
  );
}
