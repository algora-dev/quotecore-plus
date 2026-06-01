'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Shared send-time attachment picker used by Send Quote + Send Order modals.
 *
 * IDS ONLY (Gerald H-03 #5): items carry id + name + size, never storage_path.
 * The parent owns selection state; this component is a controlled multi-select.
 *
 * UI (fix #1, 2026-06-01): the file list is collapsed into a dropdown/popover so
 * a long library doesn't stretch the modal. The closed control shows a summary
 * ("2 files attached" / "Select files"); tickboxes live inside the open panel.
 *
 * Two sources:
 *   - library  : company attachment library (Pro+ gated by the caller; when
 *                not entitled the caller passes an empty list and the source
 *                is hidden).
 *   - quote    : the quote's own quote_files (quotes only; orders pass none).
 */
export interface PickerFile {
  id: string;
  name: string;
  fileSize: number;
}

export interface AttachmentSelection {
  libraryAttachmentIds: string[];
  quoteFileIds: string[];
}

interface Props {
  libraryFiles: PickerFile[];
  quoteFiles: PickerFile[];
  selection: AttachmentSelection;
  onChange: (next: AttachmentSelection) => void;
  /** When true the library source is hidden (no Pro+ entitlement). */
  libraryLocked?: boolean;
}

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentSendPicker({
  libraryFiles,
  quoteFiles,
  selection,
  onChange,
  libraryLocked = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalSelected = selection.libraryAttachmentIds.length + selection.quoteFileIds.length;

  const hasAnything = useMemo(
    () => libraryFiles.length > 0 || quoteFiles.length > 0,
    [libraryFiles.length, quoteFiles.length],
  );

  // Close the popover on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggleLibrary(id: string) {
    const set = new Set(selection.libraryAttachmentIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ ...selection, libraryAttachmentIds: Array.from(set) });
  }

  function toggleQuoteFile(id: string) {
    const set = new Set(selection.quoteFileIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    onChange({ ...selection, quoteFileIds: Array.from(set) });
  }

  if (!hasAnything && libraryLocked) return null;

  const summary =
    totalSelected > 0
      ? `${totalSelected} file${totalSelected === 1 ? '' : 's'} attached`
      : hasAnything
        ? 'Select files'
        : 'No files available';

  return (
    <div className="space-y-2" ref={containerRef}>
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700">Attachments</label>
        {totalSelected > 0 ? (
          <button
            type="button"
            onClick={() => onChange({ libraryAttachmentIds: [], quoteFileIds: [] })}
            className="text-xs text-slate-500 hover:text-slate-700"
          >
            Clear
          </button>
        ) : null}
      </div>

      {!hasAnything ? (
        <p className="text-xs text-slate-500">
          No files available to attach. Upload files to this quote, or add files to your
          attachment library.
        </p>
      ) : (
        <div className="relative">
          {/* Closed control: summary + chevron */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="listbox"
            className="flex w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm text-slate-700 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-500"
          >
            <span className={totalSelected > 0 ? 'text-slate-700' : 'text-slate-500'}>
              {summary}
            </span>
            <svg
              className={`h-4 w-4 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.08 1.04l-4.25 4.5a.75.75 0 0 1-1.08 0l-4.25-4.5a.75.75 0 0 1 .02-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {/* Open popover: tickbox list */}
          {open ? (
            <div
              role="listbox"
              className="absolute z-20 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg divide-y divide-slate-100 max-h-60 overflow-y-auto"
            >
              {quoteFiles.length > 0 ? (
                <div className="p-2">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold px-1 pb-1">
                    This quote&apos;s files
                  </p>
                  {quoteFiles.map((f) => (
                    <label
                      key={f.id}
                      className="flex items-center gap-2 px-1 py-1.5 cursor-pointer hover:bg-slate-50 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selection.quoteFileIds.includes(f.id)}
                        onChange={() => toggleQuoteFile(f.id)}
                        className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                      />
                      <span className="text-sm text-slate-700 truncate flex-1">{f.name}</span>
                      {formatSize(f.fileSize) ? (
                        <span className="text-xs text-slate-400">{formatSize(f.fileSize)}</span>
                      ) : null}
                    </label>
                  ))}
                </div>
              ) : null}

              {libraryFiles.length > 0 ? (
                <div className="p-2">
                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold px-1 pb-1">
                    Attachment library
                  </p>
                  {libraryFiles.map((f) => (
                    <label
                      key={f.id}
                      className="flex items-center gap-2 px-1 py-1.5 cursor-pointer hover:bg-slate-50 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={selection.libraryAttachmentIds.includes(f.id)}
                        onChange={() => toggleLibrary(f.id)}
                        className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                      />
                      <span className="text-sm text-slate-700 truncate flex-1">{f.name}</span>
                      {formatSize(f.fileSize) ? (
                        <span className="text-xs text-slate-400">{formatSize(f.fileSize)}</span>
                      ) : null}
                    </label>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}

      {libraryLocked ? (
        <p className="text-[11px] text-slate-400">
          Your attachment library is a Pro feature. This quote&apos;s own files can still be attached.
        </p>
      ) : null}
    </div>
  );
}
