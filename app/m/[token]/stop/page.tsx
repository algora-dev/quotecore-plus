import { suppressMessageRecipient } from '../actions';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ token: string }>;
}

/**
 * Per-recipient suppression endpoint linked from the email footer.
 * Visiting the URL is the confirmation \u2014 we don't double-prompt because
 * the recipient already had to click a link in their email, which is a
 * sufficient proof-of-intent for an opt-out flow.
 *
 * Token shape: same HMAC payload as the reply page. We re-verify the
 * signature + recipient match before writing.
 */
export default async function StopEmailingMePage({ params }: Props) {
  const { token } = await params;
  const result = await suppressMessageRecipient(token);

  if (!result.ok) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md text-center">
          <h1 className="text-xl font-semibold text-slate-900">Link expired or invalid</h1>
          <p className="mt-3 text-sm text-slate-600">{result.error}</p>
          <p className="mt-3 text-sm text-slate-500">
            If you want to stop receiving messages, reply with &ldquo;stop&rdquo; to any of the
            recent emails from this sender and they will be informed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md text-center">
        <h1 className="text-xl font-semibold text-slate-900">You&apos;ve been unsubscribed</h1>
        <p className="mt-3 text-sm text-slate-600">
          We&apos;ve added your email to this sender&apos;s suppression list. They won&apos;t be
          able to email you through QuoteCore+ again unless you choose to opt back in.
        </p>
        <p className="mt-3 text-xs text-slate-500">
          Sent via QuoteCore<span className="text-orange-500">+</span>
        </p>
      </div>
    </div>
  );
}
