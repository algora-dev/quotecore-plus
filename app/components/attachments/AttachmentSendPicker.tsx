'use client';

import { useMemo } from 'react';

/**
 * Shared send-time attachment picker used by Send Quote + Send Order modals.
 *
 * IDS ONLY (Gerald H-03 #5): items carry id + name + size, never storage_path.
 * The parent owns selection state; this component is a controlled multi-select.
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
  const totalSelected = selection.libraryAttachmentIds.length + selection.quoteFileIds.length;

  const hasAnything = useMemo(
    () => libraryFiles.length > 0 || quoteFiles.length > 0,
    [libraryFiles.length, quoteFiles.length],
  );

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

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700">
          Attachments{totalSelected > 0 ? ` (${totalSelected})` : ''}
        </label>
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
        <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 max-h-48 overflow-y-auto">
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
      )}

      {libraryLocked ? (
        <p className="text-[11px] text-slate-400">
          Your attachment library is a Pro feature. This quote&apos;s own files can still be attached.
        </p>
      ) : null}
    </div>
  );
}
