import { createSupabaseServerClient } from '@/app/lib/supabase/server';

/**
 * "Unresolved" tab body for the order Activity card.
 *
 * Orders don't carry a per-response `resolved_at` flag (unlike quote
 * revision requests or invoice disputes) — the order's lifecycle is
 * tracked by status stamps on the order row itself
 * (accepted/declined/info_requested). So this panel surfaces the
 * supplier responses that represent an *open question or objection*
 * (anything that isn't a plain confirmation) as informational cards,
 * newest first. It's read-only: the user actions the order via the
 * order status itself (Reset / re-send), not per-response.
 *
 * Confirmations are intentionally excluded here — they live in the
 * "Sent / activity" history, not the attention list.
 */

interface Props {
  orderId: string;
  companyId: string;
}

const ACTION_LABEL: Record<string, string> = {
  confirm: 'Confirmed',
  request_changes: 'Requested changes',
  question: 'Asked a question',
  declined: 'Declined',
  info_requested: 'Requested info',
  other: 'Responded',
};

const ACTION_TONE: Record<string, string> = {
  request_changes: 'bg-amber-50 text-amber-700 border-amber-200',
  question: 'bg-blue-50 text-blue-700 border-blue-200',
  declined: 'bg-rose-50 text-rose-700 border-rose-200',
  info_requested: 'bg-amber-50 text-amber-700 border-amber-200',
  other: 'bg-slate-50 text-slate-700 border-slate-200',
};

// Responses we consider "needs attention" — i.e. not a clean confirm.
const UNRESOLVED_ACTIONS = new Set([
  'request_changes',
  'question',
  'declined',
  'info_requested',
  'other',
]);

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function OrderResponsesPanel({ orderId, companyId }: Props) {
  const supabase = await createSupabaseServerClient();
  const { data: responses } = await supabase
    .from('material_order_responses')
    .select('id, action, body, created_at')
    .eq('order_id', orderId)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(20);

  const open = (responses ?? []).filter((r) => UNRESOLVED_ACTIONS.has(r.action));

  if (open.length === 0) {
    return (
      <div className="px-1 py-6 text-center text-xs text-slate-500">
        Nothing needs attention. Supplier objections, questions, or change
        requests would show up here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {open.map((r) => {
        const tone = ACTION_TONE[r.action] ?? ACTION_TONE.other;
        const label = ACTION_LABEL[r.action] ?? ACTION_LABEL.other;
        return (
          <div key={r.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${tone}`}>
                {label}
              </span>
              <span className="text-xs text-slate-400">{formatTimestamp(r.created_at)}</span>
            </div>
            {r.body ? (
              <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg px-3 py-2">
                {r.body}
              </p>
            ) : (
              <p className="text-xs text-slate-400 italic">No message added by supplier.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
