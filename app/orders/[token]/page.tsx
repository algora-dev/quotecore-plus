import { headers } from 'next/headers';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';
import { OrderResponseForm } from './OrderResponseForm';
import { OrderBody } from './OrderBody';
import { DownloadOrderButton } from './DownloadOrderButton';
import { AttachmentsCard } from '@/app/components/public/AttachmentsCard';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ token: string }>;
}

/**
 * Public supplier-facing order page. Mirrors `/accept/[token]` for quotes.
 * Token is a high-entropy UUID v4 stored on material_orders; no HMAC
 * wrapper needed (lookup-by-token already requires guessing 122 bits).
 *
 * Flow:
 *   1. Validate token exists + not expired.
 *   2. IP rate limit (30 views/hr) to deter scanners.
 *   3. Load order + lines via service role (anonymous viewer).
 *   4. Render read-only order body + action form.
 */
export default async function PublicOrderPage({ params }: Props) {
  const { token } = await params;

  if (!token || token.length < 16) {
    return <ExpiredOrInvalidScreen />;
  }

  const hdrs = await headers();
  const ip = getClientIP(hdrs);
  const allowed = await checkRateLimit(`order-view-ip:${ip}`, 30, 60 * 60 * 1000);
  if (!allowed) {
    return <RateLimitedScreen />;
  }

  const supabase = createAdminClient();
  const { data: order, error } = await supabase
    .from('material_orders')
    .select('*')
    .eq('acceptance_token', token)
    .maybeSingle();

  if (error || !order) {
    return <ExpiredOrInvalidScreen />;
  }

  if (order.acceptance_token_expires_at && new Date(order.acceptance_token_expires_at) < new Date()) {
    return <ExpiredOrInvalidScreen />;
  }

  const [{ data: lines }, { data: flashings }, { data: company }] = await Promise.all([
    supabase
      .from('material_order_lines')
      .select('*')
      .eq('order_id', order.id)
      .order('sort_order'),
    supabase.from('flashing_library').select('id, name, image_url').eq('company_id', order.company_id),
    supabase.from('companies').select('name').eq('id', order.company_id).maybeSingle(),
  ]);

  // Latest response (if any) drives the inline status banner.
  const { data: latestResponse } = await supabase
    .from('material_order_responses')
    .select('action, body, created_at')
    .eq('order_id', order.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const companyName = order.from_company || company?.name || 'Sender';

  // Hosted attachments for this order (Option B, library files only). Token
  // already validated above; the gated download route re-validates it.
  const { data: attachmentRows } = await supabase
    .from('message_attachments')
    .select('id, display_name')
    .eq('order_id', order.id)
    .order('created_at', { ascending: true });
  const attachments = (attachmentRows ?? []).map((r) => ({
    id: r.id,
    displayName: r.display_name,
  }));

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 text-center">
          <p className="text-xs uppercase tracking-wide text-slate-500">{companyName}</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            Order {order.order_number}
          </h1>
          {order.reference ? (
            <p className="mt-1 text-sm text-slate-500">Ref: {order.reference}</p>
          ) : null}
        </header>

        {latestResponse ? (
          <ResponseBanner action={latestResponse.action} createdAt={latestResponse.created_at} />
        ) : null}

        <OrderBody
          order={order}
          lines={lines ?? []}
          flashings={flashings ?? []}
        />

        <OrderResponseForm
          token={token}
          alreadyResponded={!!latestResponse}
          downloadAction={<DownloadOrderButton />}
        />

        {attachments.length > 0 ? (
          <div className="mt-6">
            <AttachmentsCard token={token} files={attachments} />
          </div>
        ) : null}

        <footer className="mt-10 text-center text-xs text-slate-400">
          Sent via QuoteCore<span className="text-orange-500">+</span>
        </footer>
      </div>
    </div>
  );
}

function ResponseBanner({ action, createdAt }: { action: string; createdAt: string }) {
  const labels: Record<string, string> = {
    confirm: 'You confirmed this order',
    request_changes: 'You requested changes on this order',
    question: 'You sent a question about this order',
    other: 'You responded to this order',
  };
  const tones: Record<string, string> = {
    confirm: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    request_changes: 'border-amber-200 bg-amber-50 text-amber-900',
    question: 'border-blue-200 bg-blue-50 text-blue-900',
    other: 'border-slate-200 bg-slate-50 text-slate-800',
  };
  return (
    <div className={`mb-6 rounded-2xl border p-4 text-sm ${tones[action] ?? tones.other}`}>
      <p className="font-medium">{labels[action] ?? labels.other}</p>
      <p className="mt-1 text-xs opacity-80">
        {new Date(createdAt).toLocaleString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
      <p className="mt-2 text-xs opacity-80">
        You can still send an additional message below if needed.
      </p>
    </div>
  );
}

function ExpiredOrInvalidScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-md text-center">
        <h1 className="text-xl font-semibold text-slate-900">Link expired or invalid</h1>
        <p className="mt-3 text-sm text-slate-600">
          This order link is no longer valid. If you still need to view this order, ask the
          sender to share a fresh link.
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
        <p className="mt-3 text-sm text-slate-600">Please try again in a few minutes.</p>
      </div>
    </div>
  );
}
