import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import {
  authorizeAttachmentDownload,
  buildDownloadName,
  isUuid,
} from '@/app/lib/messages/attachmentDownload';
import { getSignedUrl } from '@/app/lib/storage/helpers';
import { BUCKETS } from '@/app/lib/storage/buckets';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Gated attachment download (Option B). Read-only, non-mutating GET so it
 * works as a plain browser download link.
 *
 * Flow:
 *   1. Validate token format (fail fast, no DB hit).
 *   2. Rate-limit per IP (token-guessing defence). FAIL-CLOSED on the auth
 *      gate - a transient limiter blip must not become a free pass.
 *   3. Authorise server-side: token -> quote/order/standalone -> the requested
 *      message_attachments row -> the live source file (must still exist +
 *      belong to the resolving company). Raw path NEVER returned to client.
 *   4. Mint a short-expiry (90s) signed URL and 302-redirect to it.
 *
 * The `file` query param is the message_attachments row id (required for
 * quote/order context; the standalone access_token already identifies the
 * single row). Anything that doesn't resolve returns 404 - we never leak
 * whether a token/file exists.
 *
 * The optional `disposition=attachment` query param forces a save-to-device
 * download (Content-Disposition: attachment) by signing the URL with the
 * file's display name. Omitted/any other value = inline (View) behaviour.
 * This ONLY affects the response disposition - the auth model (token -> scope
 * -> company -> live source file) is unchanged.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;

  if (!isUuid(token)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Rate limit: 60 download attempts per IP per hour. Fail CLOSED here -
  // this is the security gate, so a limiter outage should block, not allow.
  const hdrs = await headers();
  const ip = getClientIP(hdrs);
  const allowed = await checkRateLimit(
    `attachment-download-ip:${ip}`,
    60,
    60 * 60 * 1000,
    { failClosed: true },
  );
  if (!allowed) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  const url = new URL(request.url);
  const fileId = url.searchParams.get('file');
  const forceDownload = url.searchParams.get('disposition') === 'attachment';

  const resolved = await authorizeAttachmentDownload(token, fileId);
  if (!resolved) {
    // Covers: bad token, file not reachable through this token, source file
    // deleted, or company mismatch. One generic 404, no existence leak.
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  let signedUrl: string;
  try {
    signedUrl = await getSignedUrl(
      BUCKETS.QUOTE_DOCUMENTS,
      resolved.storagePath,
      90,
      // Force save-to-device only when the caller asked for it; otherwise the
      // signed URL renders inline (View). Sanitise the display name for the
      // Content-Disposition filename.
      forceDownload
        ? sanitizeFilename(buildDownloadName(resolved.displayName, resolved.sourceFileName))
        : undefined,
    );
  } catch (err) {
    console.error('[attachments/download] sign failed:', err);
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // 302 to the short-lived signed URL. The raw storage path stays server-side.
  return NextResponse.redirect(signedUrl, 302);
}

/**
 * Strip path separators / control chars from a display name before it goes
 * into the Content-Disposition filename. Defence-in-depth: display_name is a
 * snapshot we control, but never trust a stored string in a header.
 */
function sanitizeFilename(name: string): string {
  const cleaned = (name || 'download')
    .replace(/[\r\n"]/g, '')
    .replace(/[/\\]/g, '_')
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 200) : 'download';
}
