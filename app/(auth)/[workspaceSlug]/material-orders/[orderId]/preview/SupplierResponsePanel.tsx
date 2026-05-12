import { createSupabaseServerClient } from '@/app/lib/supabase/server';

interface Props {
  orderId: string;
}

/**
 * Server-rendered history of supplier responses for a material order.
 * Renders nothing when there are no responses (keeps the order preview
 * clean for unsent / pre-response orders).
 *
 * Compact list, full-message visible inline (unlike the quote summary
 * Sent Messages panel which uses expandable rows): supplier responses
 * are usually short and infrequent, so the always-expanded layout
 * trades vertical space for fewer clicks.
 */
const ACTION_LABEL: Record<string, string> = {
  confirm: 'Confirmed',
  request_changes: 'Requested changes',
  question: 'Asked a question',
  other: 'Responded',
};

const ACTION_TONE: Record<string, string> = {
  confirm: 'bg-emerald-100 text-emerald-700',
  request_changes: 'bg-amber-100 text-amber-700',
  question: 'bg-blue-100 text-blue-700',
  other: 'bg-slate-100 text-slate-700',
};

export async function SupplierResponsePanel({ orderId }: Props) {
  const supabase = await createSupabaseServerClient();
  const { data: responses } = await supabase
    .from('material_order_responses')
    .select('id, action, body, created_at')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })
    .limit(20);

  if (!responses || responses.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 data-exclude-pdf">
      <header className="flex items-center gap-2">
        <svg className="w-4 h-4 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        <h2 className="text-sm font-semibold text-slate-900">Supplier responses</h2>
        <span className="text-[10px] uppercase tracking-wide bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
          {responses.length}
        </span>
      </header>

      <ul className="space-y-3">
        {responses.map((r) => (
          <li key={r.id} className="rounded-lg border border-slate-100 bg-slate-50/40 p-3">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-medium ${ACTION_TONE[r.action] ?? ACTION_TONE.other}`}>
                {ACTION_LABEL[r.action] ?? ACTION_LABEL.other}
              </span>
              <span className="text-xs text-slate-400">
                {new Date(r.created_at).toLocaleString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
            {r.body ? (
              <p className="mt-2 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{r.body}</p>
            ) : (
              <p className="mt-2 text-xs text-slate-400 italic">No message added by supplier.</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
