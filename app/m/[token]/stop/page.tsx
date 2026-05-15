import { verifyMessageReplyToken } from '@/app/lib/messages/replyToken';
import { confirmSuppressionFromForm } from '../actions';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ confirmed?: string; error?: string }>;
}

/**
 * Per-recipient suppression endpoint linked from the email footer.
 *
 * IMPORTANT: GET never writes. The page renders a confirmation form;
 * the actual suppression only happens when the user submits the form,
 * which goes through the `confirmSuppressionFromForm` server action
 * (POST under the hood).
 *
 * Why: email clients (Gmail, Outlook), link safety scanners, image
 * proxies, hover-preview generators, and chat-app unfurl bots routinely
 * follow URLs found in emails with plain GET requests. Doing the write
 * on GET caused a recipient's suppression to be re-inserted after the
 * admin had removed it, because Gmail's link scanner re-fetched the
 * Stop link in an older email. Moving the write to POST eliminates
 * that class of bug and aligns with CAN-SPAM / GDPR opt-out norms.
 *
 * State transitions via query string:
 *   - No params         -> render confirmation form.
 *   - ?confirmed=1      -> success card.
 *   - ?error=<msg>      -> error card.
 *   - invalid token     -> "link expired" card (without writing).
 */
export default async function StopEmailingMePage({ params, searchParams }: Props) {
  const { token } = await params;
  const { confirmed, error } = await searchParams;

  if (error) {
    return (
      <ShellCard>
        <h1 className="text-xl font-semibold text-slate-900">Couldn&apos;t unsubscribe you</h1>
        <p className="mt-3 text-sm text-slate-600">{decodeURIComponent(error)}</p>
        <p className="mt-3 text-sm text-slate-500">
          If you keep seeing this, reply with &ldquo;stop&rdquo; to any of the recent emails
          from this sender and they will be informed.
        </p>
      </ShellCard>
    );
  }

  if (confirmed) {
    return (
      <ShellCard>
        <h1 className="text-xl font-semibold text-slate-900">You&apos;ve been unsubscribed</h1>
        <p className="mt-3 text-sm text-slate-600">
          We&apos;ve added your email to this sender&apos;s suppression list. They won&apos;t be
          able to email you through QuoteCore+ again unless you choose to opt back in.
        </p>
        <p className="mt-3 text-xs text-slate-500">
          Sent via QuoteCore<span className="text-orange-500">+</span>
        </p>
      </ShellCard>
    );
  }

  // Validate the token shape on GET so we can show "link expired" early
  // without exposing the form. Real verification happens again in the
  // server action when the form is submitted.
  const payload = verifyMessageReplyToken(token);
  if (!payload) {
    return (
      <ShellCard>
        <h1 className="text-xl font-semibold text-slate-900">Link expired or invalid</h1>
        <p className="mt-3 text-sm text-slate-600">
          This unsubscribe link is no longer valid. If you want to stop receiving messages,
          reply with &ldquo;stop&rdquo; to any of the recent emails from this sender.
        </p>
      </ShellCard>
    );
  }

  // Render the confirmation form. The user has to click the button so
  // a prefetcher or scanner visiting the URL with GET cannot trigger a
  // write.
  return (
    <ShellCard>
      <h1 className="text-xl font-semibold text-slate-900">Confirm unsubscribe</h1>
      <p className="mt-3 text-sm text-slate-600">
        Click the button below to confirm that you want to stop receiving emails from this
        sender through QuoteCore+. They won&apos;t be able to email you again unless you
        choose to opt back in.
      </p>
      <form action={confirmSuppressionFromForm} className="mt-5">
        <input type="hidden" name="token" value={token} />
        <button
          type="submit"
          className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition"
        >
          Yes, unsubscribe me
        </button>
      </form>
      <p className="mt-4 text-[11px] text-slate-400">
        Sent via QuoteCore<span className="text-orange-500">+</span>
      </p>
    </ShellCard>
  );
}

function ShellCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md text-center">
        {children}
      </div>
    </div>
  );
}
