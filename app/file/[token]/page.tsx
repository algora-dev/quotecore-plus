import { headers } from 'next/headers';
import {
  authorizeAttachmentDownload,
  isUuid,
} from '@/app/lib/messages/attachmentDownload';
import { getSignedUrl } from '@/app/lib/storage/helpers';
import { BUCKETS } from '@/app/lib/storage/buckets';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';

export const dynamic = 'force-dynamic';

/**
 * Standalone hosted file page for attachment-only auto-messages (no quote /
 * order to reuse a token from). The link in the email points here with the
 * per-attachment `access_token`. Token validation is server-side via the
 * same authorizer the gated download route uses.
 *
 * Image files get an inline preview + Download; non-images show the name +
 * Download. Download always goes through the gated route so leaked previews
 * still can't expose a raw storage path.
 */
function NotFoundScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white rounded-xl p-8 max-w-md text-center shadow-lg">
        <h1 className="text-xl font-semibold text-slate-900 mb-2">File Not Available</h1>
        <p className="text-sm text-slate-500">This link may be invalid, expired, or the file has been removed.</p>
      </div>
    </div>
  );
}

export default async function StandaloneFilePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isUuid(token)) return <NotFoundScreen />;

  // Rate limit (fail-closed: this is a token-gated resource).
  const hdrs = await headers();
  const ip = getClientIP(hdrs);
  const allowed = await checkRateLimit(`file-view-ip:${ip}`, 40, 60 * 60 * 1000, {
    failClosed: true,
  });
  if (!allowed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-xl p-8 max-w-md text-center shadow-lg">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Too Many Requests</h1>
          <p className="text-sm text-slate-500">Please try again later.</p>
        </div>
      </div>
    );
  }

  // Standalone token directly identifies the single row; fileId not needed.
  const resolved = await authorizeAttachmentDownload(token, null);
  if (!resolved) return <NotFoundScreen />;

  const isImage = (resolved.mimeType ?? '').toLowerCase().startsWith('image/');
  const downloadHref = `/api/attachments/${encodeURIComponent(token)}/download`;

  // For images, mint a short-lived signed URL for the inline preview. Token
  // is already validated; the raw path is never exposed (only the temporary
  // signed URL reaches the browser, same as the rest of the app's previews).
  let previewUrl: string | null = null;
  if (isImage) {
    try {
      previewUrl = await getSignedUrl(BUCKETS.QUOTE_DOCUMENTS, resolved.storagePath, 90);
    } catch {
      previewUrl = null;
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-xl">
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
          <div className="flex items-center gap-3 min-w-0">
            <svg
              className="w-6 h-6 text-slate-400 flex-shrink-0"
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
            <h1 className="text-lg font-semibold text-slate-900 truncate">{resolved.displayName}</h1>
          </div>

          {isImage && previewUrl ? (
            <div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={resolved.displayName}
                className="w-full h-auto object-contain max-h-[60vh]"
              />
            </div>
          ) : null}

          <a
            href={downloadHref}
            className="inline-flex items-center justify-center w-full px-4 py-2.5 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all"
          >
            Download
          </a>
        </div>

        <footer className="mt-8 text-center text-xs text-slate-400">
          Sent via QuoteCore<span className="text-orange-500">+</span>
        </footer>
      </div>
    </div>
  );
}
