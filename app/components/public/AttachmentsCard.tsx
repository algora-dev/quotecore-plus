import { DownloadAllAttachments } from './DownloadAllAttachments';

/**
 * Public, read-only Attachments card shown on the hosted quote (/accept) and
 * order (/orders) pages. Each Download link hits the gated download route,
 * which validates the page's token server-side before minting a short-lived
 * signed URL. No storage paths are ever rendered here.
 *
 * Download-all is sequential per-file (v1, not a zip) - handled client-side by
 * DownloadAllAttachments, which opens each gated link in turn.
 */
export interface PublicAttachmentItem {
  id: string;
  displayName: string;
}

interface Props {
  token: string;
  files: PublicAttachmentItem[];
}

function downloadHref(token: string, fileId: string): string {
  return `/api/attachments/${encodeURIComponent(token)}/download?file=${encodeURIComponent(fileId)}`;
}

export function AttachmentsCard({ token, files }: Props) {
  if (files.length === 0) return null;

  const hrefs = files.map((f) => downloadHref(token, f.id));

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Attachments</h2>
        {files.length > 1 ? <DownloadAllAttachments hrefs={hrefs} /> : null}
      </div>
      <ul className="divide-y divide-slate-100">
        {files.map((file) => (
          <li key={file.id} className="flex items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <svg
                className="w-5 h-5 text-slate-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                viewBox="0 0 24 24"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <path d="M14 2v6h6" />
              </svg>
              <span className="text-sm text-slate-700 truncate">{file.displayName}</span>
            </div>
            <a
              href={downloadHref(token, file.id)}
              className="px-3 py-1.5 text-xs font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all whitespace-nowrap"
            >
              Download
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
