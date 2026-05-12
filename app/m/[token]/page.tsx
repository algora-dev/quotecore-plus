import { headers } from 'next/headers';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { verifyMessageReplyToken } from '@/app/lib/messages/replyToken';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';
import { ReplyForm } from './ReplyForm';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ token: string }>;
}

/**
 * Public reply page for outbound Messages. Recipients click "Respond now"
 * in their email and land here. The HMAC-signed token in the URL is the
 * sole access gate \u2014 no auth required.
 *
 * Flow:
 *   1. Verify token signature + expiry.
 *   2. Rate-limit by IP (modest cap; this isn't a high-volume page).
 *   3. Load the outbound_messages row via service role (RLS hides it from
 *      authenticated users in other companies, but the recipient isn't
 *      authenticated here so we use the admin client and rely on the
 *      token as the only access check).
 *   4. Verify the token's `to` email matches the row's recipient_email
 *      (defence-in-depth against a token-id mix-up).
 *   5. Render a small intro + the action form. The form posts to a
 *      server action in actions.ts.
 *
 * Why force-dynamic: the page renders different content depending on the
 * token; nothing to statically optimise.
 */
export default async function MessageReplyPage({ params }: Props) {
  const { token } = await params;

  // Token validation. We deliberately render the same "link expired"
  // message for both bad-signature and expired tokens so an attacker
  // can't tell which failure mode triggered.
  const payload = verifyMessageReplyToken(token);
  if (!payload) {
    return <ExpiredOrInvalidScreen />;
  }

  // IP rate limit: 30 GETs per hour per IP across all message tokens.
  // Generous because legitimate recipients often refresh; the goal is to
  // deter scanners, not block users.
  const hdrs = await headers();
  const ip = getClientIP(hdrs);
  const allowed = await checkRateLimit(`message-view-ip:${ip}`, 30, 60 * 60 * 1000);
  if (!allowed) {
    return <RateLimitedScreen />;
  }

  const supabase = createAdminClient();
  const { data: message, error } = await supabase
    .from('outbound_messages')
    .select(
      'id, company_id, subject, recipient_email, recipient_name, sent_at, replied_at, related_quote_id, related_order_id, kind',
    )
    .eq('id', payload.mid)
    .maybeSingle();

  if (error || !message) {
    return <ExpiredOrInvalidScreen />;
  }

  if (message.recipient_email !== payload.to) {
    // Token id matches but recipient on the token doesn't match the row.
    // Probably a tampered token; treat as invalid.
    return <ExpiredOrInvalidScreen />;
  }

  // Load company branding for the page header. Same fetch the email used,
  // but with one freshly looked-up row so a logo change since send-time
  // shows on the reply page too.
  const { data: company } = await supabase
    .from('companies')
    .select('name')
    .eq('id', message.company_id)
    .maybeSingle();

  const alreadyReplied = !!message.replied_at;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4">
      <div className="mx-auto max-w-xl">
        <header className="mb-8 text-center">
          <p className="text-xs uppercase tracking-wide text-slate-500">{company?.name ?? 'QuoteCore+'}</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            {alreadyReplied ? 'Thanks for your response' : 'Respond to this message'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Re: {message.subject}
          </p>
        </header>

        {alreadyReplied ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center">
            <p className="text-sm text-slate-700">
              You&apos;ve already responded to this message. We&apos;ve passed your reply on to{' '}
              <span className="font-medium text-slate-900">{company?.name ?? 'the sender'}</span>.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              You can close this page. If you need to send another message, contact{' '}
              {company?.name ?? 'the sender'} directly.
            </p>
          </div>
        ) : (
          <ReplyForm
            token={token}
            recipientName={message.recipient_name ?? null}
            messageKind={message.kind as 'quote_send' | 'order_send' | 'followup' | 'decline_response' | 'custom'}
            relatedQuoteId={message.related_quote_id}
            relatedOrderId={message.related_order_id}
          />
        )}

        <footer className="mt-8 text-center text-xs text-slate-400">
          Sent via QuoteCore<span className="text-orange-500">+</span>
        </footer>
      </div>
    </div>
  );
}

function ExpiredOrInvalidScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md text-center">
        <h1 className="text-xl font-semibold text-slate-900">Link expired or invalid</h1>
        <p className="mt-3 text-sm text-slate-600">
          This response link is no longer valid. If you still need to respond, ask the sender
          to send a fresh message.
        </p>
      </div>
    </div>
  );
}

function RateLimitedScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md text-center">
        <h1 className="text-xl font-semibold text-slate-900">Too many requests</h1>
        <p className="mt-3 text-sm text-slate-600">
          Please try again in a few minutes.
        </p>
      </div>
    </div>
  );
}
