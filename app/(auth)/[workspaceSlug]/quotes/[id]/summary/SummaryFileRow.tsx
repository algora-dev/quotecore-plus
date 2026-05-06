'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteFile, deleteTakeoffCanvas } from '../actions-files';
import { ConfirmModal } from '@/app/components/ConfirmModal';

interface Props {
  /** Quote id, required when fileType === 'canvas' so we can target the correct column. */
  quoteId: string;
  /** Real DB id for quote_files rows; synthetic id like 'canvas-image' / 'canvas-lines' for takeoff snapshots. */
  id: string;
  fileName: string;
  fileType: 'plan' | 'supporting' | 'canvas' | string;
  fileSize: number;
  storagePath: string;
  url: string;
  deletable?: boolean;
}

export function SummaryFileRow({ quoteId, id, fileName, fileType, fileSize, storagePath, url, deletable = true }: Props) {
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
        if (fileType === 'canvas') {
          // Synthetic ids: 'canvas-image' → takeoff_canvas_url, 'canvas-lines' → takeoff_lines_url.
          const kind: 'canvas' | 'lines' = id === 'canvas-lines' ? 'lines' : 'canvas';
          await deleteTakeoffCanvas(quoteId, kind);
        } else {
          await deleteFile(id, storagePath);
        }
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
      <div className="flex items-center gap-1">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          title="View file"
          className="icon-btn border-slate-300 bg-white"
        >
          {/* Eye / view icon */}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </a>
        <a
          href={url}
          download={fileName}
          title="Download file"
          className="icon-btn border-slate-300 bg-white"
        >
          {/* Download arrow icon */}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
          </svg>
        </a>
        {deletable && (
          <button
            type="button"
            onClick={requestDelete}
            disabled={pending}
            title="Delete file"
            className="icon-btn icon-btn--danger border-slate-300 bg-white"
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
